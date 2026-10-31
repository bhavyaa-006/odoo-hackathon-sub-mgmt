"""
Pydantic v2 schemas for the Billing & Invoice Service.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.billing.models import (
    BillingRunItemStatus,
    BillingRunStatus,
    InvoiceKind,
    InvoiceStatus,
)


# ---------------------------------------------------------------------------
# Invoice Item schemas
# ---------------------------------------------------------------------------

class InvoiceItemCreate(BaseModel):
    """Used when staff manually creates an invoice item."""
    description: str = Field(min_length=1, max_length=500)
    product_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None
    quantity: Decimal = Field(default=Decimal("1"), gt=Decimal("0"))
    unit_price: Decimal = Field(ge=Decimal("0"))
    tax_rule_id: uuid.UUID | None = None
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    description: str
    product_id: uuid.UUID | None
    plan_id: uuid.UUID | None
    quantity: Decimal
    unit_price: Decimal
    line_subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")
    created_at: datetime


# ---------------------------------------------------------------------------
# Invoice schemas
# ---------------------------------------------------------------------------

class InvoiceCreate(BaseModel):
    """Staff/admin manual invoice creation."""
    subscription_id: uuid.UUID | None = None
    customer_id: uuid.UUID
    kind: InvoiceKind = InvoiceKind.MANUAL
    issue_date: date
    due_date: date | None = None
    payment_term_days: int = Field(default=0, ge=0, le=365)
    period_start: date | None = None
    period_end: date | None = None
    currency: str = Field(default="INR", min_length=3, max_length=3)
    supplier_gstin: str | None = None
    customer_gstin: str | None = None
    tax_rule_id: uuid.UUID | None = None
    items: list[InvoiceItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_period(self) -> "InvoiceCreate":
        if self.period_start and self.period_end and self.period_end < self.period_start:
            raise ValueError("period_end must be >= period_start.")
        if self.due_date and self.due_date < self.issue_date:
            raise ValueError("due_date must be >= issue_date.")
        return self


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_number: str
    subscription_id: uuid.UUID | None
    customer_id: uuid.UUID
    kind: InvoiceKind
    status: InvoiceStatus
    issue_date: date
    due_date: date | None
    period_start: date | None
    period_end: date | None
    subtotal: Decimal
    discount_total: Decimal
    taxable_total: Decimal
    cgst_total: Decimal
    sgst_total: Decimal
    igst_total: Decimal
    tax_total: Decimal
    total: Decimal
    amount_paid: Decimal
    outstanding: Decimal = Decimal("0")   # computed field, set in service
    currency: str
    payment_term_days: int
    supplier_gstin: str | None
    customer_gstin: str | None
    place_of_supply: str | None
    is_igst: bool
    is_rcm: bool
    has_anomaly: bool
    anomaly_notes: str | None
    is_overdue: bool = False              # derived: due_date passed + outstanding > 0
    confirmed_at: datetime | None
    paid_at: datetime | None
    voided_at: datetime | None
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None
    items: list[InvoiceItemResponse] = []


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int
    page: int
    page_size: int


class InvoiceVoidRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=300)


class InvoiceConfirmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    invoice: InvoiceResponse
    message: str = "Invoice confirmed."


# ---------------------------------------------------------------------------
# Billing Run schemas
# ---------------------------------------------------------------------------

class BillingRunRequest(BaseModel):
    """POST /billing/runs"""
    as_of_date: date = Field(description="Bill all subscriptions due on or before this date.")
    dry_run: bool = Field(
        default=False,
        description="If true, calculate everything but write nothing. Returns preview.",
    )
    subscription_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="Optional: limit run to specific subscriptions. None = all eligible.",
    )


class BillingRunItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    billing_run_id: uuid.UUID
    subscription_id: uuid.UUID
    period_start: date
    period_end: date
    status: BillingRunItemStatus
    invoice_id: uuid.UUID | None
    has_anomaly: bool
    anomaly_notes: str | None
    error_message: str | None
    created_at: datetime


class BillingRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_key: str
    as_of_date: date
    is_dry_run: bool
    status: BillingRunStatus
    started_at: datetime
    completed_at: datetime | None
    processed_count: int
    success_count: int
    duplicate_count: int
    skipped_count: int
    error_count: int
    error_summary: str | None
    triggered_by: uuid.UUID | None
    items: list[BillingRunItemResponse] = []


class BillingRunListResponse(BaseModel):
    items: list[BillingRunResponse]
    total: int
    page: int
    page_size: int

