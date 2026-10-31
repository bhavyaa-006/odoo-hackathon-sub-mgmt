"""Request and response contracts for the plan management API."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.plans.models import BillingInterval

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
_ISO_CURRENCY_CHARS = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _validate_currency(value: str) -> str:
    """Enforce exactly three uppercase ASCII letters (ISO 4217 format)."""
    value = value.strip().upper()
    if len(value) != 3 or not all(ch in _ISO_CURRENCY_CHARS for ch in value):
        raise ValueError("currency must be a 3-letter ISO 4217 code (e.g. USD, EUR, GBP)")
    return value


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(min_length=3, max_length=3)
    billing_interval: BillingInterval
    interval_count: int = Field(default=1, ge=1)
    min_quantity: int = Field(default=1, ge=1)
    available_from: date | None = None
    available_until: date | None = None
    auto_close: bool = False
    allow_early_close: bool = False
    allow_pause: bool = True
    allow_renew: bool = True
    is_active: bool = True
    product_ids: list[str] = Field(default_factory=list)

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return _validate_currency(value)

    @field_validator("product_ids")
    @classmethod
    def product_ids_must_be_unique(cls, ids: list[str]) -> list[str]:
        if len(ids) != len(set(ids)):
            raise ValueError("product_ids must not contain duplicates")
        return ids

    @model_validator(mode="after")
    def validate_date_range(self) -> "PlanCreate":
        if (
            self.available_from is not None
            and self.available_until is not None
            and self.available_until < self.available_from
        ):
            raise ValueError("available_until must not be earlier than available_from")
        return self


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_interval: BillingInterval | None = None
    interval_count: int | None = Field(default=None, ge=1)
    min_quantity: int | None = Field(default=None, ge=1)
    available_from: date | None = None
    available_until: date | None = None
    auto_close: bool | None = None
    allow_early_close: bool | None = None
    allow_pause: bool | None = None
    allow_renew: bool | None = None
    is_active: bool | None = None
    product_ids: list[str] | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_currency(value)

    @field_validator("product_ids")
    @classmethod
    def product_ids_must_be_unique(cls, ids: list[str] | None) -> list[str] | None:
        if ids is None:
            return None
        if len(ids) != len(set(ids)):
            raise ValueError("product_ids must not contain duplicates")
        return ids


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class PlanProductSummary(BaseModel):
    """Minimal product info embedded in a plan response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: str


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    price: Decimal
    currency: str
    billing_interval: BillingInterval
    interval_count: int
    min_quantity: int
    available_from: date | None
    available_until: date | None
    auto_close: bool
    allow_early_close: bool
    allow_pause: bool
    allow_renew: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    products: list[PlanProductSummary] = []


class PlanPage(BaseModel):
    items: list[PlanResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Availability sub-schemas
# ---------------------------------------------------------------------------

class AvailabilityRequest(BaseModel):
    """Date for which availability should be checked. Defaults to today."""

    check_date: date | None = None


class AvailabilityResponse(BaseModel):
    plan_id: str
    check_date: date
    is_available: bool
    reason: str | None = None


# ---------------------------------------------------------------------------
# Price breakdown sub-schemas
# ---------------------------------------------------------------------------

class PriceRequest(BaseModel):
    quantity: int = Field(default=1, ge=1)


class PriceResponse(BaseModel):
    plan_id: str
    unit_price: Decimal
    currency: str
    quantity: int
    total_price: Decimal
    billing_interval: BillingInterval
    interval_count: int
