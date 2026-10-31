"""
Pydantic v2 schemas for the Discount Service.

All monetary fields use Decimal for exact arithmetic.
All response schemas use model_config = ConfigDict(from_attributes=True)
so they can be built directly from SQLAlchemy ORM instances.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.discounts.models import DiscountRecurrence, DiscountScope, DiscountType


# ---------------------------------------------------------------------------
# Discount CRUD schemas
# ---------------------------------------------------------------------------

class DiscountCreate(BaseModel):
    """Request body for POST /discounts."""

    code: Annotated[str, Field(min_length=1, max_length=80, description="Unique coupon/discount code (case-insensitive stored as upper)")]
    name: Annotated[str, Field(min_length=1, max_length=200)]
    description: str | None = None

    discount_type: DiscountType
    value: Annotated[Decimal, Field(gt=Decimal("0"), decimal_places=2, description="Percent (0-100) for percentage type; INR amount for fixed type")]

    scope: DiscountScope = DiscountScope.SUBSCRIPTION
    recurrence: DiscountRecurrence = DiscountRecurrence.ONCE

    minimum_purchase: Annotated[Decimal | None, Field(default=None, ge=Decimal("0"), description="Minimum invoice subtotal in INR for eligibility")]
    minimum_quantity: Annotated[int | None, Field(default=None, ge=1, description="Minimum total item quantity for eligibility")]

    starts_at: datetime | None = None
    ends_at: datetime | None = None

    usage_limit: Annotated[int | None, Field(default=None, ge=1, description="Maximum total redemptions across all customers")]
    per_customer_limit: Annotated[int | None, Field(default=None, ge=1, description="Maximum redemptions per customer")]

    allow_stacking: bool = False
    priority: Annotated[int, Field(default=10, ge=1, le=100, description="Lower = applied first when multiple discounts exist")]

    is_active: bool = True

    # Scope targets (used when scope = product or plan)
    product_ids: list[uuid.UUID] = Field(default_factory=list, description="Product UUIDs this discount applies to (when scope=product)")
    plan_ids: list[uuid.UUID] = Field(default_factory=list, description="Plan UUIDs this discount applies to (when scope=plan)")

    @field_validator("code")
    @classmethod
    def normalise_code(cls, v: str) -> str:
        return v.strip().upper()

    @model_validator(mode="after")
    def validate_percentage_range(self) -> "DiscountCreate":
        if self.discount_type == DiscountType.PERCENTAGE and not (0 < self.value <= 100):
            raise ValueError("Percentage discount value must be between 0 (exclusive) and 100 (inclusive).")
        return self

    @model_validator(mode="after")
    def validate_date_window(self) -> "DiscountCreate":
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at.")
        return self

    @model_validator(mode="after")
    def validate_scope_targets(self) -> "DiscountCreate":
        if self.scope == DiscountScope.PRODUCT and not self.product_ids:
            raise ValueError("At least one product_id is required when scope is 'product'.")
        if self.scope == DiscountScope.PLAN and not self.plan_ids:
            raise ValueError("At least one plan_id is required when scope is 'plan'.")
        return self


class DiscountUpdate(BaseModel):
    """Request body for PATCH /discounts/{id}. All fields optional."""

    name: Annotated[str | None, Field(default=None, min_length=1, max_length=200)]
    description: str | None = None
    value: Annotated[Decimal | None, Field(default=None, gt=Decimal("0"), decimal_places=2)]
    scope: DiscountScope | None = None
    recurrence: DiscountRecurrence | None = None
    minimum_purchase: Decimal | None = None
    minimum_quantity: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = None
    per_customer_limit: int | None = None
    allow_stacking: bool | None = None
    priority: Annotated[int | None, Field(default=None, ge=1, le=100)]
    is_active: bool | None = None

    # Scope targets — when provided, fully replace existing assignments
    product_ids: list[uuid.UUID] | None = None
    plan_ids: list[uuid.UUID] | None = None

    @model_validator(mode="after")
    def validate_percentage_range(self) -> "DiscountUpdate":
        # Can only validate if we know the type; partial updates may not send it
        if self.value is not None and self.value <= 0:
            raise ValueError("Discount value must be positive.")
        return self

    @model_validator(mode="after")
    def validate_date_window(self) -> "DiscountUpdate":
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at.")
        return self


class DiscountProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    discount_id: uuid.UUID
    product_id: uuid.UUID
    created_at: datetime


class DiscountPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    discount_id: uuid.UUID
    plan_id: uuid.UUID
    created_at: datetime


class DiscountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    discount_type: DiscountType
    value: Decimal
    scope: DiscountScope
    recurrence: DiscountRecurrence
    minimum_purchase: Decimal | None
    minimum_quantity: int | None
    starts_at: datetime | None
    ends_at: datetime | None
    usage_limit: int | None
    usage_count: int
    per_customer_limit: int | None
    allow_stacking: bool
    priority: int
    is_active: bool
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    discount_products: list[DiscountProductResponse] = []
    discount_plans: list[DiscountPlanResponse] = []


class DiscountListResponse(BaseModel):
    items: list[DiscountResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Subscription discount schemas
# ---------------------------------------------------------------------------

class SubscriptionDiscountAssign(BaseModel):
    """Request body: assign a discount to a subscription."""

    discount_id: uuid.UUID
    max_applications: Annotated[int | None, Field(default=None, ge=1, description="Override max applications for repeating discounts. None = follow discount recurrence.")]


class SubscriptionDiscountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_id: uuid.UUID
    discount_id: uuid.UUID
    times_applied: int
    max_applications: int | None
    per_customer_usage: int
    is_active: bool
    applied_at: datetime
    deactivated_at: datetime | None
    assigned_by: uuid.UUID | None

    # Nested discount summary
    discount: DiscountResponse | None = None


class SubscriptionDiscountListResponse(BaseModel):
    items: list[SubscriptionDiscountResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Invoice discount schemas
# ---------------------------------------------------------------------------

class InvoiceDiscountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    discount_id: uuid.UUID | None
    subscription_discount_id: uuid.UUID | None
    description: str
    discount_code: str | None
    discount_type: str
    discount_value: Decimal
    amount: Decimal
    scope: str
    created_at: datetime


class InvoiceDiscountListResponse(BaseModel):
    items: list[InvoiceDiscountResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Discount eligibility / calculation schemas
# ---------------------------------------------------------------------------

class DiscountEligibilityRequest(BaseModel):
    """Check whether a discount code is eligible for a given context."""

    code: str
    subscription_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    invoice_subtotal: Annotated[Decimal, Field(gt=Decimal("0"), description="Invoice subtotal in INR before discounts")]
    total_quantity: Annotated[int, Field(ge=0, default=0, description="Total item quantity on the invoice")]
    plan_ids: list[uuid.UUID] = Field(default_factory=list)
    product_ids: list[uuid.UUID] = Field(default_factory=list)


class DiscountApplicationResult(BaseModel):
    """Result of applying a single discount to a subtotal."""

    discount_id: uuid.UUID
    discount_code: str
    discount_name: str
    discount_type: str
    discount_value: Decimal
    scope: str
    amount_deducted: Decimal       # Actual INR amount deducted
    subtotal_before: Decimal
    subtotal_after: Decimal
    is_eligible: bool
    ineligibility_reason: str | None = None


class DiscountEligibilityResponse(BaseModel):
    """Response from the eligibility check endpoint."""

    code: str
    discount: DiscountResponse | None
    is_eligible: bool
    ineligibility_reason: str | None
    preview_amount_deducted: Decimal | None  # Computed deduction if eligible


class MultiDiscountApplicationRequest(BaseModel):
    """Apply multiple eligible discounts to a subscription invoice."""

    subscription_id: uuid.UUID
    invoice_subtotal: Annotated[Decimal, Field(gt=Decimal("0"))]
    total_quantity: int = 0
    plan_ids: list[uuid.UUID] = Field(default_factory=list)
    product_ids: list[uuid.UUID] = Field(default_factory=list)
    commit: bool = Field(default=False, description="If True, atomically increment usage counters. If False, dry-run preview only.")


class MultiDiscountApplicationResponse(BaseModel):
    """Result of applying all eligible discounts to an invoice subtotal."""

    subscription_id: uuid.UUID
    invoice_subtotal: Decimal
    applied_discounts: list[DiscountApplicationResult]
    total_discount_amount: Decimal
    final_subtotal: Decimal
    committed: bool   # True if usage counters were incremented

