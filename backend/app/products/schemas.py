"""Request and response contracts for the product catalogue API."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.products.models import ProductStatus, ProductType


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    product_type: ProductType
    sales_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    cost_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    description: str | None = Field(default=None, max_length=10_000)
    status: ProductStatus = ProductStatus.DRAFT

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    product_type: ProductType | None = None
    sales_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    cost_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    description: str | None = Field(default=None, max_length=10_000)
    status: ProductStatus | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class VariantCreate(BaseModel):
    attribute_name: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)
    price_adjustment: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)

    @field_validator("attribute_name", "value", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class VariantUpdate(BaseModel):
    attribute_name: str | None = Field(default=None, min_length=1, max_length=100)
    value: str | None = Field(default=None, min_length=1, max_length=100)
    price_adjustment: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    is_active: bool | None = None

    @field_validator("attribute_name", "value", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class VariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    attribute_name: str
    value: str
    price_adjustment: Decimal
    is_active: bool
    effective_sales_price: Decimal
    created_at: datetime
    updated_at: datetime


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_type: ProductType
    sales_price: Decimal
    description: str | None
    status: ProductStatus
    created_at: datetime
    updated_at: datetime
    variants: list[VariantResponse] = []


class InternalProductResponse(ProductResponse):
    cost_price: Decimal


class ProductPage(BaseModel):
    items: list[ProductResponse | InternalProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PriceRequest(BaseModel):
    variant_ids: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("variant_ids")
    @classmethod
    def variant_ids_must_be_unique(cls, ids: list[str]) -> list[str]:
        if len(ids) != len(set(ids)):
            raise ValueError("variant_ids must not contain duplicates")
        return ids


class PriceAdjustmentResponse(BaseModel):
    variant_id: str
    attribute_name: str
    value: str
    price_adjustment: Decimal


class PriceResponse(BaseModel):
    product_id: str
    base_sales_price: Decimal
    variant_adjustments: list[PriceAdjustmentResponse]
    final_sales_price: Decimal
