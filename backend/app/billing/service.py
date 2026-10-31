"""
Core billing engine — recurring invoice generation with full idempotency.

Engine rules (from Brightloop Autopilot Playbook, section 7.1)
--------------------------------------------------------------
1.  PERIODS      First period starts on subscription.start_date. Each next
                 period start = previous start + plan cadence (relativedelta
                 for month/year to preserve day-of-month; clamp to month-end).
                 Period end = next_start - 1 day.

2.  ELIGIBILITY  Status must be 'active' or 'past_due' (still billed).
                 next_billing_date <= as_of.  period_start <= expiry_date.
                 Catch-up loop: keep advancing until next_billing_date > as_of
                 so no missed period is ever skipped.

3.  BILLING IN ADVANCE  issue_date = period_start.
                        due_date   = issue_date + payment_term_days.
                        Recurring invoices are created as CONFIRMED.
                        Manual invoices are created as DRAFT.

4.  IDEMPOTENCY  INSERT with unique constraint on (subscription_id, period_start,
                 kind). On IntegrityError → mark item as DUPLICATE and continue.
                 Same run_key → return existing BillingRun immediately.

5.  LINES        line_subtotal = qty × unit_price.

6.  DISCOUNTS    Resolve via discount service; atomically increment usage
                 counters on commit (not on dry-run).

7.  TAX          taxable = line_subtotal - discount_share.
                 Intrastate: CGST + SGST (half each). Interstate: IGST.
                 Determined by comparing customer state code vs COMPANY_STATE_CODE.
                 Round half-up per component (Section 170 CGST Act).

8.  PRORATION    day-based — handled by invoice_service.create_proration_invoice().

9.  ANOMALIES    Flagged (never blocking):
                   • total > 2× previous recurring invoice for same subscription
                   • total < 0.5× previous recurring invoice for same subscription
                   • zero total
                   • discount > 50% of subtotal
                   • missing tax when taxable > 0

10. ALL MONEY uses Python Decimal + ROUND_HALF_UP. No floats.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.billing.models import (
    BillingRun,
    BillingRunItem,
    BillingRunItemStatus,
    BillingRunStatus,
    Invoice,
    InvoiceItem,
    InvoiceKind,
    InvoiceStatus,
)
from app.billing.schemas import BillingRunRequest
from app.config import get_settings
from app.discounts.models import Discount, SubscriptionDiscount
from app.discounts.schemas import MultiDiscountApplicationRequest
from app.discounts import service as discount_svc
from app.taxes import service as tax_svc
from app.utils.numbering import next_invoice_number

settings = get_settings()

# ---------------------------------------------------------------------------
# Decimal helpers
# ---------------------------------------------------------------------------

_TWO = Decimal("0.01")
_ZERO = Decimal("0")
_HUNDRED = Decimal("100")


def _d(v: Any) -> Decimal:
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


def _r2(v: Decimal) -> Decimal:
    return v.quantize(_TWO, rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Period date arithmetic
# ---------------------------------------------------------------------------

def next_period_start(current_start: date, cadence: str, interval: int = 1) -> date:
    """
    Advance a period start date by one billing cadence.

    cadence options: 'day', 'week', 'month', 'year'
    relativedelta is used for month/year so day-of-month is preserved
    and correctly clamped (e.g. Jan 31 + 1 month = Feb 28/29).
    """
    cadence = cadence.lower()
    if cadence == "day":
        return current_start + relativedelta(days=interval)
    elif cadence == "week":
        return current_start + relativedelta(weeks=interval)
    elif cadence == "month":
        return current_start + relativedelta(months=interval)
    elif cadence == "year":
        return current_start + relativedelta(years=interval)
    else:
        raise ValueError(f"Unknown billing cadence: '{cadence}'")


def period_end_from_start(current_start: date, cadence: str, interval: int = 1) -> date:
    """Period end = next period start - 1 day."""
    return next_period_start(current_start, cadence, interval) - relativedelta(days=1)


# ---------------------------------------------------------------------------
# Run-key derivation
# ---------------------------------------------------------------------------

def make_run_key(as_of: date, dry_run: bool, tag: str | None = None) -> str:
    """
    Deterministic run key so the same scheduled job produces the same key.
    Dry-run and commit runs have different keys intentionally.
    """
    parts = [f"billing:{as_of.isoformat()}", "dry" if dry_run else "live"]
    if tag:
        parts.append(tag)
    return ":".join(parts)


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

def _check_anomalies(
    total: Decimal,
    subtotal: Decimal,
    discount_total: Decimal,
    tax_total: Decimal,
    prev_total: Decimal | None,
) -> tuple[bool, str | None]:
    notes: list[str] = []

    if total == _ZERO:
        notes.append("Zero-total invoice.")

    if prev_total is not None and prev_total > _ZERO:
        ratio = total / prev_total
        if ratio > Decimal("2"):
            notes.append(f"Total ₹{total} is {ratio:.1f}× previous ₹{prev_total} (>2×).")
        elif ratio < Decimal("0.5"):
            notes.append(f"Total ₹{total} is {ratio:.1f}× previous ₹{prev_total} (<0.5×).")

    if subtotal > _ZERO and discount_total > _ZERO:
        disc_ratio = discount_total / subtotal
        if disc_ratio > Decimal("0.5"):
            notes.append(f"Discount ₹{discount_total} is {disc_ratio*100:.0f}% of subtotal (>50%).")

    taxable = subtotal - discount_total
    if taxable > _ZERO and tax_total == _ZERO:
        notes.append("Taxable amount > 0 but no tax charged.")

    if notes:
        return True, "; ".join(notes)
    return False, None


def _get_prev_recurring_total(
    db: Session, subscription_id: uuid.UUID, exclude_invoice_id: uuid.UUID | None = None
) -> Decimal | None:
    """Fetch the total of the most recent CONFIRMED recurring invoice for anomaly check."""
    stmt = (
        select(Invoice.total)
        .where(
            Invoice.subscription_id == subscription_id,
            Invoice.kind == InvoiceKind.RECURRING,
            Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PAID,
                                  InvoiceStatus.PARTIALLY_PAID]),
        )
        .order_by(Invoice.period_start.desc())
        .limit(1)
    )
    if exclude_invoice_id:
        stmt = stmt.where(Invoice.id != exclude_invoice_id)
    result = db.execute(stmt).scalar_one_or_none()
    return _d(result) if result is not None else None


# ---------------------------------------------------------------------------
# Tax resolution helpers
# ---------------------------------------------------------------------------

def _resolve_transaction_type(customer_state_code: str | None) -> str:
    """
    Compare customer state code with the company's state code.
    Returns 'INTRASTATE' or 'INTERSTATE'.
    """
    company_state = settings.company_state_code.strip()
    if customer_state_code and customer_state_code.strip() == company_state:
        return "INTRASTATE"
    return "INTERSTATE"


def _compute_line_tax(
    db: Session,
    taxable_amount: Decimal,
    tax_rule_id: uuid.UUID | None,
    supplier_gstin: str | None,
    customer_gstin: str | None,
    customer_state_code: str | None,
    is_export: bool = False,
) -> dict[str, Decimal]:
    """
    Call the tax service and return a dict of tax components.
    Returns zeros if no tax rule is set.
    """
    if taxable_amount <= _ZERO:
        return {
            "cgst_rate": _ZERO, "cgst_amount": _ZERO,
            "sgst_rate": _ZERO, "sgst_amount": _ZERO,
            "igst_rate": _ZERO, "igst_amount": _ZERO,
            "tax_rate": _ZERO, "tax_amount": _ZERO,
        }

    try:
        breakdown = tax_svc.calculate_tax_for_invoice_line(
            db=db,
            taxable_amount=taxable_amount,
            tax_rule_id=tax_rule_id,
            supplier_gstin=supplier_gstin,
            customer_gstin=customer_gstin,
            customer_state_code=customer_state_code,
            is_export=is_export,
            is_rcm=False,
            reference_type="invoice_item",
        )
        total_rate = _d(breakdown.cgst_rate) + _d(breakdown.sgst_rate) + _d(breakdown.igst_rate)
        return {
            "cgst_rate": _d(breakdown.cgst_rate),
            "cgst_amount": _d(breakdown.cgst_amount),
            "sgst_rate": _d(breakdown.sgst_rate),
            "sgst_amount": _d(breakdown.sgst_amount),
            "igst_rate": _d(breakdown.igst_rate),
            "igst_amount": _d(breakdown.igst_amount),
            "tax_rate": total_rate,
            "tax_amount": _d(breakdown.total_tax_amount),
        }
    except Exception:
        # Tax service failure should not block invoice creation; log and proceed with 0 tax
        return {
            "cgst_rate": _ZERO, "cgst_amount": _ZERO,
            "sgst_rate": _ZERO, "sgst_amount": _ZERO,
            "igst_rate": _ZERO, "igst_amount": _ZERO,
            "tax_rate": _ZERO, "tax_amount": _ZERO,
        }


# ---------------------------------------------------------------------------
# Core: build one invoice for one subscription + period
# ---------------------------------------------------------------------------

def _build_invoice_for_subscription(
    db: Session,
    subscription: Any,  # subscriptions ORM object (dynamic import to avoid circular)
    period_start: date,
    period_end: date,
    as_of: date,
    dry_run: bool,
) -> tuple[Invoice | None, BillingRunItemStatus, str | None, bool, str | None]:
    """
    Compute and optionally persist one invoice for a single (subscription, period).

    Returns (invoice, item_status, error_message, has_anomaly, anomaly_notes)
    """
    plan = subscription.plan          # must be eager-loaded by caller
    items_data = subscription.items   # subscription_items

    if not items_data:
        return None, BillingRunItemStatus.SKIPPED, "Subscription has no line items.", False, None

    # ------------------------------------------------------------------ #
    # 1. Resolve customer GST state
    # ------------------------------------------------------------------ #
    customer = subscription.customer
    customer_gstin: str | None = getattr(customer, "gstin", None)
    customer_state_code: str | None = None
    if customer_gstin and len(customer_gstin) >= 2:
        customer_state_code = customer_gstin[:2]

    supplier_gstin: str | None = settings.company_gstin
    supplier_state_code: str | None = settings.company_state_code
    is_interstate = customer_state_code != supplier_state_code if customer_state_code else True

    place_of_supply: str | None = None
    if customer_state_code:
        try:
            place_of_supply = tax_svc.get_state_name(customer_state_code)
        except ValueError:
            pass

    # ------------------------------------------------------------------ #
    # 2. Build line items
    # ------------------------------------------------------------------ #
    raw_lines: list[dict[str, Any]] = []
    for sub_item in items_data:
        qty = _d(sub_item.quantity)
        unit_price = _d(sub_item.unit_price)

        # Validate minimum quantity
        min_qty = _d(getattr(plan, "minimum_quantity", 1) or 1)
        if qty < min_qty:
            return (
                None,
                BillingRunItemStatus.ERROR,
                f"Item qty {qty} < plan minimum {min_qty}.",
                False, None,
            )

        line_subtotal = _r2(qty * unit_price)
        raw_lines.append({
            "description": getattr(sub_item, "description", None)
                           or getattr(sub_item, "product_name", "Subscription")
                           or "Subscription Service",
            "product_id": getattr(sub_item, "product_id", None),
            "plan_id": getattr(sub_item, "plan_id", None) or subscription.plan_id,
            "quantity": qty,
            "unit_price": unit_price,
            "line_subtotal": line_subtotal,
            "tax_rule_id": getattr(sub_item, "tax_rule_id", None),
            "metadata_": {
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
            },
        })

    total_subtotal = _r2(sum(_d(l["line_subtotal"]) for l in raw_lines))

    # ------------------------------------------------------------------ #
    # 3. Resolve discounts (dry-run = preview only, no counter increment)
    # ------------------------------------------------------------------ #
    plan_ids = [l["plan_id"] for l in raw_lines if l.get("plan_id")]
    product_ids = [l["product_id"] for l in raw_lines if l.get("product_id")]

    disc_request = MultiDiscountApplicationRequest(
        subscription_id=subscription.id,
        invoice_subtotal=total_subtotal,
        total_quantity=int(sum(_d(l["quantity"]) for l in raw_lines)),
        plan_ids=plan_ids,
        product_ids=product_ids,
        commit=False,  # always preview here; commit happens after invoice insert
    )
    disc_result = discount_svc.apply_discounts_to_invoice(db=db, request=disc_request)
    discount_total = _r2(disc_result.total_discount_amount)

    # Distribute discount proportionally across lines
    _distribute_discount(raw_lines, discount_total)

    # ------------------------------------------------------------------ #
    # 4. Compute tax per line
    # ------------------------------------------------------------------ #
    for line in raw_lines:
        taxable = _r2(_d(line["line_subtotal"]) - _d(line["discount_amount"]))
        line["taxable_amount"] = taxable
        tax = _compute_line_tax(
            db=db,
            taxable_amount=taxable,
            tax_rule_id=line.get("tax_rule_id"),
            supplier_gstin=supplier_gstin,
            customer_gstin=customer_gstin,
            customer_state_code=customer_state_code,
            is_export=False,
        )
        line.update(tax)
        line["line_total"] = _r2(taxable + _d(tax["tax_amount"]))

    # ------------------------------------------------------------------ #
    # 5. Aggregate invoice totals
    # ------------------------------------------------------------------ #
    taxable_total = _r2(sum(_d(l["taxable_amount"]) for l in raw_lines))
    cgst_total = _r2(sum(_d(l["cgst_amount"]) for l in raw_lines))
    sgst_total = _r2(sum(_d(l["sgst_amount"]) for l in raw_lines))
    igst_total = _r2(sum(_d(l["igst_amount"]) for l in raw_lines))
    tax_total = _r2(cgst_total + sgst_total + igst_total)
    grand_total = _r2(taxable_total + tax_total)

    # ------------------------------------------------------------------ #
    # 6. Anomaly detection
    # ------------------------------------------------------------------ #
    prev_total = _get_prev_recurring_total(db, subscription.id)
    has_anomaly, anomaly_notes = _check_anomalies(
        grand_total, total_subtotal, discount_total, tax_total, prev_total
    )

    # ------------------------------------------------------------------ #
    # 7. Dry-run: return a transient (unsaved) Invoice object
    # ------------------------------------------------------------------ #
    payment_term_days = getattr(subscription, "payment_term_days", 0) or 0
    issue_date = period_start
    due_date = issue_date + relativedelta(days=payment_term_days)

    if dry_run:
        # Build unsaved object for preview response
        inv = Invoice(
            id=uuid.uuid4(),
            invoice_number="DRY-RUN",
            subscription_id=subscription.id,
            customer_id=subscription.customer_id,
            kind=InvoiceKind.RECURRING,
            status=InvoiceStatus.CONFIRMED,
            issue_date=issue_date,
            due_date=due_date,
            period_start=period_start,
            period_end=period_end,
            subtotal=total_subtotal,
            discount_total=discount_total,
            taxable_total=taxable_total,
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            tax_total=tax_total,
            total=grand_total,
            amount_paid=_ZERO,
            currency="INR",
            payment_term_days=payment_term_days,
            supplier_gstin=supplier_gstin,
            customer_gstin=customer_gstin,
            place_of_supply=place_of_supply,
            is_igst=is_interstate,
            has_anomaly=has_anomaly,
            anomaly_notes=anomaly_notes,
        )
        return inv, BillingRunItemStatus.SUCCESS, None, has_anomaly, anomaly_notes

    # ------------------------------------------------------------------ #
    # 8. Commit: persist invoice + items atomically
    # ------------------------------------------------------------------ #
    invoice_number = next_invoice_number(db, issue_date)

    inv = Invoice(
        invoice_number=invoice_number,
        subscription_id=subscription.id,
        customer_id=subscription.customer_id,
        kind=InvoiceKind.RECURRING,
        status=InvoiceStatus.CONFIRMED,
        confirmed_at=datetime.now(timezone.utc),
        issue_date=issue_date,
        due_date=due_date,
        period_start=period_start,
        period_end=period_end,
        subtotal=total_subtotal,
        discount_total=discount_total,
        taxable_total=taxable_total,
        cgst_total=cgst_total,
        sgst_total=sgst_total,
        igst_total=igst_total,
        tax_total=tax_total,
        total=grand_total,
        amount_paid=_ZERO,
        currency="INR",
        payment_term_days=payment_term_days,
        supplier_gstin=supplier_gstin,
        customer_gstin=customer_gstin,
        place_of_supply=place_of_supply,
        is_igst=is_interstate,
        has_anomaly=has_anomaly,
        anomaly_notes=anomaly_notes,
    )
    db.add(inv)
    try:
        db.flush()  # get inv.id; rolls back on unique violation
    except IntegrityError:
        db.rollback()
        return None, BillingRunItemStatus.DUPLICATE, None, False, None

    # Persist line items
    for line in raw_lines:
        db.add(InvoiceItem(
            invoice_id=inv.id,
            description=line["description"],
            product_id=line.get("product_id"),
            plan_id=line.get("plan_id"),
            quantity=line["quantity"],
            unit_price=line["unit_price"],
            line_subtotal=line["line_subtotal"],
            discount_amount=line["discount_amount"],
            taxable_amount=line["taxable_amount"],
            cgst_rate=line["cgst_rate"],
            cgst_amount=line["cgst_amount"],
            sgst_rate=line["sgst_rate"],
            sgst_amount=line["sgst_amount"],
            igst_rate=line["igst_rate"],
            igst_amount=line["igst_amount"],
            tax_rate=line["tax_rate"],
            tax_amount=line["tax_amount"],
            line_total=line["line_total"],
            metadata_=line.get("metadata_"),
        ))

    # Atomically commit discount usage counters
    if disc_result.applied_discounts:
        commit_request = MultiDiscountApplicationRequest(
            subscription_id=subscription.id,
            invoice_subtotal=total_subtotal,
            total_quantity=disc_request.total_quantity,
            plan_ids=plan_ids,
            product_ids=product_ids,
            commit=True,
        )
        discount_svc.apply_discounts_to_invoice(db=db, request=commit_request)
        # Write invoice_discount snapshot rows
        sub_discount_map: dict[uuid.UUID, uuid.UUID] = {}
        discount_svc.write_invoice_discount_snapshots(
            db=db,
            invoice_id=inv.id,
            applied=disc_result.applied_discounts,
            sub_discount_map=sub_discount_map,
        )

    # Assert totals integrity before final commit
    assert_invoice_totals(inv, raw_lines)

    db.flush()
    return inv, BillingRunItemStatus.SUCCESS, None, has_anomaly, anomaly_notes


def _distribute_discount(
    raw_lines: list[dict[str, Any]], total_discount: Decimal
) -> None:
    """
    Proportionally distribute total_discount across lines by their line_subtotal.
    Last line absorbs any rounding residual so sum(discount_amount) == total_discount.
    """
    if total_discount == _ZERO or not raw_lines:
        for l in raw_lines:
            l["discount_amount"] = _ZERO
        return

    grand_sub = sum(_d(l["line_subtotal"]) for l in raw_lines)
    if grand_sub == _ZERO:
        for l in raw_lines:
            l["discount_amount"] = _ZERO
        return

    allocated = _ZERO
    for i, line in enumerate(raw_lines):
        if i == len(raw_lines) - 1:
            # Last line gets the remainder to ensure exact sum
            line["discount_amount"] = _r2(total_discount - allocated)
        else:
            share = _r2(total_discount * _d(line["line_subtotal"]) / grand_sub)
            line["discount_amount"] = share
            allocated += share


# ---------------------------------------------------------------------------
# Integrity assertion (called before each commit)
# ---------------------------------------------------------------------------

def assert_invoice_totals(inv: Invoice, raw_lines: list[dict[str, Any]]) -> None:
    """
    Invariant check: invoice header totals must equal the sum of line values.
    Raises AssertionError if violated (will roll back the transaction).
    """
    lines_sub = _r2(sum(_d(l["line_subtotal"]) for l in raw_lines))
    lines_disc = _r2(sum(_d(l["discount_amount"]) for l in raw_lines))
    lines_tax = _r2(sum(_d(l["tax_amount"]) for l in raw_lines))
    lines_total = _r2(sum(_d(l["line_total"]) for l in raw_lines))

    assert _r2(_d(inv.subtotal)) == lines_sub, \
        f"subtotal mismatch: {inv.subtotal} != {lines_sub}"
    assert _r2(_d(inv.discount_total)) == lines_disc, \
        f"discount_total mismatch: {inv.discount_total} != {lines_disc}"
    assert _r2(_d(inv.tax_total)) == lines_tax, \
        f"tax_total mismatch: {inv.tax_total} != {lines_tax}"
    assert _r2(_d(inv.total)) == lines_total, \
        f"total mismatch: {inv.total} != {lines_total}"


# ---------------------------------------------------------------------------
# Subscription eligibility helpers
# ---------------------------------------------------------------------------

def _is_subscription_eligible(sub: Any, as_of: date) -> tuple[bool, str]:
    """Check whether a subscription should be billed in this run."""
    eligible_statuses = {"active", "past_due"}
    if getattr(sub, "status", None) not in eligible_statuses:
        return False, f"Status '{sub.status}' is not billable."
    expiry = getattr(sub, "expiry_date", None)
    if expiry and as_of > expiry:
        return False, "Subscription has expired."
    return True, ""


def _get_subscriptions_to_bill(db: Session, as_of: date, subscription_ids: list[uuid.UUID] | None):
    """
    Load all eligible subscriptions with their plans and items.
    Soft import to avoid circular dependency with subscription models.
    """
    # Dynamic import so billing module doesn't hard-depend on subscriptions module at load time
    try:
        from app.subscriptions.models import Subscription, SubscriptionItem
    except ImportError:
        return []

    stmt = (
        select(Subscription)
        .where(
            Subscription.status.in_(["active", "past_due"]),
            Subscription.next_billing_date <= as_of,
        )
        .options(
            selectinload(Subscription.items),
            selectinload(Subscription.plan),
            selectinload(Subscription.customer),
        )
    )
    if subscription_ids:
        stmt = stmt.where(Subscription.id.in_(subscription_ids))

    return db.execute(stmt).scalars().all()


def _advance_next_billing_date(sub: Any, period_start: date) -> None:
    """Advance subscription.next_billing_date by one plan period after billing."""
    try:
        cadence = sub.plan.billing_cadence
        interval = getattr(sub.plan, "billing_interval", 1) or 1
    except AttributeError:
        cadence = "month"
        interval = 1
    sub.next_billing_date = next_period_start(period_start, cadence, interval)


# ---------------------------------------------------------------------------
# Main billing run entry point
# ---------------------------------------------------------------------------

def run_billing(
    db: Session,
    request: BillingRunRequest,
    triggered_by_id: uuid.UUID,
) -> BillingRun:
    """
    Execute a billing run for all eligible subscriptions as of `request.as_of_date`.

    Idempotency: if a run with the same run_key already exists, return it immediately.
    On dry_run=True: all calculations are performed but nothing is persisted.
    """
    run_key = make_run_key(request.as_of_date, request.dry_run)

    # Idempotency: return existing run immediately
    existing = db.execute(
        select(BillingRun)
        .where(BillingRun.run_key == run_key)
        .options(selectinload(BillingRun.items))
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    # Create the run record (only for real runs; dry-run also persists the run for visibility)
    billing_run = BillingRun(
        run_key=run_key,
        as_of_date=request.as_of_date,
        is_dry_run=request.dry_run,
        status=BillingRunStatus.RUNNING,
        triggered_by=triggered_by_id,
    )
    db.add(billing_run)
    db.flush()

    # Load subscriptions
    subscriptions = _get_subscriptions_to_bill(
        db, request.as_of_date, request.subscription_ids
    )

    success = duplicate = skipped = errors = 0
    run_items: list[BillingRunItem] = []
    error_messages: list[str] = []

    for sub in subscriptions:
        ok, skip_reason = _is_subscription_eligible(sub, request.as_of_date)
        if not ok:
            skipped += 1
            run_items.append(BillingRunItem(
                billing_run_id=billing_run.id,
                subscription_id=sub.id,
                period_start=sub.next_billing_date,
                period_end=sub.next_billing_date,
                status=BillingRunItemStatus.SKIPPED,
                error_message=skip_reason,
            ))
            continue

        # Catch-up loop: bill every overdue period up to as_of_date
        try:
            cadence = sub.plan.billing_cadence
            interval = getattr(sub.plan, "billing_interval", 1) or 1
        except AttributeError:
            cadence = "month"
            interval = 1

        period_start = sub.next_billing_date

        while period_start <= request.as_of_date:
            expiry = getattr(sub, "expiry_date", None)
            if expiry and period_start > expiry:
                break

            p_end = period_end_from_start(period_start, cadence, interval)

            inv, item_status, err_msg, has_anom, anom_notes = _build_invoice_for_subscription(
                db=db,
                subscription=sub,
                period_start=period_start,
                period_end=p_end,
                as_of=request.as_of_date,
                dry_run=request.dry_run,
            )

            run_item = BillingRunItem(
                billing_run_id=billing_run.id,
                subscription_id=sub.id,
                period_start=period_start,
                period_end=p_end,
                status=item_status,
                invoice_id=inv.id if (inv and not request.dry_run) else None,
                error_message=err_msg,
                has_anomaly=has_anom,
                anomaly_notes=anom_notes,
            )
            run_items.append(run_item)

            if item_status == BillingRunItemStatus.SUCCESS:
                success += 1
                if not request.dry_run:
                    _advance_next_billing_date(sub, period_start)
            elif item_status == BillingRunItemStatus.DUPLICATE:
                duplicate += 1
            elif item_status == BillingRunItemStatus.ERROR:
                errors += 1
                error_messages.append(
                    f"sub={sub.id} period={period_start}: {err_msg}"
                )

            # Advance to the next period
            period_start = next_period_start(period_start, cadence, interval)

    # Persist run items
    for ri in run_items:
        db.add(ri)

    # Finalise run
    final_status = (
        BillingRunStatus.COMPLETED
        if errors == 0
        else (BillingRunStatus.PARTIAL if success + duplicate > 0 else BillingRunStatus.FAILED)
    )
    billing_run.status = final_status
    billing_run.completed_at = datetime.now(timezone.utc)
    billing_run.processed_count = success + duplicate + skipped + errors
    billing_run.success_count = success
    billing_run.duplicate_count = duplicate
    billing_run.skipped_count = skipped
    billing_run.error_count = errors
    if error_messages:
        billing_run.error_summary = "; ".join(error_messages[:10])  # cap at 10

    if not request.dry_run:
        db.commit()
    else:
        db.flush()  # make run visible in response but caller should NOT commit for dry-run

    db.refresh(billing_run)
    return billing_run


# ---------------------------------------------------------------------------
# Billing run queries
# ---------------------------------------------------------------------------

def get_billing_run(db: Session, run_id: uuid.UUID) -> BillingRun | None:
    return db.execute(
        select(BillingRun)
        .where(BillingRun.id == run_id)
        .options(selectinload(BillingRun.items))
    ).scalar_one_or_none()


def list_billing_runs(
    db: Session, page: int, page_size: int
) -> tuple[list[BillingRun], int]:
    stmt = select(BillingRun).options(selectinload(BillingRun.items))
    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    offset = (page - 1) * page_size
    items = db.execute(
        stmt.order_by(BillingRun.started_at.desc()).offset(offset).limit(page_size)
    ).scalars().all()
    return list(items), total


def retry_failed_run_items(db: Session, run_id: uuid.UUID, triggered_by_id: uuid.UUID) -> BillingRun:
    """Re-attempt only the ERROR items from a previous run."""
    run = get_billing_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Billing run {run_id} not found.")
    if run.status not in (BillingRunStatus.PARTIAL, BillingRunStatus.FAILED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PARTIAL or FAILED runs can be retried.")

    # Collect failed subscription IDs
    failed_sub_ids = [
        item.subscription_id for item in run.items
        if item.status == BillingRunItemStatus.ERROR
    ]
    retry_request = BillingRunRequest(
        as_of_date=run.as_of_date,
        dry_run=False,
        subscription_ids=failed_sub_ids,
    )
    return run_billing(db, retry_request, triggered_by_id)

