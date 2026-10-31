"""HTTP API for product catalogue management and price previews."""

from decimal import Decimal
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import Principal, get_current_principal, require_admin
from app.database import get_session
from app.products.models import Product, ProductStatus, ProductType, ProductVariant
from app.products.schemas import (
    InternalProductResponse,
    PriceAdjustmentResponse,
    PriceRequest,
    PriceResponse,
    ProductCreate,
    ProductPage,
    ProductResponse,
    ProductUpdate,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
)
from app.products.service import ProductService

router = APIRouter(prefix="/api/v1/products", tags=["Products"])


def get_service(session: Session = Depends(get_session)) -> ProductService:
    return ProductService(session)


def _variant_response(variant: ProductVariant, base_price: Decimal) -> VariantResponse:
    return VariantResponse(
        id=variant.id,
        product_id=variant.product_id,
        attribute_name=variant.attribute_name,
        value=variant.value,
        price_adjustment=variant.price_adjustment,
        is_active=variant.is_active,
        effective_sales_price=base_price + variant.price_adjustment,
        created_at=variant.created_at,
        updated_at=variant.updated_at,
    )


def _product_response(product: Product, principal: Principal) -> ProductResponse | InternalProductResponse:
    body = {
        "id": product.id,
        "name": product.name,
        "product_type": product.product_type,
        "sales_price": product.sales_price,
        "description": product.description,
        "status": product.status,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
        "variants": [
            _variant_response(variant, product.sales_price)
            for variant in product.variants
            if principal.role != "customer" or variant.is_active
        ],
    }
    if principal.role != "customer":
        return InternalProductResponse(cost_price=product.cost_price, **body)
    return ProductResponse(**body)


@router.post("", response_model=InternalProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    service: ProductService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> InternalProductResponse:
    return _product_response(service.create_product(payload), Principal("", "admin"))


@router.get("", response_model=ProductPage)
def list_products(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    product_type: ProductType | None = None,
    status_filter: ProductStatus | None = Query(default=None, alias="status"),
    min_price: Decimal | None = Query(default=None, ge=0, max_digits=12, decimal_places=2),
    max_price: Decimal | None = Query(default=None, ge=0, max_digits=12, decimal_places=2),
    sort_by: Literal["name", "sales_price", "created_at", "updated_at"] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    service: ProductService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> ProductPage:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="min_price cannot exceed max_price")
    items, total = service.list_products(
        page=page,
        page_size=page_size,
        search=search,
        product_type=product_type,
        status_filter=status_filter,
        min_price=min_price,
        max_price=max_price,
        sort_by=sort_by,
        sort_order=sort_order,
        customer_visible=principal.role == "customer",
    )
    return ProductPage(
        items=[_product_response(item, principal) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.get("/{product_id}", response_model=ProductResponse | InternalProductResponse)
def get_product(
    product_id: str,
    service: ProductService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> ProductResponse | InternalProductResponse:
    return _product_response(service.get_product(product_id, customer_visible=principal.role == "customer"), principal)


@router.patch("/{product_id}", response_model=InternalProductResponse)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    service: ProductService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> InternalProductResponse:
    return _product_response(service.update_product(product_id, payload), Principal("", "admin"))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_product(
    product_id: str,
    service: ProductService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> Response:
    service.archive_product(product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{product_id}/variants", response_model=VariantResponse, status_code=status.HTTP_201_CREATED)
def create_variant(
    product_id: str,
    payload: VariantCreate,
    service: ProductService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> VariantResponse:
    variant = service.create_variant(product_id, payload)
    product = service.get_product(product_id)
    return _variant_response(variant, product.sales_price)


@router.get("/{product_id}/variants", response_model=list[VariantResponse])
def list_variants(
    product_id: str,
    service: ProductService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> list[VariantResponse]:
    product = service.get_product(product_id, customer_visible=principal.role == "customer")
    return [
        _variant_response(variant, product.sales_price)
        for variant in service.list_variants(product_id, customer_visible=principal.role == "customer")
    ]


@router.patch("/{product_id}/variants/{variant_id}", response_model=VariantResponse)
def update_variant(
    product_id: str,
    variant_id: str,
    payload: VariantUpdate,
    service: ProductService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> VariantResponse:
    variant = service.update_variant(product_id, variant_id, payload)
    product = service.get_product(product_id)
    return _variant_response(variant, product.sales_price)


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_variant(
    product_id: str,
    variant_id: str,
    service: ProductService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> Response:
    service.archive_variant(product_id, variant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{product_id}/calculate-price", response_model=PriceResponse)
def calculate_price(
    product_id: str,
    payload: PriceRequest,
    service: ProductService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> PriceResponse:
    product, variants, final_price = service.calculate_price(
        product_id, payload.variant_ids, customer_visible=principal.role == "customer"
    )
    return PriceResponse(
        product_id=product.id,
        base_sales_price=product.sales_price,
        variant_adjustments=[
            PriceAdjustmentResponse(
                variant_id=variant.id,
                attribute_name=variant.attribute_name,
                value=variant.value,
                price_adjustment=variant.price_adjustment,
            )
            for variant in variants
        ],
        final_sales_price=final_price,
    )
