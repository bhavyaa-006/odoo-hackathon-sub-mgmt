"""
Pydantic v2 schemas for the Tax Service.

All monetary fields use Decimal to preserve precision.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.taxes.models import TaxType, TransactionType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decimal_ge_zero(v: Any) -> Decimal:
    d = Decimal(str(v))
    if d < Decimal("0"):
        raise ValueError("Value must be >= 0")
    return d


# ---------------------------------------------------------------------------
# TaxRule schemas
# ---------------------------------------------------------------------------

class TaxRuleCreate(BaseModel):
    """Request body for POST /taxes."""

    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    tax_type: TaxType = TaxType.GST
    gst_rate: Decimal = Field(..., ge=Decimal("0"), le=Decimal("100"))
    cgst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    sgst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    igst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    sac_code: str | None = Field(None, max_length=10)
    hsn_code: str | None = Field(None, max_length=10)
    is_active: bool = True
    is_default: bool = False
    applies_to_products: bool = True
    applies_to_plans: bool = True

    @model_validator(mode="after")
    def _check_rates_consistency(self) -> "TaxRuleCreate":
        """Auto-derive CGST/SGST/IGST rates when they are not supplied."""
        gst = self.gst_rate
        if gst and gst > 0:
            half = (gst / Decimal("2")).quantize(Decimal("0.0001"))
            if self.cgst_rate is None:
                self.cgst_rate = half
            if self.sgst_rate is None:
                self.sgst_rate = half
            if self.igst_rate is None:
                self.igst_rate = gst
        return self


class TaxRuleUpdate(BaseModel):
    """Request body for PATCH /taxes/{id} — all fields optional."""

    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = None
    tax_type: TaxType | None = None
    gst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    cgst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    sgst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    igst_rate: Decimal | None = Field(None, ge=Decimal("0"), le=Decimal("100"))
    sac_code: str | None = Field(None, max_length=10)
    hsn_code: str | None = Field(None, max_length=10)
    is_active: bool | None = None
    is_default: bool | None = None
    applies_to_products: bool | None = None
    applies_to_plans: bool | None = None


class TaxRuleResponse(BaseModel):
    """Full response shape for a single TaxRule."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    tax_type: TaxType
    gst_rate: Decimal
    cgst_rate: Decimal | None
    sgst_rate: Decimal | None
    igst_rate: Decimal | None
    sac_code: str | None
    hsn_code: str | None
    is_active: bool
    is_default: bool
    applies_to_products: bool
    applies_to_plans: bool
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class TaxRuleListResponse(BaseModel):
    """Paginated list of tax rules."""

    items: list[TaxRuleResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Calculation request / response schemas
# ---------------------------------------------------------------------------

class TaxCalculationRequest(BaseModel):
    """
    Request body for POST /taxes/calculate.

    Either supply a `tax_rule_id` to use a specific rule, or leave it None to
    use the platform default rule.
    """

    taxable_amount: Decimal = Field(..., gt=Decimal("0"))
    tax_rule_id: uuid.UUID | None = None
    supplier_gstin: str | None = Field(None, max_length=15)
    customer_gstin: str | None = Field(None, max_length=15)
    customer_state_code: str | None = Field(
        None,
        min_length=2,
        max_length=2,
        description="2-digit Indian state code (alternative to customer GSTIN)",
    )
    is_export: bool = False
    is_rcm: bool = False
    reference_type: str | None = Field(None, max_length=50)
    reference_id: uuid.UUID | None = None
    save_log: bool = Field(
        True,
        description="Set False for preview calculations that should not be logged.",
    )


class TaxBreakdown(BaseModel):
    """
    Detailed tax breakdown returned from a calculation.
    All monetary values in INR using Decimal.
    """

    model_config = ConfigDict(from_attributes=True)

    tax_rule_id: uuid.UUID | None = None
    tax_rule_name: str | None = None
    sac_code: str | None = None
    transaction_type: TransactionType
    place_of_supply: str | None = None
    supplier_state_code: str | None = None
    customer_state_code: str | None = None

    # Input
    taxable_amount: Decimal

    # CGST component (intrastate only)
    cgst_rate: Decimal = Decimal("0")
    cgst_amount: Decimal = Decimal("0")

    # SGST component (intrastate only)
    sgst_rate: Decimal = Decimal("0")
    sgst_amount: Decimal = Decimal("0")

    # IGST component (interstate only)
    igst_rate: Decimal = Decimal("0")
    igst_amount: Decimal = Decimal("0")

    # Totals
    total_tax_amount: Decimal
    total_with_tax: Decimal
    rounded_total: Decimal  # nearest whole rupee, ROUND_HALF_UP

    is_rcm: bool = False


class TaxCalculationResponse(BaseModel):
    """Response envelope for POST /taxes/calculate."""

    calculation_log_id: uuid.UUID | None = None  # None when save_log=False
    breakdown: TaxBreakdown


class TaxCalculationLogResponse(BaseModel):
    """Response shape for a single saved TaxCalculation log row."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference_type: str
    reference_id: uuid.UUID | None
    tax_rule_id: uuid.UUID | None
    supplier_gstin: str | None
    customer_gstin: str | None
    supplier_state_code: str | None
    customer_state_code: str | None
    place_of_supply: str | None
    transaction_type: TransactionType
    taxable_amount: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal
    total_with_tax: Decimal
    is_rcm: bool
    calculated_at: datetime
    notes: str | None


class TaxCalculationListResponse(BaseModel):
    """Paginated list of saved calculation log entries."""

    items: list[TaxCalculationLogResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# GSTIN validation
# ---------------------------------------------------------------------------

class GSTINValidationRequest(BaseModel):
    """Request body / query schema for GSTIN validation."""

    gstin: str = Field(..., min_length=15, max_length=15)


class GSTINValidationResponse(BaseModel):
    """Result of GSTIN validation."""

    gstin: str
    is_valid: bool
    state_code: str | None = None
    state_name: str | None = None
    error_message: str | None = None


# ---------------------------------------------------------------------------
# State code lookup
# ---------------------------------------------------------------------------

class StateCodeEntry(BaseModel):
    code: str
    name: str


class StateCodeLookupResponse(BaseModel):
    """All Indian state codes and names."""

    state_codes: list[StateCodeEntry]

