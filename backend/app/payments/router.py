"""
FastAPI router for the Payments Service.

Endpoints
---------
POST   /payments                             Record a new payment (staff/admin)
GET    /payments                             List payments (staff/admin see all; customer sees own)
GET    /payments/{payment_id}                Get single payment with allocations
POST   /payments/{payment_id}/confirm        Confirm a pending payment (staff/admin)
POST   /payments/{payment_id}/reverse        Reverse a confirmed payment (admin only)
POST   /payments/{payment_id}/allocate       Manually allocate payment to invoice (staff/admin)
POST   /payments/refunds                     Issue a refund (admin only)
GET    /customers/{customer_id}/outstanding  Outstanding balance for a customer

Auth: all via header stub (X-User-Id, X-User-Role).
Customers may only view their own payments / outstanding balance.
"""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Query, status

from app.core.dependencies import AdminUser, CurrentUser, DbSession, StaffOrAdminUser
from app.payments import service as payment_svc
from app.payments.schemas import (
    AllocationCreate,
    AllocationResponse,
    CustomerOutstandingResponse,
    PaymentConfirmRequest,
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
    PaymentReversalRequest,
    PaymentStatus,
    RefundCreate,
)

router = APIRouter(tags=["Payments"])


# ---------------------------------------------------------------------------
# Helper: convert ORM Payment to PaymentResponse
# ---------------------------------------------------------------------------

def _to_response(db: DbSession, payment: object) -> PaymentResponse:
    """Build a PaymentResponse by injecting computed unallocated_amount."""
    data = payment_svc.build_payment_response(db, payment)  # type: ignore[arg-type]
    return PaymentResponse.model_validate(data)


# ---------------------------------------------------------------------------
# POST /payments — Record a new payment
# ---------------------------------------------------------------------------

@router.post(
    "/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new payment",
    description=(
        "Record a payment received from a customer. "
        "Electronic methods (UPI, NEFT, RTGS, IMPS, card, cash, bank transfer) are "
        "confirmed immediately and auto-allocated to open invoices (oldest first). "
        "Cheques start as pending and must be confirmed separately when they clear."
    ),
)
def record_payment(
    payload: PaymentCreate,
    db: DbSession,
    current_user: StaffOrAdminUser,
) -> PaymentResponse:
    payment = payment_svc.record_payment(db, payload, created_by_id=current_user.id)
    return _to_response(db, payment)


# ---------------------------------------------------------------------------
# GET /payments — List payments
# ---------------------------------------------------------------------------

@router.get(
    "/payments",
    response_model=PaymentListResponse,
    summary="List payments",
    description=(
        "Return a paginated, filtered list of payments. "
        "Staff and admin see all payments; customers see only their own."
    ),
)
def list_payments(
    db: DbSession,
    current_user: CurrentUser,
    customer_id: uuid.UUID | None = Query(default=None, description="Filter by customer"),
    payment_status: PaymentStatus | None = Query(default=None, alias="status", description="Filter by status"),
    payment_method: str | None = Query(default=None, alias="method", description="Filter by payment method"),
    date_from: date | None = Query(default=None, description="Filter: payment_date >= date_from"),
    date_to: date | None = Query(default=None, description="Filter: payment_date <= date_to"),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(default=20, ge=1, le=200, description="Items per page"),
) -> PaymentListResponse:
    # Customers can only see their own payments
    effective_customer_id = customer_id
    if current_user.is_customer:
        effective_customer_id = current_user.id

    status_str = payment_status.value if payment_status is not None else None

    payments, total = payment_svc.list_payments(
        db=db,
        customer_id=effective_customer_id,
        payment_status=status_str,
        payment_method=payment_method,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )

    items = [_to_response(db, p) for p in payments]
    return PaymentListResponse(items=items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# GET /payments/{payment_id} — Get single payment
# ---------------------------------------------------------------------------

@router.get(
    "/payments/{payment_id}",
    response_model=PaymentResponse,
    summary="Get a single payment with allocations",
)
def get_payment(
    payment_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> PaymentResponse:
    payment = payment_svc.get_payment(db, payment_id)
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found.",
        )

    # Customers may only view their own payments
    if current_user.is_customer and payment.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this payment.",
        )

    return _to_response(db, payment)


# ---------------------------------------------------------------------------
# POST /payments/{payment_id}/confirm — Confirm a pending payment
# ---------------------------------------------------------------------------

@router.post(
    "/payments/{payment_id}/confirm",
    response_model=PaymentResponse,
    summary="Confirm a pending payment",
    description=(
        "Mark a pending payment as confirmed (e.g. cheque has cleared at the bank). "
        "This triggers automatic allocation to the customer's oldest open invoices."
    ),
)
def confirm_payment(
    payment_id: uuid.UUID,
    body: PaymentConfirmRequest,
    db: DbSession,
    current_user: StaffOrAdminUser,
) -> PaymentResponse:
    payment = payment_svc.confirm_payment(
        db=db,
        payment_id=payment_id,
        notes=body.notes,
        confirmed_by_id=current_user.id,
    )
    return _to_response(db, payment)


# ---------------------------------------------------------------------------
# POST /payments/{payment_id}/reverse — Reverse a confirmed payment
# ---------------------------------------------------------------------------

@router.post(
    "/payments/{payment_id}/reverse",
    response_model=PaymentResponse,
    summary="Reverse a confirmed payment (admin only)",
    description=(
        "Reverse a confirmed payment. All active allocations are reversed and "
        "the corresponding invoice statuses are recalculated. "
        "Only admin users can perform reversals."
    ),
)
def reverse_payment(
    payment_id: uuid.UUID,
    body: PaymentReversalRequest,
    db: DbSession,
    current_user: AdminUser,
) -> PaymentResponse:
    payment = payment_svc.reverse_payment(
        db=db,
        payment_id=payment_id,
        reason=body.reason,
        reversed_by_id=current_user.id,
    )
    return _to_response(db, payment)


# ---------------------------------------------------------------------------
# POST /payments/{payment_id}/allocate — Manual allocation
# ---------------------------------------------------------------------------

@router.post(
    "/payments/{payment_id}/allocate",
    response_model=AllocationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually allocate a payment to a specific invoice",
    description=(
        "Apply a specific amount from an existing confirmed payment to a specific invoice. "
        "Useful when automatic allocation did not cover a particular invoice, or for "
        "partial allocations across multiple invoices."
    ),
)
def allocate_payment(
    payment_id: uuid.UUID,
    body: AllocationCreate,
    db: DbSession,
    current_user: StaffOrAdminUser,
) -> AllocationResponse:
    # Ensure the path payment_id matches the body (body.payment_id is authoritative
    # but we allow the path param to be specified for REST convention; they must match)
    if body.payment_id != payment_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Path payment_id ({payment_id}) does not match body payment_id "
                f"({body.payment_id})."
            ),
        )

    allocation = payment_svc.allocate_payment_to_invoice(
        db=db,
        payment_id=payment_id,
        allocation_data=body,
        acting_user_id=current_user.id,
    )
    return AllocationResponse.model_validate(allocation)


# ---------------------------------------------------------------------------
# POST /payments/refunds — Issue a refund
# ---------------------------------------------------------------------------

@router.post(
    "/payments/refunds",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue a refund against an original payment (admin only)",
    description=(
        "Create a refund payment record linked to an original confirmed payment. "
        "The refund amount must not exceed the original payment amount. "
        "Refunds are immediately confirmed and are tracked separately from allocations."
    ),
)
def issue_refund(
    body: RefundCreate,
    db: DbSession,
    current_user: AdminUser,
) -> PaymentResponse:
    payment = payment_svc.issue_refund(db=db, payload=body, created_by_id=current_user.id)
    return _to_response(db, payment)


# ---------------------------------------------------------------------------
# GET /customers/{customer_id}/outstanding — Outstanding balance
# ---------------------------------------------------------------------------

@router.get(
    "/customers/{customer_id}/outstanding",
    response_model=CustomerOutstandingResponse,
    summary="Get outstanding balance for a customer",
    description=(
        "Returns the total unpaid amount across all confirmed and partially-paid invoices "
        "for the specified customer, along with the invoice count and oldest due date. "
        "Customers may only query their own outstanding balance."
    ),
)
def get_customer_outstanding(
    customer_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> CustomerOutstandingResponse:
    # Customers may only view their own outstanding balance
    if current_user.is_customer and customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this customer's outstanding balance.",
        )

    result = payment_svc.get_customer_outstanding(db=db, customer_id=customer_id)
    return CustomerOutstandingResponse(**result)

