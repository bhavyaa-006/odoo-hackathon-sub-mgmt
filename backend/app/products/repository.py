"""Database queries for the product catalogue."""

from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.products.models import Product, ProductStatus, ProductType


def product_with_variants(product_id: str) -> Select[tuple[Product]]:
    return select(Product).where(Product.id == product_id).options(selectinload(Product.variants))


def product_filters(
    *,
    search: str | None,
    product_type: ProductType | None,
    status: ProductStatus | None,
    min_price: Decimal | None,
    max_price: Decimal | None,
    customer_visible: bool,
) -> Select[tuple[Product]]:
    statement = select(Product)
    if customer_visible:
        statement = statement.where(Product.status == ProductStatus.ACTIVE)
    elif status is not None:
        statement = statement.where(Product.status == status)
    if search:
        statement = statement.where(Product.name.ilike(f"%{search.strip()}%"))
    if product_type is not None:
        statement = statement.where(Product.product_type == product_type)
    if min_price is not None:
        statement = statement.where(Product.sales_price >= min_price)
    if max_price is not None:
        statement = statement.where(Product.sales_price <= max_price)
    return statement.options(selectinload(Product.variants))


def count(session: Session, statement: Select[tuple[Product]]) -> int:
    return session.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
