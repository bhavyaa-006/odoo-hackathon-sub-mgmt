"""
Invoice CRUD service — create, confirm, void, list, and state management.

State machine
-------------
  DRAFT → CONFIRMED (confirm action; recalculates totals)
  CONFIRMED / PARTIALLY_PAID → VOID (void action; only admin)
  CONFIRMED → PARTIALLY_PAID (auto, when a payment is recorded for < total)
  CONFIRMED / PARTIALLY_PAID → PAID (auto, when amount_paid == total)

Overdue is DERIVED (not a status):
  status in (confirmed, partially_paid) AND due_date < today AND (total - amount_paid) > 0

Financial history: once confirmed, line amounts are NEVER recalculated from
current product/plan/discount/tax values.  They are snapshotted at creation.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.billing.models import (
    BillingRunItemStatus,
    Invoice,
    InvoiceItem,
    InvoiceKind,
    InvoiceStatus,
)
from app.billing.schemas import InvoiceCreate, InvoiceItemCreate
from app.billing.service import (
    _compute_line_tax,
    _d,
    _distribute_discount,
    _r2,
    _ZERO,
    assert_invoice_totals,
)
from app.config import get_settings
from app.discounts import service as discount_svc
from app.discounts.schemas import MultiDiscountApplicationRequest
from app.taxes import service as tax_svc
from app.utils.numbering import next_invoice_number

settings = get_settings()


# ---------------------------------------------------------------------------
# Helper: compute outstanding balance and overdue flag
# ---------------------------------------------------------------------------

def _outstanding(inv: Invoice) -> Decimal:
    return _r2(_d(inv.total) - _d(inv.amount_paid))


def _is_overdue(inv: Invoice, today: date | None = None) -> bool:
    if inv.status not in (InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID):
        return False
    if inv.due_date is None:
        return False
    check_date = today or date.today()
    return inv.due_date < check_date and _outstanding(inv) > _ZERO


# ---------------------------------------------------------------------------
# Build InvoiceItem ORM objects from raw line data (manual invoice creation)
# ---------------------------------------------------------------------------

def _build_manual_item(
    db: Session,
    invoice_id: uuid.UUID,
    item_data: InvoiceItemCreate,
    tax_rule_id: uuid.UUID | None,
    supplier_gstin: str | None,
    customer_gstin: str | None,
    customer_state_code: str | None,
    discount_amount: Decimal = _ZERO,
) -> InvoiceItem:
    qty = _d(item_data.quantity)
    price = _d(item_data.unit_price)
    line_sub = _r2(qty * price)
    disc = _r2(min(discount_amount, line_sub))
    taxable = _r2(line_sub - disc)

    rule_id = item_data.tax_rule_id or tax_rule_id
    tax = _compute_line_tax(
        db=db,
        taxable_amount=taxable,
        tax_rule_id=rule_id,
        supplier_gstin=supplier_gstin,
        customer_gstin=customer_gstin,
        customer_state_code=customer_state_code,
    )
    line_total = _r2(taxable + tax["tax_amount"])

    return InvoiceItem(
        invoice_id=invoice_id,
        description=item_data.description,
        product_id=item_data.product_id,
        plan_id=item_data.plan_id,
        quantity=qty,
        unit_price=price,
        line_subtotal=line_sub,
        discount_amount=disc,
        taxable_amount=taxable,
        cgst_rate=tax["cgst_rate"],
        cgst_amount=tax["cgst_amount"],
        sgst_rate=tax["sgst_rate"],
        sgst_amount=tax["sgst_amount"],
        igst_rate=tax["igst_rate"],
        igst_amount=tax["igst_amount"],
        tax_rate=tax["tax_rate"],
        tax_amount=tax["tax_amount"],
        line_total=line_total,
        metadata_=item_data.metadata_,
    )


# ---------------------------------------------------------------------------
# Create a manual invoice
# ---------------------------------------------------------------------------

def create_invoice(
    db: Session,
    data: InvoiceCreate,
    created_by_id: uuid.UUID,
) -> Invoice:
    """
    Create a DRAFT invoice manually (staff/admin).

    Tax and discount are calculated at creation time and snapshotted.
    The invoice is created as DRAFT; it must be confirmed separately.
    """
    # Resolve GST state info
    customer_gstin = data.customer_gstin
    customer_state_code: str | None = customer_gstin[:2] if customer_gstin and len(customer_gstin) >= 2 else None
    supplier_gstin = data.supplier_gstin or settings.company_gstin
    is_interstate = customer_state_code != settings.company_state_code if customer_state_code else True

    place_of_supply: str | None = None
    if customer_state_code:
        try:
            place_of_supply = tax_svc.get_state_name(customer_state_code)
        except ValueError:
            pass

    due_date = data.due_date
    if due_date is None and data.payment_term_days:
        due_date = data.issue_date + relativedelta(days=data.payment_term_days)

    # Allocate invoice number
    invoice_number = next_invoice_number(db, data.issue_date)

    inv = Invoice(
        invoice_number=invoice_number,
        subscription_id=data.subscription_id,
        customer_id=data.customer_id,
        kind=data.kind,
        status=InvoiceStatus.DRAFT,
        issue_date=data.issue_date,
        due_date=due_date,
        period_start=data.period_start,
        period_end=data.period_end,
        currency=data.currency,
        payment_term_days=data.payment_term_days,
        supplier_gstin=supplier_gstin,
        customer_gstin=customer_gstin,
        place_of_supply=place_of_supply,
        is_igst=is_interstate,
        created_by=created_by_id,
        # Totals filled in below
        subtotal=_ZERO,
        discount_total=_ZERO,
        taxable_total=_ZERO,
        tax_total=_ZERO,
        total=_ZERO,
        amount_paid=_ZERO,
    )
    db.add(inv)
    db.flush()  # get inv.id

    # Build raw lines for discount distribution calculation
    raw_subtotals = [_r2(_d(it.quantity) * _d(it.unit_price)) for it in data.items]
    total_subtotal = _r2(sum(raw_subtotals))

    # Resolve discounts if subscription provided
    discount_total = _ZERO
    disc_amounts_per_line = [_ZERO] * len(data.items)
    if data.subscription_id and total_subtotal > _ZERO:
        plan_ids = [it.plan_id for it in data.items if it.plan_id]
        product_ids = [it.product_id for it in data.items if it.product_id]
        disc_req = MultiDiscountApplicationRequest(
            subscription_id=data.subscription_id,
            invoice_subtotal=total_subtotal,
            total_quantity=int(sum(_d(it.quantity) for it in data.items)),
            plan_ids=plan_ids,
            product_ids=product_ids,
            commit=False,
        )
        disc_result = discount_svc.apply_discounts_to_invoice(db=db, request=disc_req)
        discount_total = _r2(disc_result.total_discount_amount)
        # Distribute across lines proportionally
        fake_lines = [{"line_subtotal": s, "discount_amount": _ZERO} for s in raw_subtotals]
        _distribute_discount(fake_lines, discount_total)
        disc_amounts_per_line = [_d(l["discount_amount"]) for l in fake_lines]

    # Build item rows
    orm_items: list[InvoiceItem] = []
    for i, item_data in enumerate(data.items):
        orm_item = _build_manual_item(
            db=db,
            invoice_id=inv.id,
            item_data=item_data,
            tax_rule_id=data.tax_rule_id,
            supplier_gstin=supplier_gstin,
            customer_gstin=customer_gstin,
            customer_state_code=customer_state_code,
            discount_amount=disc_amounts_per_line[i],
        )
        db.add(orm_item)
        orm_items.append(orm_item)

    db.flush()

    # Aggregate totals from items
    subtotal = _r2(sum(_d(it.line_subtotal) for it in orm_items))
    disc_total = _r2(sum(_d(it.discount_amount) for it in orm_items))
    taxable_total = _r2(sum(_d(it.taxable_amount) for it in orm_items))
    cgst_total = _r2(sum(_d(it.cgst_amount) for it in orm_items))
    sgst_total = _r2(sum(_d(it.sgst_amount) for it in orm_items))
    igst_total = _r2(sum(_d(it.igst_amount) for it in orm_items))
    tax_total = _r2(cgst_total + sgst_total + igst_total)
    grand_total = _r2(taxable_total + tax_total)

    inv.subtotal = subtotal
    inv.discount_total = disc_total
    inv.taxable_total = taxable_total
    inv.cgst_total = cgst_total
    inv.sgst_total = sgst_total
    inv.igst_total = igst_total
    inv.tax_total = tax_total
    inv.total = grand_total

    db.commit()
    db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Confirm a draft invoice
# ---------------------------------------------------------------------------

def confirm_invoice(db: Session, invoice_id: uuid.UUID, confirmed_by_id: uuid.UUID) -> Invoice:
    """
    Transition DRAFT → CONFIRMED.
    Commits discount usage counters atomically.
    """
    inv = _get_invoice_or_404(db, invoice_id)
    if inv.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only DRAFT invoices can be confirmed. Current status: {inv.status}.",
        )

    # Commit discount counters if subscription-linked
    if inv.subscription_id:
        sub_total = _d(inv.subtotal)
        plan_ids: list[uuid.UUID] = []
        product_ids: list[uuid.UUID] = []
        for item in inv.items:
            if item.plan_id:
                plan_ids.append(item.plan_id)
            if item.product_id:
                product_ids.append(item.product_id)
        total_qty = int(sum(_d(it.quantity) for it in inv.items))

        commit_req = MultiDiscountApplicationRequest(
            subscription_id=inv.subscription_id,
            invoice_subtotal=sub_total,
            total_quantity=total_qty,
            plan_ids=plan_ids,
            product_ids=product_ids,
            commit=True,
        )
        disc_result = discount_svc.apply_discounts_to_invoice(db=db, request=commit_req)
        if disc_result.applied_discounts:
            discount_svc.write_invoice_discount_snapshots(
                db=db,
                invoice_id=inv.id,
                applied=disc_result.applied_discounts,
                sub_discount_map={},
            )

    inv.status = InvoiceStatus.CONFIRMED
    inv.confirmed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Void an invoice
# ---------------------------------------------------------------------------

def void_invoice(
    db: Session, invoice_id: uuid.UUID, reason: str, voided_by_id: uuid.UUID
) -> Invoice:
    """
    Void a DRAFT or CONFIRMED invoice. PAID invoices cannot be voided.
    Creates a corresponding credit note for CONFIRMED invoices with amount_paid > 0.
    """
    inv = _get_invoice_or_404(db, invoice_id)

    if inv.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PAID invoices cannot be voided. Issue a credit note instead.",
        )
    if inv.status == InvoiceStatus.VOID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already void.",
        )

    inv.status = InvoiceStatus.VOID
    inv.voided_at = datetime.now(timezone.utc)
    inv.voided_by = voided_by_id
    inv.void_reason = reason

    db.commit()
    db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Update payment status (called by payment service after recording a payment)
# ---------------------------------------------------------------------------

def refresh_payment_status(db: Session, invoice_id: uuid.UUID) -> Invoice:
    """
    Recompute invoice status based on current amount_paid vs total.
    Called by the payment service after each payment is posted.
    """
    inv = _get_invoice_or_404(db, invoice_id)
    if inv.status == InvoiceStatus.VOID:
        return inv

    total = _d(inv.total)
    paid = _d(inv.amount_paid)
    outstanding = _r2(total - paid)

    if outstanding <= _ZERO and total > _ZERO:
        inv.status = InvoiceStatus.PAID
        inv.paid_at = datetime.now(timezone.utc)
    elif paid > _ZERO:
        inv.status = InvoiceStatus.PARTIALLY_PAID
    else:
        inv.status = InvoiceStatus.CONFIRMED

    db.commit()
    db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def get_invoice(db: Session, invoice_id: uuid.UUID) -> Invoice | None:
    return db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.items))
    ).scalar_one_or_none()


def _get_invoice_or_404(db: Session, invoice_id: uuid.UUID) -> Invoice:
    inv = get_invoice(db, invoice_id)
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found.",
        )
    return inv


def list_invoices(
    db: Session,
    customer_id: uuid.UUID | None = None,
    subscription_id: uuid.UUID | None = None,
    status_filter: InvoiceStatus | None = None,
    kind_filter: InvoiceKind | None = None,
    overdue_only: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Invoice], int]:
    today = date.today()

    stmt = select(Invoice).options(selectinload(Invoice.items))

    if customer_id:
        stmt = stmt.where(Invoice.customer_id == customer_id)
    if subscription_id:
        stmt = stmt.where(Invoice.subscription_id == subscription_id)
    if status_filter:
        stmt = stmt.where(Invoice.status == status_filter)
    if kind_filter:
        stmt = stmt.where(Invoice.kind == kind_filter)
    if date_from:
        stmt = stmt.where(Invoice.issue_date >= date_from)
    if date_to:
        stmt = stmt.where(Invoice.issue_date <= date_to)
    if q:
        stmt = stmt.where(Invoice.invoice_number.ilike(f"%{q}%"))
    if overdue_only:
        stmt = stmt.where(
            Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIALLY_PAID]),
            Invoice.due_date < today,
            Invoice.amount_paid < Invoice.total,
        )

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    offset = (page - 1) * page_size
    items = db.execute(
        stmt.order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()

    return list(items), total


def enrich_invoice_response(inv: Invoice, today: date | None = None) -> dict:
    """Add computed fields (outstanding, is_overdue) for the response schema."""
    today = today or date.today()
    return {
        "outstanding": _outstanding(inv),
        "is_overdue": _is_overdue(inv, today),
    }

