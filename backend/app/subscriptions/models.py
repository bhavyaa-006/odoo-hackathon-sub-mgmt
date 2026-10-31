"""
SQLAlchemy 2.x ORM models for Subscriptions and Subscription Line Items.

Tables:
- subscriptions: Master subscription contracts with lifecycle statuses
- subscription_items: Line items attached to a subscription (products/quantities)
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubscriptionStatus(str, enum.Enum):
    DRAFT = "draft"
    QUOTATION = "quotation"
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"


class BillingCadence(str, enum.Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"


class Subscription(Base):
    """Master subscription contract."""
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    subscription_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=SubscriptionStatus.ACTIVE.value,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
    )
    period_start: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    period_end: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    next_billing_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )
    expiry_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    payment_term_days: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        default="INR",
        nullable=False,
    )
    billing_cadence: Mapped[str] = mapped_column(
        String(20),
        default=BillingCadence.MONTH.value,
        nullable=False,
    )
    billing_interval: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    auto_renew: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    customer: Mapped[Any] = relationship("User", foreign_keys=[customer_id])
    items: Mapped[list[SubscriptionItem]] = relationship(
        "SubscriptionItem",
        back_populates="subscription",
        cascade="all, delete-orphan",
    )


class SubscriptionItem(Base):
    """Line items attached to a subscription."""
    __tablename__ = "subscription_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )
    tax_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("1"),
        nullable=False,
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    subscription: Mapped[Subscription] = relationship("Subscription", back_populates="items")
