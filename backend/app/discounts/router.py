"""
FastAPI router for the Discount Service.

Prefix: /discounts

Endpoints
---------
Static / utility (declared before /{id} to avoid UUID capture):
  GET  /discounts/eligibility             Check if a discount code is eligible
  POST /discounts/apply                   Dry-run or commit multi-discount application

Collection:
  GET  /discounts                         List all discounts (admin, staff)
  POST /discounts                         Create discount (admin only)

Item:
  GET    /discounts/{id}                  Get single discount (admin, staff)
  PATCH  /discounts/{id}                  Update discount (admin only)
  DELETE /discounts/{id}                  Soft-delete discount (admin only)

Subscription discount sub-resource:
  GET    /discounts/subscriptions/{sub_id}                  List assignments for a subscription
  POST   /discounts/subscriptions/{sub_id}/assign           Assign discount to subscription (admin, staff)
  DELETE /discounts/subscriptions/{sub_id}/{sd_id}/revoke   Revoke an assignment (admin, staff)

Invoice discount (read-only):
  GET  /discounts/invoices/{invoice_id}   List discount snapshots for an invoice (admin, staff)

Role enforcement
----------------
  Admin : full CRUD (create, update, deactivate).
  Staff : read + assign/revoke subscription discounts + eligibility check.
  The hard rule (only admin creates discounts) is enforced on POST /discounts.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import AdminUser, DbSession, StaffOrAdminUser
from app.discounts import service
from app.discounts.models import DiscountScope, DiscountType
from app.discounts.schemas import (
    DiscountCreate,
    DiscountEligibilityRequest,
    DiscountEligibilityResponse,
    DiscountListResponse,
    DiscountResponse,
    DiscountUpdate,
    InvoiceDiscountListResponse,
    InvoiceDiscountResponse,
    MultiDiscountApplicationRequest,
    MultiDiscountApplicationResponse,
    SubscriptionDiscountAssign,
    SubscriptionDiscountListResponse,
    SubscriptionDiscountResponse,
)

router = APIRouter(prefix="/discounts", tags=["Discounts"])


# ---------------------------------------------------------------------------
# Static / utility endpoints (MUST come before /{id} routes)
# ---------------------------------------------------------------------------

@router.get(
    "/eligibility",
    response_model=DiscountEligibilityResponse,
    summary="Check whether a discount code is eligible for an invoice context",
)
def check_discount_eligibility(
    db: DbSession,
    _user: StaffOrAdminUser,
    code: Annotated[str, Query(min_length=1, max_length=80, description="Discount code to validate")],
    invoice_subtotal: Annotated[float, Query(gt=0, description="Invoice subtotal in INR before discounts")],
    total_quantity: Annotated[int, Query(ge=0, default=0)],
    subscription_id: Annotated[uuid.UUID | None, Query(default=None)],
    customer_id: Annotated[uuid.UUID | None, Query(default=None)],
    plan_ids: Annotated[list[uuid.UUID], Query(default_factory=list)],
    product_ids: Annotated[list[uuid.UUID], Query(default_factory=list)],
) -> DiscountEligibilityResponse:
    """
    Verify that a discount code is currently active, within its validity window,
    under its usage limit, and meets minimum purchase / quantity requirements for
    the given invoice.  Does not modify any state.
    """
    from decimal import Decimal
    request = DiscountEligibilityRequest(
        code=code,
        subscription_id=subscription_id,
        customer_id=customer_id,
        invoice_subtotal=Decimal(str(invoice_subtotal)),
        total_quantity=total_quantity,
        plan_ids=plan_ids,
        product_ids=product_ids,
    )
    return service.check_eligibility(db=db, request=request)


@router.post(
    "/apply",
    response_model=MultiDiscountApplicationResponse,
    summary="Apply all eligible discounts to a subscription invoice (dry-run or commit)",
)
def apply_discounts(
    payload: MultiDiscountApplicationRequest,
    db: DbSession,
    _user: StaffOrAdminUser,
) -> MultiDiscountApplicationResponse:
    """
    Resolve all active discount assignments for a subscription, run eligibility
    checks, and compute the total deduction.

    - `commit=false` (default): dry-run preview — nothing is written to the DB.
    - `commit=true`: atomically increments usage counters and deactivates
      assignments that have reached their limit.  Should be called once per
      invoice, inside the billing engine's transaction.
    """
    return service.apply_discounts_to_invoice(db=db, request=payload)


# ---------------------------------------------------------------------------
# Collection endpoints
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=DiscountListResponse,
    summary="List discounts",
)
def list_discounts(
    db: DbSession,
    _user: StaffOrAdminUser,
    is_active: Annotated[bool | None, Query(description="Filter by active status")] = None,
    scope: Annotated[DiscountScope | None, Query(description="Filter by scope")] = None,
    discount_type: Annotated[DiscountType | None, Query(description="Filter by type: percentage or fixed")] = None,
    page: Annotated[int, Query(ge=1, description="Page number (1-based)")] = 1,
    page_size: Annotated[int, Query(ge=1, le=200, description="Items per page")] = 20,
) -> DiscountListResponse:
    items, total = service.list_discounts(
        db=db,
        is_active=is_active,
        scope=scope,
        discount_type=discount_type,
        page=page,
        page_size=page_size,
    )
    return DiscountListResponse(
        items=[DiscountResponse.model_validate(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=DiscountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a discount (admin only)",
)
def create_discount(
    payload: DiscountCreate,
    db: DbSession,
    current_user: AdminUser,
) -> DiscountResponse:
    """
    Only admins can create discounts (hard rule from the playbook).
    Staff can view and assign existing discounts but cannot create new ones.
    """
    discount = service.create_discount(
        db=db, data=payload, created_by_id=current_user.id
    )
    return DiscountResponse.model_validate(discount)


# ---------------------------------------------------------------------------
# Item endpoints (MUST come after all static paths)
# ---------------------------------------------------------------------------

@router.get(
    "/{discount_id}",
    response_model=DiscountResponse,
    summary="Get a single discount",
)
def get_discount(
    discount_id: uuid.UUID,
    db: DbSession,
    _user: StaffOrAdminUser,
) -> DiscountResponse:
    discount = service.get_discount_or_404(db, discount_id)
    return DiscountResponse.model_validate(discount)


@router.patch(
    "/{discount_id}",
    response_model=DiscountResponse,
    summary="Update a discount (admin only)",
)
def update_discount(
    discount_id: uuid.UUID,
    payload: DiscountUpdate,
    db: DbSession,
    current_user: AdminUser,
) -> DiscountResponse:
    discount = service.update_discount(
        db=db, discount_id=discount_id, data=payload, updated_by_id=current_user.id
    )
    return DiscountResponse.model_validate(discount)


@router.delete(
    "/{discount_id}",
    response_model=DiscountResponse,
    summary="Soft-delete (deactivate) a discount and all its active subscription assignments (admin only)",
)
def deactivate_discount(
    discount_id: uuid.UUID,
    db: DbSession,
    _user: AdminUser,
) -> DiscountResponse:
    discount = service.deactivate_discount(db=db, discount_id=discount_id)
    return DiscountResponse.model_validate(discount)


# ---------------------------------------------------------------------------
# Subscription discount sub-resource
# ---------------------------------------------------------------------------

@router.get(
    "/subscriptions/{subscription_id}",
    response_model=SubscriptionDiscountListResponse,
    summary="List discount assignments for a subscription",
)
def list_subscription_discounts(
    subscription_id: uuid.UUID,
    db: DbSession,
    _user: StaffOrAdminUser,
    is_active: Annotated[bool | None, Query(description="Filter by active status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> SubscriptionDiscountListResponse:
    items, total = service.list_subscription_discounts(
        db=db,
        subscription_id=subscription_id,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    return SubscriptionDiscountListResponse(
        items=[SubscriptionDiscountResponse.model_validate(sd) for sd in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/subscriptions/{subscription_id}/assign",
    response_model=SubscriptionDiscountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a discount to a subscription (admin, staff)",
)
def assign_discount_to_subscription(
    subscription_id: uuid.UUID,
    payload: SubscriptionDiscountAssign,
    db: DbSession,
    current_user: StaffOrAdminUser,
) -> SubscriptionDiscountResponse:
    """
    Attach an active discount to a subscription so the billing engine
    will apply it on the next eligible invoice.

    - The discount must be active, within its validity window, and under
      its global usage limit.
    - The same discount cannot be assigned twice while active (409 if duplicate).
    """
    sd = service.assign_discount_to_subscription(
        db=db,
        subscription_id=subscription_id,
        data=payload,
        assigned_by_id=current_user.id,
    )
    return SubscriptionDiscountResponse.model_validate(sd)


@router.delete(
    "/subscriptions/{subscription_id}/{subscription_discount_id}/revoke",
    response_model=SubscriptionDiscountResponse,
    summary="Revoke (deactivate) a subscription discount assignment (admin, staff)",
)
def revoke_subscription_discount(
    subscription_id: uuid.UUID,
    subscription_discount_id: uuid.UUID,
    db: DbSession,
    _user: StaffOrAdminUser,
) -> SubscriptionDiscountResponse:
    """
    Manually deactivate a discount assignment.  The billing engine will not
    apply this discount on future invoices for the subscription.
    Already-issued invoice_discount snapshots are unaffected.
    """
    sd = service.revoke_subscription_discount(
        db=db,
        subscription_id=subscription_id,
        subscription_discount_id=subscription_discount_id,
    )
    return SubscriptionDiscountResponse.model_validate(sd)


# ---------------------------------------------------------------------------
# Invoice discount (read-only snapshots)
# ---------------------------------------------------------------------------

@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceDiscountListResponse,
    summary="List discount snapshots applied to an invoice",
)
def list_invoice_discounts(
    invoice_id: uuid.UUID,
    db: DbSession,
    _user: StaffOrAdminUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> InvoiceDiscountListResponse:
    """
    Returns the immutable discount snapshot rows created when the invoice
    was generated.  These amounts are fixed at invoice-creation time and
    never change, ensuring historical invoice accuracy.
    """
    items, total = service.list_invoice_discounts(
        db=db, invoice_id=invoice_id, page=page, page_size=page_size
    )
    return InvoiceDiscountListResponse(
        items=[InvoiceDiscountResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )

