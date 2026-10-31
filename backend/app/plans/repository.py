"""Database query builders for the plan service.

Keeps raw SQLAlchemy Select construction out of the service layer so that
business logic and query building remain separately testable.
"""

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.plans.models import BillingInterval, Plan


def plan_by_id(plan_id: str) -> Select[tuple[Plan]]:
    """Select a single plan (products are loaded via selectin on the model)."""
    return select(Plan).where(Plan.id == plan_id)


def plan_filters(
    *,
    search: str | None,
    billing_interval: BillingInterval | None,
    is_active: bool | None,
    currency: str | None,
    customer_visible: bool,
) -> Select[tuple[Plan]]:
    """Build a base query with optional WHERE clauses.

    When *customer_visible* is True only active plans are returned, overriding
    any explicit *is_active* filter supplied by the caller.
    """
    statement = select(Plan)

    if customer_visible:
        statement = statement.where(Plan.is_active.is_(True))
    elif is_active is not None:
        statement = statement.where(Plan.is_active.is_(is_active))

    if search:
        statement = statement.where(Plan.name.ilike(f"%{search.strip()}%"))

    if billing_interval is not None:
        statement = statement.where(Plan.billing_interval == billing_interval)

    if currency is not None:
        statement = statement.where(Plan.currency == currency.strip().upper())

    return statement


def count(session: Session, statement: Select[tuple[Plan]]) -> int:
    return (
        session.scalar(
            select(func.count()).select_from(statement.order_by(None).subquery())
        )
        or 0
    )
