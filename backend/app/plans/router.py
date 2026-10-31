"""HTTP API for subscription plan management.

Route summary
─────────────
POST   /api/v1/plans                        admin only — create plan
GET    /api/v1/plans                        all roles — list / search / filter / paginate
GET    /api/v1/plans/{plan_id}              all roles — get plan details
PATCH  /api/v1/plans/{plan_id}              admin only — partial update
DELETE /api/v1/plans/{plan_id}              admin only — archive (deactivate)
GET    /api/v1/plans/{plan_id}/availability all roles — check availability for a date
POST   /api/v1/plans/{plan_id}/price        all roles — validate quantity, return price breakdown

Authorization:
  - Admins see all plans regardless of is_active.
  - Staff see all plans (same as admin for read operations).
  - Customers see only active plans (is_active=True).
"""

from datetime import date
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import Principal, get_current_principal, require_admin
from app.database import get_session
from app.plans.models import BillingInterval
from app.plans.schemas import (
    AvailabilityResponse,
    PlanCreate,
    PlanPage,
    PlanResponse,
    PlanUpdate,
    PriceRequest,
    PriceResponse,
)
from app.plans.service import PlanService

router = APIRouter(prefix="/api/v1/plans", tags=["Plans"])


def get_service(session: Session = Depends(get_session)) -> PlanService:
    return PlanService(session)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    payload: PlanCreate,
    service: PlanService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> PlanResponse:
    """Create a new subscription plan. Admin only."""
    return PlanResponse.model_validate(service.create_plan(payload))


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@router.get("", response_model=PlanPage)
def list_plans(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=200),
    billing_interval: BillingInterval | None = None,
    is_active: bool | None = None,
    currency: str | None = Query(default=None, max_length=3),
    sort_by: Literal["name", "price", "created_at", "updated_at"] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    service: PlanService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> PlanPage:
    """List, search, filter, and paginate plans.

    Customers automatically see only active plans.
    Admins and staff can filter by is_active explicitly.
    """
    items, total = service.list_plans(
        page=page,
        page_size=page_size,
        search=search,
        billing_interval=billing_interval,
        is_active=is_active,
        currency=currency,
        sort_by=sort_by,
        sort_order=sort_order,
        customer_visible=principal.role == "customer",
    )
    return PlanPage(
        items=[PlanResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


# ---------------------------------------------------------------------------
# Retrieve
# ---------------------------------------------------------------------------


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: str,
    service: PlanService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> PlanResponse:
    """Retrieve a plan by ID."""
    return PlanResponse.model_validate(
        service.get_plan(plan_id, customer_visible=principal.role == "customer")
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@router.patch("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    service: PlanService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> PlanResponse:
    """Partially update a plan. Admin only.

    Omitted fields are preserved unchanged.
    Editing a plan does NOT retroactively change subscriptions or invoices.
    """
    return PlanResponse.model_validate(service.update_plan(plan_id, payload))


# ---------------------------------------------------------------------------
# Archive / deactivate
# ---------------------------------------------------------------------------


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_plan(
    plan_id: str,
    service: PlanService = Depends(get_service),
    _: Principal = Depends(require_admin),
) -> Response:
    """Archive (deactivate) a plan. Admin only.

    The plan record is NOT physically deleted — existing subscription and
    invoice references remain valid.  The plan will no longer appear in
    the customer-facing catalogue.
    """
    service.archive_plan(plan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------


@router.get("/{plan_id}/availability", response_model=AvailabilityResponse)
def check_plan_availability(
    plan_id: str,
    check_date: date | None = Query(default=None),
    service: PlanService = Depends(get_service),
    _: Principal = Depends(get_current_principal),
) -> AvailabilityResponse:
    """Check whether a plan is available for new subscriptions on a given date.

    If *check_date* is omitted the server uses today's date (UTC).
    Customers can call this endpoint; the plan must exist in the catalogue.
    """
    from datetime import datetime, timezone

    effective_date = check_date or datetime.now(timezone.utc).date()
    is_available, reason = service.check_availability(plan_id, effective_date)
    return AvailabilityResponse(
        plan_id=plan_id,
        check_date=effective_date,
        is_available=is_available,
        reason=reason,
    )


# ---------------------------------------------------------------------------
# Price breakdown
# ---------------------------------------------------------------------------


@router.post("/{plan_id}/price", response_model=PriceResponse)
def calculate_plan_price(
    plan_id: str,
    payload: PriceRequest,
    service: PlanService = Depends(get_service),
    principal: Principal = Depends(get_current_principal),
) -> PriceResponse:
    """Validate quantity and return a price breakdown for the plan.

    Uses decimal arithmetic; does not apply taxes, discounts, or proration.
    """
    plan, total = service.calculate_price(
        plan_id, payload.quantity, customer_visible=principal.role == "customer"
    )
    return PriceResponse(
        plan_id=plan.id,
        unit_price=plan.price,
        currency=plan.currency,
        quantity=payload.quantity,
        total_price=total,
        billing_interval=plan.billing_interval,
        interval_count=plan.interval_count,
    )
