"""
SQLAlchemy 2.x ORM models for the Payments Service.

Tables
------
payments                    Master payment record
invoice_payment_allocations Junction: which invoice got how much from which payment

Design decisions
----------------
- All monetary columns: NUMERIC(12,2); no floats anywhere.
- payment_number is globally unique (PAY/YYYY/000001 via SequenceCounter).
- payment_reference is UNIQUE to prevent duplicate UPI/NEFT UTR recordings.
- Status stored as VARCHAR (not native PG ENUM) — adding values needs no ALTER TYPE.
- Multiple allocations per (payment_id, invoice_id) are allowed to handle
  re-allocations after reversal; reversed_at distinguishes active from reversed.
- Never CASCADE DELETE payments when a user is deleted — use RESTRICT / SET NULL.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# payments
# ---------------------------------------------------------------------------

class Payment(Base):
    """
    Master payment record — one row per payment received from a customer.

    Lifecycle
    ---------
    cheque              : pending → confirmed (cleared) or failed (bounced)
    upi/neft/rtgs/imps  : confirmed immediately on recording
    cash/bank_transfer  : confirmed immediately
    any confirmed       : may be reversed (admin only) → reversed
    refunds             : is_refund=True, refund_for_payment_id set, status=confirmed
    """

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Gap-free sequential number: PAY/YYYY/000001
    payment_number: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True, index=True
    )

    # Customer who made the payment (FK to users — no cascade delete)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Date the payment was made (as per bank statement / receipt)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Payment method (stored as plain string; enum enforced in application layer)
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)

    # Status lifecycle: pending → confirmed | failed; confirmed → reversed
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )

    # Total payment amount received (must be > 0 — enforced by CHECK constraint)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Currency (default INR for Indian SaaS)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")

    # External reference: UPI txn ID, NEFT/RTGS UTR, cheque number, gateway ref, etc.
    # UNIQUE prevents duplicate posting of the same bank transaction.
    payment_reference: Mapped[str | None] = mapped_column(
        String(200), nullable=True, unique=True, index=True
    )

    # Bank details (useful for NEFT/RTGS/cheque reconciliation)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)

    # Free-form notes for staff
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Refund tracking
    is_refund: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    refund_for_payment_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Reversal fields (populated when status transitions to 'reversed')
    reversed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    reversal_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    allocations: Mapped[list[InvoicePaymentAllocation]] = relationship(
        "InvoicePaymentAllocation",
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="InvoicePaymentAllocation.allocated_at",
    )
    refund_payment: Mapped[Payment | None] = relationship(
        "Payment",
        foreign_keys=[refund_for_payment_id],
        remote_side="Payment.id",
        uselist=False,
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        Index("ix_payment_customer_id", "customer_id"),
        Index("ix_payment_date", "payment_date"),
        Index("ix_payment_status", "status"),
        Index("ix_payment_method", "payment_method"),
    )


# ---------------------------------------------------------------------------
# invoice_payment_allocations
# ---------------------------------------------------------------------------

class InvoicePaymentAllocation(Base):
    """
    Junction record: portion of a payment applied to a specific invoice.

    Multiple allocations per (payment_id, invoice_id) are allowed so that
    re-allocations after a reversal are tracked separately.  Active allocations
    are those where reversed_at IS NULL.

    The ForeignKey to invoices uses the string form "invoices.id" so that
    this module does not introduce a circular import with app.billing.models.
    """

    __tablename__ = "invoice_payment_allocations"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Uses string FK to avoid circular import with billing module
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Amount allocated from this payment to this invoice (must be > 0)
    allocated_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    allocated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # NULL means active; set to a timestamp when this allocation is reversed
    reversed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship back to payment
    payment: Mapped[Payment] = relationship("Payment", back_populates="allocations")

    __table_args__ = (
        CheckConstraint(
            "allocated_amount > 0", name="ck_alloc_amount_positive"
        ),
        Index("ix_alloc_payment_id", "payment_id"),
        Index("ix_alloc_invoice_id", "invoice_id"),
    )

