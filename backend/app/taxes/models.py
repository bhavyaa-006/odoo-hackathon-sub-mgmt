"""
SQLAlchemy 2.x ORM models for the Tax Service.

Tables:
  - tax_rules                    Admin-configurable GST rule definitions
  - tax_rule_product_assignments  Optional scoping of a rule to specific products
  - tax_calculations             Immutable audit log of every tax calculation event
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Enum as SAEnum,
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
# Enums
# ---------------------------------------------------------------------------

class TaxType(str, enum.Enum):
    """High-level category / structure of the tax rule."""
    GST = "GST"            # Generic GST — split applied dynamically
    IGST = "IGST"          # Interstate GST (single rate, no split)
    CGST_SGST = "CGST_SGST"  # Intrastate split (CGST + SGST)
    EXEMPT = "EXEMPT"      # No tax (e.g., exempted services)
    ZERO_RATED = "ZERO_RATED"  # Zero-rated (e.g., exports)


class TransactionType(str, enum.Enum):
    """Determined at calculation time based on supply geography."""
    INTRASTATE = "INTRASTATE"
    INTERSTATE = "INTERSTATE"
    EXPORT = "EXPORT"
    EXEMPT = "EXEMPT"


# ---------------------------------------------------------------------------
# tax_rules
# ---------------------------------------------------------------------------

class TaxRule(Base):
    """
    Admin-configurable GST rule.

    One row describes a GST configuration (rate, type, SAC code) that can be
    assigned to products/plans or used as the global default.
    """

    __tablename__ = "tax_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tax type / structure
    tax_type: Mapped[TaxType] = mapped_column(
        SAEnum(TaxType, name="tax_type_enum", create_type=True),
        nullable=False,
        default=TaxType.GST,
    )

    # Rates stored with 4 decimal places (e.g., 18.0000, 9.0000)
    gst_rate: Mapped[float] = mapped_column(
        Numeric(12, 4), nullable=False, default=0
    )
    cgst_rate: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    sgst_rate: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    igst_rate: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)

    # Classification
    sac_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    hsn_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Flags
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    applies_to_products: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    applies_to_plans: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

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
    product_assignments: Mapped[list[TaxRuleProductAssignment]] = relationship(
        "TaxRuleProductAssignment",
        back_populates="tax_rule",
        cascade="all, delete-orphan",
    )
    calculations: Mapped[list[TaxCalculation]] = relationship(
        "TaxCalculation",
        back_populates="tax_rule",
    )

    __table_args__ = (
        Index("ix_tax_rules_is_active", "is_active"),
        Index("ix_tax_rules_is_default", "is_default"),
        Index("ix_tax_rules_sac_code", "sac_code"),
    )


# ---------------------------------------------------------------------------
# tax_rule_product_assignments
# ---------------------------------------------------------------------------

class TaxRuleProductAssignment(Base):
    """
    Optional junction table that scopes a TaxRule to a specific product.
    When no row exists for a product, the default rule applies.
    """

    __tablename__ = "tax_rule_product_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tax_rule_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tax_rules.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        # FK to products.id — soft reference; products table may not exist yet
        # ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # Relationships
    tax_rule: Mapped[TaxRule] = relationship(
        "TaxRule", back_populates="product_assignments"
    )

    __table_args__ = (
        Index(
            "ix_trpa_tax_rule_product",
            "tax_rule_id",
            "product_id",
            unique=True,
        ),
    )


# ---------------------------------------------------------------------------
# tax_calculations
# ---------------------------------------------------------------------------

class TaxCalculation(Base):
    """
    Immutable audit log of every tax calculation event.

    Written once; never updated.  Used for invoice integrity checks and
    GST return reconciliation.
    """

    __tablename__ = "tax_calculations"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # What triggered the calculation
    reference_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="preview"
    )  # e.g. 'invoice_item', 'subscription_item', 'preview'
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )

    # Which rule was used
    tax_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tax_rules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Party GSTINs / state codes
    supplier_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    customer_gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    supplier_state_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    customer_state_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    place_of_supply: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # Transaction classification
    transaction_type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType, name="transaction_type_enum", create_type=True),
        nullable=False,
    )

    # Amounts (all in INR, 2 decimal places)
    taxable_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cgst_rate: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sgst_rate: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    igst_rate: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total_with_tax: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Reverse charge mechanism flag
    is_rcm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Metadata
    calculated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    tax_rule: Mapped[TaxRule | None] = relationship(
        "TaxRule", back_populates="calculations"
    )

    __table_args__ = (
        Index("ix_tax_calc_reference", "reference_type", "reference_id"),
        Index("ix_tax_calc_tax_rule_id", "tax_rule_id"),
        Index("ix_tax_calc_calculated_at", "calculated_at"),
        Index("ix_tax_calc_transaction_type", "transaction_type"),
    )

