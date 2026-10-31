"""
Payment Service — business logic for the Payments module.

Responsibilities
----------------
- record_payment      : Record a new payment and auto-allocate to invoices
- _auto_allocate      : FIFO allocation across open invoices (oldest due first)
- allocate_payment_to_invoice : Manual allocation (staff override)
- confirm_payment     : Transition pending → confirmed + run allocation
- reverse_payment     : Admin reversal — undo all allocations, update invoices
- issue_refund        : Create a refund payment record (is_refund=True)
- get_payment         : Fetch single payment with allocations
- list_payments       : Paginated, filtered list
- get_customer_outstanding : Sum of open invoice balances for a customer
- _compute_unallocated : Remaining unallocated balance on a payment
- _next_payment_number : Allocate PAY/YYYY/000001 style sequential number

Money arithmetic
----------------
All amounts use Decimal with ROUND_HALF_UP and 2 decimal places.
Never use float for monetary values — Numeric(12,2) columns return Decimal
when queried via SQLAlchemy when Python's Decimal driver is in use.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status as http_status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.billing.invoice_service import refresh_payment_status
from app.billing.models import Invoice, InvoiceStatus
from app.payments.models import InvoicePaymentAllocation, Payment
from app.payments.schemas import (
    AllocationCreate,
    PaymentCreate,
    PaymentMethod,
    RefundCreate,
)
from app.utils.numbering import next_payment_number

# ---------------------------------------------------------------------------
# Constants / helpers
# ---------------------------------------------------------------------------

_ZERO = Decimal("0.00")
_TWO_PLACES = Decimal("0.01")

# Methods that are considered instantly confirmed on recording
_INSTANTLY_CONFIRMED_METHODS = frozenset(
    {
        PaymentMethod.UPI.value,
        PaymentMethod.NEFT.value,
        PaymentMethod.RTGS.value,
        PaymentMethod.IMPS.value,
        PaymentMethod.CREDIT_CARD.value,
        PaymentMethod.DEBIT_CARD.value,
        PaymentMethod.CASH.value,
        PaymentMethod.BANK_TRANSFER.value,
    }
)

# Cheque starts pending; other methods need explicit handling
_PENDING_METHODS = frozenset({PaymentMethod.CHEQUE.value})


def _r2(value: Decimal) -> Decimal:
    """Round a Decimal to 2 places using ROUND_HALF_UP (banker-safe)."""
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


def _d(value: object) -> Decimal:
    """Coerce a numeric value (int, float, str, Decimal) to Decimal."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Payment number allocation
# ---------------------------------------------------------------------------

def _next_payment_number(db: Session, payment_date: date) -> str:
    """
    Allocate the next payment number for the given year.
    Delegates to next_payment_number() in app/utils/numbering.py.
    Must be called inside an open transaction (caller commits).
    """
    return next_payment_number(db, payment_date)


# ---------------------------------------------------------------------------
# Unallocated balance
# ---------------------------------------------------------------------------

def _compute_unallocated(db: Session, payment: Payment) -> Decimal:
    """
    Compute the unallocated balance for a payment.

    unallocated = payment.amount - SUM(active allocation amounts)

    Active allocations are those where reversed_at IS NULL.
    """
    stmt = select(func.coalesce(func.sum(InvoicePaymentAllocation.allocated_amount), 0)).where(
        InvoicePaymentAllocation.payment_id == payment.id,
        InvoicePaymentAllocation.reversed_at.is_(None),
    )
    allocated_sum = db.execute(stmt).scalar_one()
    total_allocated = _r2(_d(allocated_sum))
    unallocated = _r2(_d(payment.amount) - total_allocated)
    # Guard against floating-point drift (should not happen with Decimal, but be safe)
    return max(_ZERO, unallocated)


# ---------------------------------------------------------------------------
# Auto-allocation (FIFO: oldest due date first)
# ---------------------------------------------------------------------------

def _auto_allocate(
    db: Session,
    payment: Payment,
    invoice_ids: list[uuid.UUID] | None = None,
) -> None:
    """
    Automatically allocate the unallocated portion of *payment* to open invoices
    for the same customer, processing oldest-due-date first (FIFO).

    If *invoice_ids* is provided, allocation is restricted to those invoices
    in the given order (useful for targeted allocation).

    Side effects:
    - Creates InvoicePaymentAllocation rows.
    - Updates Invoice.amount_paid.
    - Calls refresh_payment_status() for each touched invoice.
    - All changes are flushed but NOT committed (caller commits).
    """
    remaining = _compute_unallocated(db, payment)
    if remaining <= _ZERO:
        return  # Payment already fully allocated

    # Build query for open invoices belonging to this customer
    open_statuses = [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID]

    stmt = (
        select(Invoice)
        .where(
            Invoice.customer_id == payment.customer_id,
            Invoice.status.in_(open_statuses),
        )
        .order_by(
            Invoice.due_date.asc().nullslast(),
            Invoice.issue_date.asc(),
        )
    )

    if invoice_ids:
        # Restrict to specified invoices; preserve caller's ordering via Python sort
        stmt = stmt.where(Invoice.id.in_(invoice_ids))

    invoices = list(db.execute(stmt).scalars().all())

    # If caller specified invoice_ids, sort to match the provided order
    if invoice_ids:
        id_order = {iid: idx for idx, iid in enumerate(invoice_ids)}
        invoices.sort(key=lambda inv: id_order.get(inv.id, 999999))

    for invoice in invoices:
        if remaining <= _ZERO:
            break

        outstanding = _r2(_d(invoice.total) - _d(invoice.amount_paid))
        if outstanding <= _ZERO:
            continue  # Invoice already paid — skip

        apply_amount = _r2(min(remaining, outstanding))

        allocation = InvoicePaymentAllocation(
            payment_id=payment.id,
            invoice_id=invoice.id,
            allocated_amount=apply_amount,
        )
        db.add(allocation)

        # Update invoice paid amount in-place
        invoice.amount_paid = _r2(_d(invoice.amount_paid) + apply_amount)
        db.flush()

        refresh_payment_status(db, invoice.id)
        remaining = _r2(remaining - apply_amount)


# ---------------------------------------------------------------------------
# Core payment CRUD
# ---------------------------------------------------------------------------

def record_payment(
    db: Session,
    payload: PaymentCreate,
    created_by_id: uuid.UUID,
) -> Payment:
    """
    Record a new payment from a customer.

    Steps:
    1. Validate amount > 0 (schema already enforces this, double-checked here).
    2. Check payment_reference uniqueness if provided.
    3. Assign a payment_number via the sequence counter.
    4. Determine initial status based on payment method.
    5. Insert the Payment row.
    6. If status == confirmed and auto_allocate is True, run _auto_allocate.
    7. Commit, refresh, and return with allocations loaded.
    """
    amount = _r2(_d(payload.amount))
    if amount <= _ZERO:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payment amount must be greater than zero.",
        )

    # Uniqueness check on payment_reference
    if payload.payment_reference:
        existing = db.execute(
            select(Payment).where(Payment.payment_reference == payload.payment_reference)
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"A payment with reference '{payload.payment_reference}' already exists (ID: {existing.id}).",
            )

    # Determine initial status from payment method
    method_value = payload.payment_method.value if hasattr(payload.payment_method, "value") else str(payload.payment_method)
    if method_value in _INSTANTLY_CONFIRMED_METHODS:
        initial_status = "confirmed"
    else:
        # cheque and "other" start as pending
        initial_status = "pending"

    payment_number = _next_payment_number(db, payload.payment_date)

    payment = Payment(
        payment_number=payment_number,
        customer_id=payload.customer_id,
        payment_date=payload.payment_date,
        payment_method=method_value,
        status=initial_status,
        amount=amount,
        currency=payload.currency.upper(),
        payment_reference=payload.payment_reference or None,
        bank_name=payload.bank_name,
        bank_account_last4=payload.bank_account_last4,
        notes=payload.notes,
        is_refund=False,
        refund_for_payment_id=None,
        created_by=created_by_id,
    )
    db.add(payment)
    db.flush()  # get payment.id

    if initial_status == "confirmed" and payload.auto_allocate:
        _auto_allocate(db, payment, invoice_ids=payload.invoice_ids)

    db.commit()
    db.refresh(payment)

    # Reload with allocations
    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment.id)
        .options(selectinload(Payment.allocations))
    ).scalar_one()

    return payment


# ---------------------------------------------------------------------------
# Manual invoice-specific allocation
# ---------------------------------------------------------------------------

def allocate_payment_to_invoice(
    db: Session,
    payment_id: uuid.UUID,
    allocation_data: AllocationCreate,
    acting_user_id: uuid.UUID,
) -> InvoicePaymentAllocation:
    """
    Manually allocate a specified amount from a payment to a specific invoice.

    Validations:
    - Payment must exist and be confirmed.
    - Invoice must exist.
    - Payment and invoice must belong to the same customer.
    - allocation amount <= payment unallocated balance.
    - allocation amount <= invoice outstanding balance.
    """
    # Fetch payment
    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(selectinload(Payment.allocations))
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found.",
        )
    if payment.status != "confirmed":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Only confirmed payments can be manually allocated. Current status: {payment.status}.",
        )

    # Fetch invoice (via billing models)
    from app.billing.models import Invoice  # local import to avoid circular at module level

    invoice = db.execute(
        select(Invoice).where(Invoice.id == allocation_data.invoice_id)
    ).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {allocation_data.invoice_id} not found.",
        )

    # Same customer check
    if invoice.customer_id != payment.customer_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Payment and invoice belong to different customers.",
        )

    # Invoice must be open
    if invoice.status not in (InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice status '{invoice.status}' is not eligible for payment allocation.",
        )

    amount = _r2(_d(allocation_data.allocated_amount))

    # Check unallocated balance
    unallocated = _compute_unallocated(db, payment)
    if amount > unallocated:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Allocation amount {amount} exceeds the payment's unallocated balance "
                f"{unallocated}."
            ),
        )

    # Check invoice outstanding
    outstanding = _r2(_d(invoice.total) - _d(invoice.amount_paid))
    if amount > outstanding:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Allocation amount {amount} exceeds the invoice outstanding balance "
                f"{outstanding}."
            ),
        )

    allocation = InvoicePaymentAllocation(
        payment_id=payment.id,
        invoice_id=invoice.id,
        allocated_amount=amount,
        notes=allocation_data.notes,
    )
    db.add(allocation)

    invoice.amount_paid = _r2(_d(invoice.amount_paid) + amount)
    db.flush()

    refresh_payment_status(db, invoice.id)
    db.commit()
    db.refresh(allocation)
    return allocation


# ---------------------------------------------------------------------------
# Confirm a pending payment
# ---------------------------------------------------------------------------

def confirm_payment(
    db: Session,
    payment_id: uuid.UUID,
    notes: str | None,
    confirmed_by_id: uuid.UUID,
) -> Payment:
    """
    Transition a pending payment to confirmed and run auto-allocation.

    Used when:
    - A cheque clears at the bank.
    - A bank transfer is manually verified.

    Only pending payments can be confirmed.
    """
    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(selectinload(Payment.allocations))
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found.",
        )
    if payment.status != "pending":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending payments can be confirmed. Current status: {payment.status}.",
        )

    payment.status = "confirmed"
    if notes:
        existing = payment.notes or ""
        sep = "\n" if existing else ""
        payment.notes = f"{existing}{sep}[Confirmed] {notes}"
    db.flush()

    # Auto-allocate now that payment is confirmed
    _auto_allocate(db, payment)

    db.commit()
    db.refresh(payment)

    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment.id)
        .options(selectinload(Payment.allocations))
    ).scalar_one()
    return payment


# ---------------------------------------------------------------------------
# Reverse a confirmed payment (admin only)
# ---------------------------------------------------------------------------

def reverse_payment(
    db: Session,
    payment_id: uuid.UUID,
    reason: str,
    reversed_by_id: uuid.UUID,
) -> Payment:
    """
    Reverse a confirmed payment (admin only — enforced in router).

    Steps:
    1. Fetch payment, validate it is confirmed.
    2. Mark payment as reversed, set reversed_at and reversal_reason.
    3. For each active (non-reversed) allocation:
       a. Set reversed_at = now().
       b. Subtract allocated_amount from invoice.amount_paid.
       c. Call refresh_payment_status for the invoice.
    4. Commit and return.
    """
    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(selectinload(Payment.allocations))
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found.",
        )
    if payment.status != "confirmed":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Only confirmed payments can be reversed. Current status: {payment.status}.",
        )
    if not reason or not reason.strip():
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Reversal reason is required.",
        )

    now = _now_utc()

    # Reverse all active allocations
    active_allocations = [a for a in payment.allocations if a.reversed_at is None]

    from app.billing.models import Invoice as _Invoice  # local import

    touched_invoice_ids: set[uuid.UUID] = set()
    for allocation in active_allocations:
        allocation.reversed_at = now

        invoice = db.execute(
            select(_Invoice).where(_Invoice.id == allocation.invoice_id)
        ).scalar_one_or_none()
        if invoice is not None:
            new_paid = _r2(_d(invoice.amount_paid) - _r2(_d(allocation.allocated_amount)))
            invoice.amount_paid = max(_ZERO, new_paid)
            touched_invoice_ids.add(invoice.id)

    db.flush()

    # Refresh invoice statuses after all adjustments
    for inv_id in touched_invoice_ids:
        refresh_payment_status(db, inv_id)

    payment.status = "reversed"
    payment.reversed_at = now
    payment.reversal_reason = reason.strip()

    db.commit()
    db.refresh(payment)

    payment = db.execute(
        select(Payment)
        .where(Payment.id == payment.id)
        .options(selectinload(Payment.allocations))
    ).scalar_one()
    return payment


# ---------------------------------------------------------------------------
# Issue a refund
# ---------------------------------------------------------------------------

def issue_refund(
    db: Session,
    payload: RefundCreate,
    created_by_id: uuid.UUID,
) -> Payment:
    """
    Issue a refund against an original confirmed payment.

    A refund is modelled as a new Payment record with:
    - is_refund = True
    - refund_for_payment_id = original payment ID
    - status = confirmed (refunds are immediate)

    Refunds do NOT trigger auto-allocation to invoices — they reduce the
    effective paid amount in reconciliation reports separately.

    Validations:
    - Original payment must exist, be confirmed, and not already reversed.
    - Refund amount must be > 0 and <= original payment amount.
    """
    refund_amount = _r2(_d(payload.amount))
    if refund_amount <= _ZERO:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Refund amount must be greater than zero.",
        )

    # Fetch original payment
    original = db.execute(
        select(Payment).where(Payment.id == payload.original_payment_id)
    ).scalar_one_or_none()
    if original is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Original payment {payload.original_payment_id} not found.",
        )
    if original.status != "confirmed":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Can only refund confirmed payments. Original payment status: {original.status}.",
        )
    if original.is_refund:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Cannot refund a payment that is itself a refund.",
        )

    original_amount = _r2(_d(original.amount))
    if refund_amount > original_amount:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Refund amount {refund_amount} exceeds original payment amount "
                f"{original_amount}."
            ),
        )

    method_value = (
        payload.payment_method.value
        if hasattr(payload.payment_method, "value")
        else str(payload.payment_method)
    )

    # Check reference uniqueness if provided
    if payload.payment_reference:
        existing_ref = db.execute(
            select(Payment).where(Payment.payment_reference == payload.payment_reference)
        ).scalar_one_or_none()
        if existing_ref is not None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"A payment with reference '{payload.payment_reference}' already exists.",
            )

    payment_number = _next_payment_number(db, payload.refund_date)

    refund_payment = Payment(
        payment_number=payment_number,
        customer_id=original.customer_id,
        payment_date=payload.refund_date,
        payment_method=method_value,
        status="confirmed",  # Refunds are immediately confirmed
        amount=refund_amount,
        currency=original.currency,
        payment_reference=payload.payment_reference or None,
        notes=payload.notes,
        is_refund=True,
        refund_for_payment_id=original.id,
        created_by=created_by_id,
    )
    db.add(refund_payment)
    db.commit()
    db.refresh(refund_payment)

    refund_payment = db.execute(
        select(Payment)
        .where(Payment.id == refund_payment.id)
        .options(selectinload(Payment.allocations))
    ).scalar_one()
    return refund_payment


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def get_payment(db: Session, payment_id: uuid.UUID) -> Payment | None:
    """Fetch a single payment by ID, including its allocations."""
    return db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(selectinload(Payment.allocations))
    ).scalar_one_or_none()


def list_payments(
    db: Session,
    customer_id: uuid.UUID | None,
    payment_status: str | None,
    payment_method: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> tuple[list[Payment], int]:
    """
    Return a paginated, filtered list of payments.

    Filters are all optional and combinable.
    """
    stmt = (
        select(Payment)
        .options(selectinload(Payment.allocations))
    )

    if customer_id is not None:
        stmt = stmt.where(Payment.customer_id == customer_id)
    if payment_status is not None:
        stmt = stmt.where(Payment.status == payment_status)
    if payment_method is not None:
        stmt = stmt.where(Payment.payment_method == payment_method)
    if date_from is not None:
        stmt = stmt.where(Payment.payment_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Payment.payment_date <= date_to)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    offset = (page - 1) * page_size
    rows = db.execute(
        stmt.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()

    return list(rows), total


def get_customer_outstanding(db: Session, customer_id: uuid.UUID) -> dict:
    """
    Compute the total outstanding balance for a customer across all open invoices.

    Returns a dict with:
    - total_outstanding : Decimal — sum of (total - amount_paid) for open invoices
    - invoice_count     : int — number of open invoices
    - oldest_due_date   : date | None — earliest due_date among open invoices
    """
    from app.billing.models import Invoice as _Invoice  # local import

    open_statuses = [InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID]

    stmt = select(_Invoice).where(
        _Invoice.customer_id == customer_id,
        _Invoice.status.in_(open_statuses),
    )
    invoices = list(db.execute(stmt).scalars().all())

    total_outstanding = _ZERO
    oldest_due_date: date | None = None

    for inv in invoices:
        outstanding = _r2(_d(inv.total) - _d(inv.amount_paid))
        total_outstanding = _r2(total_outstanding + outstanding)

        if inv.due_date is not None:
            if oldest_due_date is None or inv.due_date < oldest_due_date:
                oldest_due_date = inv.due_date

    return {
        "customer_id": customer_id,
        "total_outstanding": total_outstanding,
        "invoice_count": len(invoices),
        "oldest_due_date": oldest_due_date,
    }


# ---------------------------------------------------------------------------
# Response builder helper (injects computed fields into PaymentResponse)
# ---------------------------------------------------------------------------

def build_payment_response(db: Session, payment: Payment) -> dict:
    """
    Build a dict ready to construct a PaymentResponse schema.

    Injects the computed `unallocated_amount` field, which requires a DB query.
    """
    unallocated = _compute_unallocated(db, payment)
    data = {
        "id": payment.id,
        "payment_number": payment.payment_number,
        "customer_id": payment.customer_id,
        "payment_date": payment.payment_date,
        "payment_method": payment.payment_method,
        "status": payment.status,
        "amount": _r2(_d(payment.amount)),
        "currency": payment.currency,
        "payment_reference": payment.payment_reference,
        "bank_name": payment.bank_name,
        "bank_account_last4": payment.bank_account_last4,
        "notes": payment.notes,
        "is_refund": payment.is_refund,
        "refund_for_payment_id": payment.refund_for_payment_id,
        "reversed_at": payment.reversed_at,
        "reversal_reason": payment.reversal_reason,
        "created_by": payment.created_by,
        "created_at": payment.created_at,
        "updated_at": payment.updated_at,
        "unallocated_amount": unallocated,
        "allocations": payment.allocations,
    }
    return data

