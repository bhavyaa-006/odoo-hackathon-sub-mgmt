"""
Pydantic v2 schemas for the Payments Service.

All monetary fields use Decimal to guarantee safe arithmetic — never float.

Schema hierarchy
----------------
PaymentCreate       → record a new payment (staff/admin)
PaymentConfirmRequest → confirm a pending payment (cheque cleared etc.)
PaymentReversalRequest → reverse a confirmed payment (admin)
RefundCreate        → issue a refund against an original payment
AllocationCreate    → manually allocate a payment to a specific invoice
AllocationResponse  → read representation of an InvoicePaymentAllocation
PaymentResponse     → full payment with computed unallocated_amount + allocations
PaymentListResponse → paginated list of payments
CustomerOutstandingResponse → customer-level outstanding balance summary
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class PaymentMethod(str, enum.Enum):
    UPI = "upi"
    NEFT = "neft"
    RTGS = "rtgs"
    IMPS = "imps"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    CASH = "cash"
    OTHER = "other"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    REVERSED = "reversed"
    REFUNDED = "refunded"


# ---------------------------------------------------------------------------
# Allocation schemas
# ---------------------------------------------------------------------------

class AllocationCreate(BaseModel):
    """Request body for manually allocating a payment to a specific invoice."""

    payment_id: UUID
    invoice_id: UUID
    allocated_amount: Decimal = Field(gt=Decimal("0"), description="Amount to allocate (must be > 0)")
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("allocated_amount", mode="before")
    @classmethod
    def coerce_decimal(cls, v: object) -> Decimal:
        return Decimal(str(v))


class AllocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    payment_id: UUID
    invoice_id: UUID
    allocated_amount: Decimal
    allocated_at: datetime
    reversed_at: datetime | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Payment Create / Request schemas
# ---------------------------------------------------------------------------

class PaymentCreate(BaseModel):
    """Request body for recording a new payment from a customer."""

    customer_id: UUID
    payment_date: date
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=Decimal("0"), description="Total payment amount received (must be > 0)")
    currency: str = Field(default="INR", max_length=3)
    payment_reference: str | None = Field(
        default=None,
        max_length=200,
        description="UPI txn ID, NEFT UTR, cheque number, gateway reference etc.",
    )
    bank_name: str | None = Field(default=None, max_length=100)
    bank_account_last4: str | None = Field(
        default=None,
        description="Last 4 digits of the bank account (digits only, exactly 4 chars if provided)",
    )
    notes: str | None = None
    auto_allocate: bool = Field(
        default=True,
        description="If True, automatically apply payment to oldest unpaid invoices.",
    )
    invoice_ids: list[UUID] | None = Field(
        default=None,
        description="If provided, restrict auto-allocation to these invoice IDs in order.",
    )

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: object) -> Decimal:
        return Decimal(str(v))

    @field_validator("bank_account_last4", mode="after")
    @classmethod
    def validate_last4(cls, v: str | None) -> str | None:
        if v is not None:
            if len(v) != 4 or not v.isdigit():
                raise ValueError("bank_account_last4 must be exactly 4 digits")
        return v

    @field_validator("currency", mode="after")
    @classmethod
    def uppercase_currency(cls, v: str) -> str:
        return v.upper()


class PaymentConfirmRequest(BaseModel):
    """Request body for confirming a pending payment (e.g. cheque cleared)."""

    notes: str | None = Field(default=None, max_length=500)


class PaymentReversalRequest(BaseModel):
    """Request body for reversing a confirmed payment (admin only)."""

    reason: str = Field(min_length=1, description="Reason for reversal (required)")


class RefundCreate(BaseModel):
    """Request body for issuing a refund against an original confirmed payment."""

    original_payment_id: UUID
    amount: Decimal = Field(gt=Decimal("0"), description="Refund amount (must be > 0, <= original payment amount)")
    refund_date: date
    payment_method: PaymentMethod
    payment_reference: str | None = Field(default=None, max_length=200)
    notes: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: object) -> Decimal:
        return Decimal(str(v))


# ---------------------------------------------------------------------------
# Payment Response schemas
# ---------------------------------------------------------------------------

class PaymentResponse(BaseModel):
    """Full payment record returned by the API, including computed fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    payment_number: str
    customer_id: UUID
    payment_date: date
    payment_method: str
    status: str
    amount: Decimal
    currency: str
    payment_reference: str | None = None
    bank_name: str | None = None
    bank_account_last4: str | None = None
    notes: str | None = None
    is_refund: bool
    refund_for_payment_id: UUID | None = None
    reversed_at: datetime | None = None
    reversal_reason: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    # Computed fields — injected by service layer, not from ORM attributes directly
    unallocated_amount: Decimal = Field(default=Decimal("0.00"))
    allocations: list[AllocationResponse] = Field(default_factory=list)


class PaymentListResponse(BaseModel):
    """Paginated list of payments."""

    items: list[PaymentResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Customer Outstanding Balance
# ---------------------------------------------------------------------------

class CustomerOutstandingResponse(BaseModel):
    """Outstanding balance summary for a customer across all open invoices."""

    customer_id: UUID
    total_outstanding: Decimal
    invoice_count: int
    oldest_due_date: date | None = None

