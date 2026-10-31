"""
SQLAlchemy 2.x ORM models for the Discount Service.

Tables
------
discounts
    Master discount definitions (codes, type, value, rules, limits).

discount_products
    Optional junction: scope a discount to specific products.

discount_plans
    Optional junction: scope a discount to specific plans.

subscription_discounts
    Links a discount to a subscription — tracks recurrence and active state.

invoice_discounts
    Immutable snapshot of every discount applied to an invoice line.
    Preserves historical invoice accuracy even if the discount later changes.

Design decisions (per playbook)
--------------------------------
- discount_type: "percentage" (0–100) or "fixed" (flat INR amount).
- scope: "subscription" (whole invoice), "product" (specific product lines),
  "plan" (specific plan lines).
- Recurrence: controlled by max_applications on subscription_discounts (NULL = unlimited).
- Usage limits: global (usage_limit / usage_count on discounts) AND per-customer
  (per_customer_limit / per_customer_usage on subscription_discounts).
- Stacking: controlled by allow_stacking flag on individual discounts + the
  billing engine honours priority ordering.
- Atomic usage: usage_count is incremented inside the same DB transaction that
  creates the invoice, preventing race conditions.
- All monetary values use NUMERIC(12,2); rates use NUMERIC(7,4).
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"   # value is 0–100 (percent off)
    FIXED = "fixed"             # value is flat INR amount off


class DiscountScope(str, enum.Enum):
    SUBSCRIPTION = "subscription"   # applies to the entire invoice subtotal
    PRODUCT = "product"             # applies only to matching product lines
    PLAN = "plan"                   # applies only to matching plan lines


class DiscountRecurrence(str, enum.Enum):
    ONCE = "once"               # applies to the very next invoice only
    REPEATING = "repeating"     # applies for max_applications invoices (or unlimited)
    FOREVER = "forever"         # never expires (unless usage_limit reached)


# ---------------------------------------------------------------------------
# discounts
# ---------------------------------------------------------------------------

class Discount(Base):
    """
    Master discount definition.

    A discount is created by an admin and then assigned to one or more
    subscriptions via subscription_discounts.  It can also be applied
    directly to an invoice during billing via invoice_discounts.

    Eligibility rules
    -----------------
    - is_active + starts_at/ends_at window must hold at application time.
    - usage_count < usage_limit (when usage_limit is set).
    - minimum_purchase: invoice subtotal must be >= this value.
    - minimum_quantity: total line quantity must be >= this value.
    - Product / plan scope enforced via discount_products / discount_plans.
    """

    __tablename__ = "discounts"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Identity
    code: Mapped[str] = mapped_column(
        String(80), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Type and value
    discount_type: Mapped[DiscountType] = mapped_column(
        SAEnum(DiscountType, name="discount_type_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    value: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )  # INR for fixed; percent for percentage

    # Scope
    scope: Mapped[DiscountScope] = mapped_column(
        SAEnum(DiscountScope, name="discount_scope_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DiscountScope.SUBSCRIPTION,
    )

    # Recurrence behaviour
    recurrence: Mapped[DiscountRecurrence] = mapped_column(
        SAEnum(DiscountRecurrence, name="discount_recurrence_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DiscountRecurrence.ONCE,
    )

    # Eligibility conditions
    minimum_purchase: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )  # invoice subtotal must be >= this
    minimum_quantity: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # total units on relevant lines must be >= this

    # Validity window
    starts_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Global usage limit (across all subscriptions/customers)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Per-customer usage limit (enforced per subscription_discount row)
    per_customer_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Stacking: when True, this discount can be combined with others on the same invoice
    allow_stacking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Priority: lower number = applied first; used for ordering when multiple discounts apply
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # State
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Audit
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_discounts_created_by_users"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    discount_products: Mapped[list[DiscountProduct]] = relationship(
        "DiscountProduct",
        back_populates="discount",
        cascade="all, delete-orphan",
    )
    discount_plans: Mapped[list[DiscountPlan]] = relationship(
        "DiscountPlan",
        back_populates="discount",
        cascade="all, delete-orphan",
    )
    subscription_discounts: Mapped[list[SubscriptionDiscount]] = relationship(
        "SubscriptionDiscount",
        back_populates="discount",
    )
    invoice_discounts: Mapped[list[InvoiceDiscount]] = relationship(
        "InvoiceDiscount",
        back_populates="discount",
    )

    __table_args__ = (
        # percentage value must be 0–100
        CheckConstraint(
            "(discount_type != 'percentage') OR (value >= 0 AND value <= 100)",
            name="ck_discount_percentage_range",
        ),
        # fixed value must be non-negative
        CheckConstraint("value >= 0", name="ck_discount_value_nonneg"),
        # usage_count must not exceed usage_limit (when set)
        CheckConstraint(
            "usage_limit IS NULL OR usage_count <= usage_limit",
            name="ck_discount_usage_count",
        ),
        # ends_at must be after starts_at when both are set
        CheckConstraint(
            "starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at",
            name="ck_discount_date_window",
        ),
        Index("ix_discount_is_active", "is_active"),
        Index("ix_discount_scope", "scope"),
        Index("ix_discount_starts_ends", "starts_at", "ends_at"),
        Index("ix_discount_priority", "priority"),
    )


# ---------------------------------------------------------------------------
# discount_products  (product-scoped eligibility)
# ---------------------------------------------------------------------------

class DiscountProduct(Base):
    """
    Scopes a discount to one or more specific products.
    Only used when Discount.scope == DiscountScope.PRODUCT.
    """

    __tablename__ = "discount_products"

    discount_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("discounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        # ForeignKey("products.id", ondelete="CASCADE"),  # soft ref; products table may not exist yet
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    discount: Mapped[Discount] = relationship("Discount", back_populates="discount_products")

    __table_args__ = (
        Index("ix_dp_discount_id", "discount_id"),
        Index("ix_dp_product_id", "product_id"),
    )


# ---------------------------------------------------------------------------
# discount_plans  (plan-scoped eligibility)
# ---------------------------------------------------------------------------

class DiscountPlan(Base):
    """
    Scopes a discount to one or more specific plans.
    Only used when Discount.scope == DiscountScope.PLAN.
    """

    __tablename__ = "discount_plans"

    discount_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("discounts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        # ForeignKey("plans.id", ondelete="CASCADE"),  # soft ref
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    discount: Mapped[Discount] = relationship("Discount", back_populates="discount_plans")

    __table_args__ = (
        Index("ix_dpl_discount_id", "discount_id"),
        Index("ix_dpl_plan_id", "plan_id"),
    )


# ---------------------------------------------------------------------------
# subscription_discounts
# ---------------------------------------------------------------------------

class SubscriptionDiscount(Base):
    """
    Assignment of a discount to a specific subscription.

    This is the "pending" state — the discount will be applied to the
    subscription's next eligible invoice (or repeatedly, depending on
    the recurrence setting).

    Lifecycle
    ---------
    - Created when a staff/admin assigns a discount to a subscription.
    - times_applied incremented (atomically, in the same invoice-creation
      transaction) each time the billing engine applies it.
    - is_active set to False when:
        * recurrence=once and times_applied reaches 1
        * recurrence=repeating and times_applied reaches max_applications
        * the discount's ends_at has passed
        * staff/admin manually deactivates it
    - Discount.usage_count also incremented atomically.
    """

    __tablename__ = "subscription_discounts"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    discount_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("discounts.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # How many times the billing engine has applied this discount
    times_applied: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # For repeating discounts: max times to apply (NULL = unlimited / follow Discount.recurrence)
    max_applications: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Per-customer usage count for this specific assignment
    per_customer_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Whether this assignment is still eligible to be applied
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # When the discount was assigned to this subscription
    applied_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # When it was deactivated (NULL = still active)
    deactivated_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Who assigned it
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_subscription_discounts_assigned_by_users"),
        nullable=True,
    )

    # Relationships
    discount: Mapped[Discount] = relationship(
        "Discount", back_populates="subscription_discounts"
    )

    __table_args__ = (
        # A discount can only be actively assigned once per subscription at a time
        UniqueConstraint(
            "subscription_id",
            "discount_id",
            name="uq_sub_discount_active",
        ),
        Index("ix_sub_disc_subscription_id", "subscription_id"),
        Index("ix_sub_disc_discount_id", "discount_id"),
        Index("ix_sub_disc_is_active", "is_active"),
        CheckConstraint("times_applied >= 0", name="ck_sub_disc_times_applied"),
        CheckConstraint("per_customer_usage >= 0", name="ck_sub_disc_per_customer_usage"),
    )


# ---------------------------------------------------------------------------
# invoice_discounts
# ---------------------------------------------------------------------------

class InvoiceDiscount(Base):
    """
    Immutable snapshot of a discount applied to an invoice.

    Written once during invoice creation/confirmation and never updated.
    Even if the Discount row changes later, this snapshot preserves the
    exact amount deducted on the invoice, so historical totals remain accurate.

    One invoice may have multiple InvoiceDiscount rows (one per discount applied).
    """

    __tablename__ = "invoice_discounts"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE", use_alter=True, name="fk_invoice_discounts_invoice_id"),
        nullable=False,
    )
    # NULL allowed: discount may have been deleted; the amount is what matters
    discount_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("discounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    subscription_discount_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        # FK to subscription_discounts.id — soft ref to avoid circular import
        nullable=True,
    )

    # Human-readable description for the invoice line (snapshotted at creation time)
    description: Mapped[str] = mapped_column(String(300), nullable=False)

    # Snapshotted discount metadata
    discount_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False)  # fixed | percentage
    discount_value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Actual amount deducted (always positive, in INR)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Snapshotted scope at the time of application
    scope: Mapped[str] = mapped_column(String(30), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    discount: Mapped[Discount | None] = relationship(
        "Discount", back_populates="invoice_discounts"
    )

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_invoice_discount_amount_nonneg"),
        Index("ix_inv_disc_invoice_id", "invoice_id"),
        Index("ix_inv_disc_discount_id", "discount_id"),
    )

