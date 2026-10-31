"""Product, variant, and server-side catalogue pricing business rules."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import conflict, invalid_operation, not_found
from app.products import repository
from app.products.models import Product, ProductStatus, ProductVariant
from app.products.schemas import ProductCreate, ProductUpdate, VariantCreate, VariantUpdate


class ProductService:
    def __init__(self, session: Session):
        self.session = session

    def get_product(self, product_id: str, *, customer_visible: bool = False) -> Product:
        product = self.session.scalar(repository.product_with_variants(product_id))
        if product is None or (customer_visible and product.status != ProductStatus.ACTIVE):
            raise not_found("Product")
        return product

    def list_products(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None,
        product_type,
        status_filter,
        min_price: Decimal | None,
        max_price: Decimal | None,
        sort_by: str,
        sort_order: str,
        customer_visible: bool,
    ) -> tuple[list[Product], int]:
        statement = repository.product_filters(
            search=search,
            product_type=product_type,
            status=status_filter,
            min_price=min_price,
            max_price=max_price,
            customer_visible=customer_visible,
        )
        total = repository.count(self.session, statement)
        sort_column = getattr(Product, sort_by)
        statement = statement.order_by(sort_column.desc() if sort_order == "desc" else sort_column.asc(), Product.id.asc())
        statement = statement.offset((page - 1) * page_size).limit(page_size)
        return list(self.session.scalars(statement)), total

    def create_product(self, payload: ProductCreate) -> Product:
        product = Product(**payload.model_dump())
        self.session.add(product)
        self._commit_or_duplicate("A product with this name already exists")
        return self.get_product(product.id)

    def update_product(self, product_id: str, payload: ProductUpdate) -> Product:
        product = self.get_product(product_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(product, field, value)
        self._commit_or_duplicate("A product with this name already exists")
        return self.get_product(product.id)

    def archive_product(self, product_id: str) -> None:
        # Archive instead of delete: preserving product records keeps future plan,
        # quotation, subscription, and invoice references historically valid.
        product = self.get_product(product_id)
        if product.status == ProductStatus.ARCHIVED:
            raise invalid_operation("Product is already archived")
        product.status = ProductStatus.ARCHIVED
        self.session.commit()

    def list_variants(self, product_id: str, *, customer_visible: bool) -> list[ProductVariant]:
        product = self.get_product(product_id, customer_visible=customer_visible)
        return [variant for variant in product.variants if variant.is_active or not customer_visible]

    def create_variant(self, product_id: str, payload: VariantCreate) -> ProductVariant:
        self.get_product(product_id)
        variant = ProductVariant(product_id=product_id, **payload.model_dump())
        self.session.add(variant)
        self._commit_or_duplicate("A variant with this attribute and value already exists for this product")
        return variant

    def update_variant(self, product_id: str, variant_id: str, payload: VariantUpdate) -> ProductVariant:
        self.get_product(product_id)
        variant = self.session.scalar(
            select(ProductVariant).where(ProductVariant.id == variant_id, ProductVariant.product_id == product_id)
        )
        if variant is None:
            raise not_found("Variant")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(variant, field, value)
        self._commit_or_duplicate("A variant with this attribute and value already exists for this product")
        return variant

    def archive_variant(self, product_id: str, variant_id: str) -> None:
        self.update_variant(product_id, variant_id, VariantUpdate(is_active=False))

    def calculate_price(self, product_id: str, variant_ids: list[str], *, customer_visible: bool) -> tuple[Product, list[ProductVariant], Decimal]:
        product = self.get_product(product_id, customer_visible=customer_visible)
        by_id = {variant.id: variant for variant in product.variants if variant.is_active}
        requested = [by_id.get(variant_id) for variant_id in variant_ids]
        if any(variant is None for variant in requested):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Every selected variant must be active and belong to this product",
            )
        variants = [variant for variant in requested if variant is not None]
        attributes = [variant.attribute_name.casefold() for variant in variants]
        if len(attributes) != len(set(attributes)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only one variant may be selected for each attribute",
            )
        final_price = product.sales_price + sum((variant.price_adjustment for variant in variants), Decimal("0.00"))
        return product, variants, final_price

    def _commit_or_duplicate(self, duplicate_message: str) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise conflict(duplicate_message) from exc
