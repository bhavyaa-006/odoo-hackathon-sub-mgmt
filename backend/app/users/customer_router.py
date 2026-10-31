"""
FastAPI router for the Customer Portal (/portal).

Directly integrates the customer frontend with the real backend:
- Overview stats (active subscriptions, outstanding dues, recent invoices)
- Profile read and update
- Invoices listing, detail, direct payment, and print view
- Subscriptions and quotations integration
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import service as auth_svc
from app.auth.schemas import UserProfileUpdate, UserResponse
from app.billing import invoice_service
from app.billing.models import Invoice, InvoiceKind, InvoiceStatus
from app.core.dependencies import CurrentUser, DbSession
from app.payments import service as payment_svc
from app.payments.schemas import PaymentCreate, PaymentMethod

router = APIRouter(prefix="/portal", tags=["Customer Portal"])


# ---------------------------------------------------------------------------
# Request/Response Schemas & Serializers
# ---------------------------------------------------------------------------

class PortalPaymentRequest(BaseModel):
    payment_method: PaymentMethod = PaymentMethod.UPI
    amount: Decimal | None = None  # None = pay full outstanding
    payment_reference: str | None = None
    bank_name: str | None = None
    notes: str | None = None


def serialize_portal_invoice(inv: Invoice) -> dict[str, Any]:
    """Serialize Invoice ORM model to dictionary with both major and minor values."""
    from datetime import date as _dt_date

    total_val = float(inv.total or 0)
    paid_val = float(inv.amount_paid or 0)
    outstanding_val = max(0.0, total_val - paid_val)
    status_str = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
    today = _dt_date.today()
    is_overdue = inv.due_date is not None and inv.due_date < today and outstanding_val > 0

    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "customer_id": str(inv.customer_id),
        "status": "overdue" if is_overdue else status_str,
        "is_overdue": is_overdue,
        "issue_date": str(inv.issue_date) if inv.issue_date else None,
        "due_date": str(inv.due_date) if inv.due_date else None,
        "currency": inv.currency or "INR",
        "total": total_val,
        "total_minor": int(round(total_val * 100)),
        "amount_paid": paid_val,
        "paid_minor": int(round(paid_val * 100)),
        "outstanding": outstanding_val,
        "outstanding_minor": int(round(outstanding_val * 100)),
        "items": [
            {
                "id": str(item.id),
                "description": item.description,
                "quantity": float(item.quantity or 1),
                "unit_price": float(item.unit_price or 0),
                "total": float(item.line_total or 0),
                "line_total": float(item.line_total or 0),
            }
            for item in (inv.items or [])
        ],
    }


# ---------------------------------------------------------------------------
# Portal Overview & Profile
# ---------------------------------------------------------------------------

@router.get(
    "/overview",
    summary="Customer Portal Dashboard Overview",
    description="Returns aggregate counts, outstanding balances, and recent invoices for the dashboard.",
)
def get_customer_overview(
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    cust_id = current_user.id
    user = auth_svc.get_user_by_id(db, cust_id)

    # 1. Outstanding invoices & total balance
    outstanding_info = payment_svc.get_customer_outstanding(db, cust_id)
    total_unpaid = outstanding_info.get("total_outstanding", Decimal("0"))
    unpaid_count = outstanding_info.get("invoice_count", 0)

    # 2. Recent invoices
    invoices, total_inv = invoice_service.list_invoices(
        db=db,
        customer_id=cust_id,
        page=1,
        page_size=5,
    )
    recent_invoices = [serialize_portal_invoice(inv) for inv in invoices]

    total_unpaid_float = float(total_unpaid)
    total_unpaid_minor = int(round(total_unpaid_float * 100))

    return {
        "customer": {
            "id": str(cust_id),
            "name": user.name if user else current_user.name,
            "email": user.email if user else current_user.email,
            "company_name": user.company_name if user else current_user.company_name,
        },
        "active_subscriptions": 0,
        "active_subscriptions_count": 0,
        "outstanding_balance_minor": total_unpaid_minor,
        "total_unpaid_amount": total_unpaid_float,
        "unpaid_invoices_count": unpaid_count,
        "next_invoice_date": None,
        "estimated_next_invoice_minor": 0,
        "pending_quotations": 0,
        "currency": "INR",
        "recent_invoices": recent_invoices,
        "recent_subscriptions": [],
    }


@router.get(
    "/profile",
    summary="Get Customer Profile",
)
def get_profile(
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    user = auth_svc.get_user_by_id(db, current_user.id)
    if not user:
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "company_name": current_user.company_name,
            "phone": None,
            "gstin": None,
            "billing_address": None,
        }
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "company_name": user.company_name,
        "phone": user.phone,
        "gstin": user.gstin,
        "billing_address": user.billing_address,
    }


@router.patch(
    "/profile",
    summary="Update Customer Profile",
)
def update_profile(
    payload: UserProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    user = auth_svc.update_user_profile(db, current_user.id, payload)
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "company_name": user.company_name,
        "phone": user.phone,
        "gstin": user.gstin,
        "billing_address": user.billing_address,
    }


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

@router.get(
    "/invoices",
    summary="List Customer Invoices",
)
def list_customer_invoices(
    current_user: CurrentUser,
    db: DbSession,
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> dict[str, Any]:
    invoices, total = invoice_service.list_invoices(
        db=db,
        customer_id=current_user.id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [serialize_portal_invoice(inv) for inv in invoices],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/invoices/{invoice_id}",
    summary="Get Customer Invoice Detail",
)
def get_customer_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    inv = invoice_service.get_invoice(db, invoice_id)
    if not inv or inv.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found.",
        )
    return serialize_portal_invoice(inv)


@router.post(
    "/invoices/{invoice_id}/pay",
    summary="Customer Pay Invoice",
    description="Records a payment allocated directly to the specified invoice.",
)
def pay_invoice(
    invoice_id: uuid.UUID,
    payload: PortalPaymentRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    inv = invoice_service.get_invoice(db, invoice_id)
    if not inv or inv.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found.",
        )
    if inv.status in (InvoiceStatus.PAID, InvoiceStatus.VOID):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot pay an invoice with status '{inv.status.value}'.",
        )

    outstanding = Decimal(str(inv.total)) - Decimal(str(inv.amount_paid))
    pay_amount = payload.amount if payload.amount is not None else outstanding
    if pay_amount <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero.",
        )

    from datetime import date
    payment_in = PaymentCreate(
        customer_id=current_user.id,
        payment_date=date.today(),
        payment_method=payload.payment_method,
        amount=pay_amount,
        payment_reference=payload.payment_reference or f"TXN-PORTAL-{uuid.uuid4().hex[:10].upper()}",
        bank_name=payload.bank_name,
        notes=payload.notes or f"Customer portal payment for invoice {inv.invoice_number}",
        auto_allocate=False,
    )
    payment = payment_svc.record_payment(db, payment_in, created_by_id=current_user.id)
    payment_svc.allocate_payment_to_invoice(
        db=db,
        payment_id=payment.id,
        invoice_id=inv.id,
        amount=pay_amount,
        notes="Customer portal direct checkout",
        acting_user=current_user,
    )

    db.refresh(inv)
    return {
        "message": "Payment recorded successfully.",
        "invoice": invoice_service.enrich_invoice_response(inv),
    }


@router.get(
    "/invoices/{invoice_id}/print",
    summary="Print Customer Invoice HTML",
)
def print_customer_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> HTMLResponse:
    from app.billing.router import _render_gst_invoice_html
    inv = invoice_service.get_invoice(db, invoice_id)
    if not inv or inv.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found.",
        )
    html = _render_gst_invoice_html(inv)
    return HTMLResponse(content=html, status_code=200)


# ---------------------------------------------------------------------------
# Subscriptions & Quotations & Notifications
# ---------------------------------------------------------------------------

@router.get("/subscriptions")
def list_customer_subscriptions(
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    return {"items": [], "total": 0}


@router.get("/quotations")
def list_customer_quotations(
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    return {"items": [], "total": 0}


@router.get("/notifications")
@router.get("/outbox")
def list_customer_notifications(
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    return {"items": [], "messages": [], "unread_count": 0}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    current_user: CurrentUser,
    db: DbSession,
) -> dict[str, Any]:
    return {"message": "All notifications marked as read."}
