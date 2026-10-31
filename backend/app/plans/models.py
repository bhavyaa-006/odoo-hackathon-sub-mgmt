"""Subscription plan persistence models.

Plans sit between products and subscriptions in the workflow:
  Products → Plans → Quotations → Subscriptions → Billing → Invoices

A plan captures pricing, billing cadence, availability windows, and lifecycle
flags.  It may optionally reference one or more products via the plan_products
association table.

Historical correctness: subscription items and invoice items snapshot their own
unit_price and currency at creation time so that edits to a plan never affect
past records.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _enum_values(enum_class: type[Enum]) -> list[str]:
    return [member.value for member in enum_class]


class BillingInterval(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


# ---------------------------------------------------------------------------
# plan_products — many-to-many association table
# ---------------------------------------------------------------------------
# Composite PK, no extra columns.  SQLAlchemy Core Table (not a mapped class)
# keeps this simple; upgrade to an association object if additional columns
# (e.g. sort_order, quantity) are ever needed.
# ---------------------------------------------------------------------------
plan_products = Table(
    "plan_products",
    Base.metadata,
    Column(
        "plan_id",
        String(36),
        ForeignKey("plans.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Column(
        "product_id",
        String(36),
        ForeignKey("products.id", ondelete="RESTRICT"),
        primary_key=True,
        nullable=False,
    ),
)


class Plan(Base):
    __tablename__ = "plans"

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Pricing
    # ------------------------------------------------------------------
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, index=True)

    # ------------------------------------------------------------------
    # Billing cadence
    # ------------------------------------------------------------------
    billing_interval: Mapped[BillingInterval] = mapped_column(
        SqlEnum(
            BillingInterval,
            name="billing_interval",
            native_enum=False,
            create_constraint=True,
            values_callable=_enum_values,
        ),
        nullable=False,
        index=True,
    )
    interval_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # ------------------------------------------------------------------
    # Quantity constraint
    # ------------------------------------------------------------------
    min_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # ------------------------------------------------------------------
    # Availability window
    # ------------------------------------------------------------------
    available_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    available_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ------------------------------------------------------------------
    # Lifecycle flags
    # ------------------------------------------------------------------
    auto_close: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allow_early_close: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allow_pause: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    allow_renew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    # ------------------------------------------------------------------
    # Audit timestamps
    # ------------------------------------------------------------------
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    products: Mapped[list["Product"]] = relationship(  # type: ignore[name-defined]
        "Product",
        secondary=plan_products,
        lazy="selectin",
        passive_deletes=True,
    )
