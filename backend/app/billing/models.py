"""
SQLAlchemy 2.x ORM models for the Billing & Invoice Service.

Tables
------
invoices              Master invoice records
invoice_items         Line items — snapshotted at creation, immutable thereafter
billing_runs          One row per scheduled billing run (idempotency by run_key)
billing_run_items     One row per (subscription, period) attempted in a run

Design decisions
----------------
- All monetary columns: NUMERIC(12,2) in INR; no floats anywhere.
- Tax rate columns:     NUMERIC(7,4) to support fractional GST rates.
- invoice_number is globally unique (sequence_counters guarantees gap-free / year).
- (subscription_id, period_start, kind) is UNIQUE → prevents double-billing the
  same period even if the billing run is retried.
- billing_run_items has UNIQUE (billing_run_id, subscription_id, period_start, period_end)
  so a single run cannot process the same period twice.
- billing_runs.run_key is deterministic (hash of as_of date + optional context) so
  retrying an identical scheduled job produces zero new invoices.
- Status enums are stored as VARCHAR (not native PG ENUM) so adding new values
  requires no migration ALTER TYPE.
- Never CASCADE DELETE from invoices → payments; use archive / void patterns.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    VOID = "void"


class InvoiceKind(str, enum.Enum):
    RECURRING = "recurring"      # standard subscription renewal
    MANUAL = "manual"            # staff-created one-off invoice
    PRORATION = "proration"      # mid-cycle plan change charge
    CREDIT_NOTE = "credit_note"  # net-negative proration / refund


class BillingRunStatus(str, enum.Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"    # completed with some item errors
    FAILED = "failed"


class BillingRunItemStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    DUPLICATE = "duplicate"   # already billed — idempotency skip
    ERROR = "error"
    SKIPPED = "skipped"       # subscription not eligible (paused, expired, etc.)


# ---------------------------------------------------------------------------
# invoices
# ---------------------------------------------------------------------------

class Invoice(Base):
    """
    Master invoice record.

    Financial history rule: once confirmed, amounts must not be recalculated
    from current product/plan/discount/tax values.  All such values are
    snapshotted onto InvoiceItem rows at creation time.

    Overdue is DERIVED: status is confirmed/partially_paid AND due_date < today
    AND (total - amount_paid) > 0.  It is NOT stored as a status value.
    """

    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Gap-free sequential number: INV/YYYY/000001
    invoice_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )

    # Relationships to other entities
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT", use_alter=True, name="fk_invoices_customer_id_users"),
        nullable=False,
        index=True,
    )

    # Invoice classification
    kind: Mapped[InvoiceKind] = mapped_column(
        SAEnum(InvoiceKind, name="invoice_kind_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=InvoiceKind.RECURRING,
    )

    # Status lifecycle: draft → confirmed → partially_paid / paid; or → void
    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(InvoiceStatus, name="invoice_status_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=InvoiceStatus.DRAFT,
        index=True,
    )

    # Dates
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Amounts (INR, always non-negative)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    taxable_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    cgst_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sgst_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    igst_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    # Payment terms
    payment_term_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # GST supplier/customer details (snapshotted at creation for Rule 46 compliance)
    supplier_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    customer_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    place_of_supply: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_igst: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_rcm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Anomaly flags set by billing engine dry-run or commit
    has_anomaly: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    anomaly_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    confirmed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Who created / voided (staff/admin)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_invoices_created_by_users"), nullable=True
    )
    voided_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_invoices_voided_by_users"), nullable=True
    )
    void_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Relationships
    items: Mapped[list[InvoiceItem]] = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.created_at",
    )
    billing_run_items: Mapped[list[BillingRunItem]] = relationship(
        "BillingRunItem", back_populates="invoice"
    )

    __table_args__ = (
        # Core idempotency constraint: one invoice per subscription-period-kind
        UniqueConstraint(
            "subscription_id", "period_start", "kind",
            name="uq_invoice_sub_period_kind",
        ),
        CheckConstraint("subtotal >= 0", name="ck_inv_subtotal_nonneg"),
        CheckConstraint("discount_total >= 0", name="ck_inv_discount_nonneg"),
        CheckConstraint("tax_total >= 0", name="ck_inv_tax_nonneg"),
        CheckConstraint("total >= 0", name="ck_inv_total_nonneg"),
        CheckConstraint("amount_paid >= 0", name="ck_inv_amount_paid_nonneg"),
        # amount_paid must not exceed total (except credit notes where total may be 0)
        CheckConstraint("amount_paid <= total + 0.01", name="ck_inv_no_overpayment"),
        Index("ix_invoice_status", "status"),
        Index("ix_invoice_customer_id", "customer_id"),
        Index("ix_invoice_subscription_id", "subscription_id"),
        Index("ix_invoice_issue_date", "issue_date"),
        Index("ix_invoice_due_date", "due_date"),
        Index("ix_invoice_period_start", "period_start"),
        Index("ix_invoice_kind", "kind"),
    )


# ---------------------------------------------------------------------------
# invoice_items
# ---------------------------------------------------------------------------

class InvoiceItem(Base):
    """
    Single line on an invoice — fully snapshotted at creation time.

    Values are NEVER recalculated after creation.  If a product price changes
    or a tax rate changes, old invoices remain accurate because the values
    are stored here.
    """

    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE", use_alter=True, name="fk_invoice_line_items_invoice_id"),
        nullable=False,
        index=True,
    )

    # What this line is for (snapshotted at invoice creation)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )

    # Quantity and pricing (snapshotted)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # line_subtotal = quantity × unit_price  (before discount / tax)
    line_subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Discount share allocated to this line
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    # Taxable = line_subtotal - discount_amount
    taxable_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Snapshotted tax breakdown (CGST+SGST for intrastate; IGST for interstate)
    cgst_rate: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sgst_rate: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    igst_rate: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    # line_total = taxable_amount + tax_amount
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Arbitrary metadata (variant info, proration ratio, etc.)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON().with_variant(JSONB, "postgresql"), nullable=True)

    # Relationships
    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="items")

    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_invitem_qty_pos"),
        CheckConstraint("unit_price >= 0", name="ck_invitem_price_nonneg"),
        CheckConstraint("line_subtotal >= 0", name="ck_invitem_subtotal_nonneg"),
        CheckConstraint("discount_amount >= 0", name="ck_invitem_discount_nonneg"),
        CheckConstraint("tax_amount >= 0", name="ck_invitem_tax_nonneg"),
        CheckConstraint("line_total >= 0", name="ck_invitem_total_nonneg"),
    )


# ---------------------------------------------------------------------------
# billing_runs
# ---------------------------------------------------------------------------

class BillingRun(Base):
    """
    One row per billing run execution.

    run_key is deterministic: callers derive it from the as_of date (and
    optionally a context tag) so retrying the same scheduled job cannot
    create a second run for the same period.

    Idempotency guarantee: if a run with the given run_key already exists,
    the billing engine returns the existing run rather than creating a new one.
    """

    __tablename__ = "billing_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Deterministic key: e.g. "billing:2026-10-31" or "billing:2026-10-31:manual"
    run_key: Mapped[str] = mapped_column(
        String(150), nullable=False, unique=True, index=True
    )

    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    status: Mapped[BillingRunStatus] = mapped_column(
        SAEnum(BillingRunStatus, name="billing_run_status_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=BillingRunStatus.RUNNING,
    )

    started_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Counters
    processed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Who triggered it
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_billing_runs_triggered_by_users"), nullable=True
    )

    # Relationships
    items: Mapped[list[BillingRunItem]] = relationship(
        "BillingRunItem", back_populates="billing_run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_billing_run_as_of", "as_of_date"),
        Index("ix_billing_run_status", "status"),
    )


# ---------------------------------------------------------------------------
# billing_run_items
# ---------------------------------------------------------------------------

class BillingRunItem(Base):
    """
    One row per (subscription, billing period) attempted in a BillingRun.

    UNIQUE on (billing_run_id, subscription_id, period_start, period_end)
    prevents the same run from double-processing the same subscription period.

    The overall invoice-level duplicate prevention is the UniqueConstraint on
    invoices(subscription_id, period_start, kind) — that catches cross-run
    duplicates.  This constraint catches within-run duplicates.
    """

    __tablename__ = "billing_run_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    billing_run_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("billing_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[BillingRunItemStatus] = mapped_column(
        SAEnum(BillingRunItemStatus, name="billing_run_item_status_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=BillingRunItemStatus.PENDING,
    )

    # Linked invoice (NULL for dry-run or error/skipped)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="SET NULL", use_alter=True, name="fk_billing_run_items_invoice_id"),
        nullable=True,
        index=True,
    )

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Anomaly flag details for this item
    has_anomaly: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    anomaly_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    # Relationships
    billing_run: Mapped[BillingRun] = relationship("BillingRun", back_populates="items")
    invoice: Mapped[Invoice | None] = relationship("Invoice", back_populates="billing_run_items")

    __table_args__ = (
        UniqueConstraint(
            "billing_run_id", "subscription_id", "period_start", "period_end",
            name="uq_bri_run_sub_period",
        ),
        Index("ix_bri_subscription_id", "subscription_id"),
        Index("ix_bri_status", "status"),
        Index("ix_bri_period_start", "period_start"),
    )

