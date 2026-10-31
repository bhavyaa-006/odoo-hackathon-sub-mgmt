"""
Discount Service — core business logic.

All monetary arithmetic uses Python's decimal.Decimal with ROUND_HALF_UP.
No float is used for money math anywhere in this module.

Key design decisions (per playbook + schema doc)
-------------------------------------------------
1. discount_type:  "percentage" (0-100%) or "fixed" (flat INR).
2. scope:          "subscription" (whole subtotal), "product", "plan".
3. recurrence:     "once" | "repeating" (up to max_applications) | "forever".
4. Stacking:       priority-ordered; non-stacking discounts are mutually
                   exclusive — highest-priority wins.  Stacking discounts
                   are applied sequentially on the running subtotal.
5. Usage counters: incremented atomically in the same transaction as the
                   invoice row insert (via the billing engine calling
                   commit_discount_applications).
6. Per-customer limits enforced via subscription_discounts.per_customer_usage.
7. Eligibility window: is_active=True, within starts_at/ends_at, under usage_limit.
8. Historical accuracy: once an InvoiceDiscount row is written it is never
   changed; the Discount master row may evolve independently.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.discounts.models import (
    Discount,
    DiscountPlan,
    DiscountProduct,
    DiscountRecurrence,
    DiscountScope,
    DiscountType,
    InvoiceDiscount,
    SubscriptionDiscount,
)
from app.discounts.schemas import (
    DiscountApplicationResult,
    DiscountCreate,
    DiscountEligibilityRequest,
    DiscountEligibilityResponse,
    DiscountUpdate,
    MultiDiscountApplicationRequest,
    MultiDiscountApplicationResponse,
    SubscriptionDiscountAssign,
)


# ---------------------------------------------------------------------------
# Decimal helpers
# ---------------------------------------------------------------------------

_TWO = Decimal("0.01")
_HUNDRED = Decimal("100")
_ZERO = Decimal("0")


def _d(value: object) -> Decimal:
    """Safely convert any numeric type to Decimal."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _round2(value: Decimal) -> Decimal:
    """Round to 2 decimal places (paise) using ROUND_HALF_UP."""
    return value.quantize(_TWO, rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Eligibility helpers
# ---------------------------------------------------------------------------

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_within_window(discount: Discount, now: datetime) -> tuple[bool, str]:
    """Check starts_at / ends_at window."""
    if discount.starts_at and now < discount.starts_at.replace(tzinfo=timezone.utc):
        return False, f"Discount '{discount.code}' is not yet active (starts {discount.starts_at.date()})."
    if discount.ends_at and now > discount.ends_at.replace(tzinfo=timezone.utc):
        return False, f"Discount '{discount.code}' has expired (ended {discount.ends_at.date()})."
    return True, ""


def _is_under_global_limit(discount: Discount) -> tuple[bool, str]:
    if discount.usage_limit is not None and discount.usage_count >= discount.usage_limit:
        return False, f"Discount '{discount.code}' has reached its maximum usage limit."
    return True, ""


def _meets_minimum_purchase(discount: Discount, subtotal: Decimal) -> tuple[bool, str]:
    if discount.minimum_purchase is not None:
        threshold = _d(discount.minimum_purchase)
        if subtotal < threshold:
            return (
                False,
                f"Invoice subtotal ₹{subtotal} is below the minimum purchase of ₹{threshold} required for '{discount.code}'.",
            )
    return True, ""


def _meets_minimum_quantity(discount: Discount, quantity: int) -> tuple[bool, str]:
    if discount.minimum_quantity is not None and quantity < discount.minimum_quantity:
        return (
            False,
            f"Item quantity {quantity} is below the minimum of {discount.minimum_quantity} required for '{discount.code}'.",
        )
    return True, ""


def _is_scope_eligible(
    discount: Discount,
    plan_ids: list[uuid.UUID],
    product_ids: list[uuid.UUID],
) -> tuple[bool, str]:
    """Check that invoice contains the required product/plan when scope != subscription."""
    if discount.scope == DiscountScope.PRODUCT:
        scoped_ids = {dp.product_id for dp in discount.discount_products}
        if not scoped_ids.intersection(product_ids):
            return False, f"Discount '{discount.code}' is not applicable to any of the invoice's products."
    elif discount.scope == DiscountScope.PLAN:
        scoped_ids = {dp.plan_id for dp in discount.discount_plans}
        if not scoped_ids.intersection(plan_ids):
            return False, f"Discount '{discount.code}' is not applicable to any of the invoice's plans."
    return True, ""


def _is_sub_discount_still_eligible(
    sub_discount: SubscriptionDiscount,
    discount: Discount,
) -> tuple[bool, str]:
    """Check per-subscription recurrence limits."""
    if not sub_discount.is_active:
        return False, f"Discount '{discount.code}' assignment for this subscription is no longer active."

    if discount.recurrence == DiscountRecurrence.ONCE and sub_discount.times_applied >= 1:
        return False, f"Discount '{discount.code}' is a one-time discount and has already been applied."

    if discount.recurrence == DiscountRecurrence.REPEATING:
        limit = sub_discount.max_applications
        if limit is not None and sub_discount.times_applied >= limit:
            return (
                False,
                f"Discount '{discount.code}' has been applied {sub_discount.times_applied}/{limit} times for this subscription.",
            )

    if discount.per_customer_limit is not None:
        if sub_discount.per_customer_usage >= discount.per_customer_limit:
            return (
                False,
                f"Per-customer usage limit of {discount.per_customer_limit} reached for discount '{discount.code}'.",
            )

    return True, ""


# ---------------------------------------------------------------------------
# Compute deduction amount
# ---------------------------------------------------------------------------

def compute_discount_amount(
    discount: Discount,
    subtotal: Decimal,
) -> Decimal:
    """
    Compute the INR amount to deduct for a single discount.

    - PERCENTAGE: value% of subtotal, rounded to 2 dp (paise), ROUND_HALF_UP.
    - FIXED: min(value, subtotal) so we never produce a negative subtotal.
    """
    value = _d(discount.value)
    if discount.discount_type == DiscountType.PERCENTAGE:
        amount = _round2(subtotal * value / _HUNDRED)
    else:  # FIXED
        amount = _round2(min(value, subtotal))
    return max(amount, _ZERO)


# ---------------------------------------------------------------------------
# Full eligibility check (single discount by code)
# ---------------------------------------------------------------------------

def check_eligibility(
    db: Session,
    request: DiscountEligibilityRequest,
) -> DiscountEligibilityResponse:
    """
    Check whether a discount code is eligible for the given invoice context.

    Does NOT increment any counters — purely a read operation.
    """
    discount = _get_discount_by_code(db, request.code)
    if discount is None:
        return DiscountEligibilityResponse(
            code=request.code.upper(),
            discount=None,
            is_eligible=False,
            ineligibility_reason=f"Discount code '{request.code}' not found.",
            preview_amount_deducted=None,
        )

    if not discount.is_active:
        return DiscountEligibilityResponse(
            code=request.code.upper(),
            discount=None,
            is_eligible=False,
            ineligibility_reason=f"Discount '{request.code}' is inactive.",
            preview_amount_deducted=None,
        )

    now = _now_utc()
    subtotal = _d(request.invoice_subtotal)

    # Run all eligibility gates
    checks = [
        _is_within_window(discount, now),
        _is_under_global_limit(discount),
        _meets_minimum_purchase(discount, subtotal),
        _meets_minimum_quantity(discount, request.total_quantity),
        _is_scope_eligible(discount, request.plan_ids, request.product_ids),
    ]
    for ok, reason in checks:
        if not ok:
            from app.discounts.schemas import DiscountResponse
            return DiscountEligibilityResponse(
                code=request.code.upper(),
                discount=DiscountResponse.model_validate(discount),
                is_eligible=False,
                ineligibility_reason=reason,
                preview_amount_deducted=None,
            )

    # If subscription context provided, check per-subscription limits
    if request.subscription_id:
        sub_discount = _get_active_subscription_discount(
            db, request.subscription_id, discount.id
        )
        if sub_discount:
            ok, reason = _is_sub_discount_still_eligible(sub_discount, discount)
            if not ok:
                from app.discounts.schemas import DiscountResponse
                return DiscountEligibilityResponse(
                    code=request.code.upper(),
                    discount=DiscountResponse.model_validate(discount),
                    is_eligible=False,
                    ineligibility_reason=reason,
                    preview_amount_deducted=None,
                )

    preview = compute_discount_amount(discount, subtotal)
    from app.discounts.schemas import DiscountResponse
    return DiscountEligibilityResponse(
        code=request.code.upper(),
        discount=DiscountResponse.model_validate(discount),
        is_eligible=True,
        ineligibility_reason=None,
        preview_amount_deducted=preview,
    )


# ---------------------------------------------------------------------------
# Apply discounts to a subscription invoice (billing engine entry point)
# ---------------------------------------------------------------------------

def apply_discounts_to_invoice(
    db: Session,
    request: MultiDiscountApplicationRequest,
) -> MultiDiscountApplicationResponse:
    """
    Resolve and apply all eligible discounts for a subscription invoice.

    Algorithm
    ---------
    1. Load all active SubscriptionDiscount rows for the subscription,
       ordered by Discount.priority ASC (lower = applied first).
    2. For each sub_discount, run full eligibility checks.
    3. Separate into stacking vs non-stacking:
       - Non-stacking: pick only the highest-priority eligible one.
       - Stacking: apply all, sequentially on the running subtotal.
    4. Compute deduction amounts in order.
    5. If commit=True: atomically increment usage_count on each Discount and
       per_customer_usage + times_applied on each SubscriptionDiscount, then
       deactivate assignments that have reached their limit.
    6. Return the full breakdown.
    """
    now = _now_utc()
    subtotal = _d(request.invoice_subtotal)

    # Load active subscription discount assignments with their parent discount
    stmt = (
        select(SubscriptionDiscount)
        .where(
            SubscriptionDiscount.subscription_id == request.subscription_id,
            SubscriptionDiscount.is_active.is_(True),
        )
        .options(
            selectinload(SubscriptionDiscount.discount).selectinload(Discount.discount_products),
            selectinload(SubscriptionDiscount.discount).selectinload(Discount.discount_plans),
        )
        .join(Discount)
        .order_by(Discount.priority.asc())
    )
    sub_discounts: Sequence[SubscriptionDiscount] = db.execute(stmt).scalars().all()

    # Collect eligible results
    eligible_stacking: list[tuple[SubscriptionDiscount, Discount]] = []
    eligible_non_stacking: list[tuple[SubscriptionDiscount, Discount]] = []

    for sd in sub_discounts:
        d = sd.discount
        if not d.is_active:
            continue

        all_ok = True
        for ok, _ in [
            _is_within_window(d, now),
            _is_under_global_limit(d),
            _meets_minimum_purchase(d, subtotal),
            _meets_minimum_quantity(d, request.total_quantity),
            _is_scope_eligible(d, request.plan_ids, request.product_ids),
            _is_sub_discount_still_eligible(sd, d),
        ]:
            if not ok:
                all_ok = False
                break

        if not all_ok:
            continue

        if d.allow_stacking:
            eligible_stacking.append((sd, d))
        else:
            eligible_non_stacking.append((sd, d))

    # For non-stacking, pick only the first (highest priority, lowest priority number)
    chosen_non_stacking = eligible_non_stacking[:1]

    # Final ordered list: non-stacking first (priority-ordered), then stacking
    chosen: list[tuple[SubscriptionDiscount, Discount]] = chosen_non_stacking + eligible_stacking

    # Compute deductions
    results: list[DiscountApplicationResult] = []
    running_subtotal = subtotal

    for sd, d in chosen:
        amount = compute_discount_amount(d, running_subtotal)
        result = DiscountApplicationResult(
            discount_id=d.id,
            discount_code=d.code,
            discount_name=d.name,
            discount_type=d.discount_type.value,
            discount_value=_d(d.value),
            scope=d.scope.value,
            amount_deducted=amount,
            subtotal_before=running_subtotal,
            subtotal_after=_round2(running_subtotal - amount),
            is_eligible=True,
            ineligibility_reason=None,
        )
        results.append(result)
        running_subtotal = result.subtotal_after

    total_deducted = _round2(subtotal - running_subtotal)

    # Commit usage counters if requested (billing engine passes commit=True)
    if request.commit and results:
        for sd, d in chosen:
            # Atomically increment global usage counter
            d.usage_count = (d.usage_count or 0) + 1

            # Increment per-subscription counters
            sd.times_applied = (sd.times_applied or 0) + 1
            sd.per_customer_usage = (sd.per_customer_usage or 0) + 1

            # Deactivate if limits reached
            _maybe_deactivate_subscription_discount(sd, d)

        db.flush()  # write within the caller's transaction; caller commits

    return MultiDiscountApplicationResponse(
        subscription_id=request.subscription_id,
        invoice_subtotal=subtotal,
        applied_discounts=results,
        total_discount_amount=total_deducted,
        final_subtotal=running_subtotal,
        committed=request.commit,
    )


def _maybe_deactivate_subscription_discount(
    sd: SubscriptionDiscount, d: Discount
) -> None:
    """Deactivate a subscription discount assignment when its limit is reached."""
    if d.recurrence == DiscountRecurrence.ONCE and sd.times_applied >= 1:
        sd.is_active = False
        sd.deactivated_at = _now_utc()
    elif d.recurrence == DiscountRecurrence.REPEATING:
        if sd.max_applications is not None and sd.times_applied >= sd.max_applications:
            sd.is_active = False
            sd.deactivated_at = _now_utc()
    # FOREVER: never auto-deactivate (only global usage_limit can stop it)

    if d.usage_limit is not None and d.usage_count >= d.usage_limit:
        # Global limit hit — deactivate all remaining subscription assignments
        # (caller should handle batch; here we just ensure this one is deactivated)
        sd.is_active = False
        sd.deactivated_at = _now_utc()


# ---------------------------------------------------------------------------
# Write InvoiceDiscount snapshot rows (called by billing engine after commit)
# ---------------------------------------------------------------------------

def write_invoice_discount_snapshots(
    db: Session,
    invoice_id: uuid.UUID,
    applied: list[DiscountApplicationResult],
    sub_discount_map: dict[uuid.UUID, uuid.UUID],  # discount_id → subscription_discount_id
) -> list[InvoiceDiscount]:
    """
    Persist InvoiceDiscount snapshot rows for every discount applied to an invoice.

    Called once per invoice within the billing engine's transaction.
    These rows are immutable; historical invoice totals never change.
    """
    rows: list[InvoiceDiscount] = []
    for result in applied:
        if not result.is_eligible:
            continue
        row = InvoiceDiscount(
            invoice_id=invoice_id,
            discount_id=result.discount_id,
            subscription_discount_id=sub_discount_map.get(result.discount_id),
            description=f"{result.discount_name} ({result.discount_code})",
            discount_code=result.discount_code,
            discount_type=result.discount_type,
            discount_value=result.discount_value,
            amount=result.amount_deducted,
            scope=result.scope,
        )
        db.add(row)
        rows.append(row)
    db.flush()
    return rows


# ---------------------------------------------------------------------------
# CRUD — Discount
# ---------------------------------------------------------------------------

def create_discount(
    db: Session,
    data: DiscountCreate,
    created_by_id: uuid.UUID,
) -> Discount:
    """Create a new discount with its product/plan scope assignments."""
    # Ensure code uniqueness (enforced by DB UNIQUE but give a nice 409 first)
    existing = _get_discount_by_code(db, data.code)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A discount with code '{data.code}' already exists.",
        )

    discount = Discount(
        code=data.code,
        name=data.name,
        description=data.description,
        discount_type=data.discount_type,
        value=data.value,
        scope=data.scope,
        recurrence=data.recurrence,
        minimum_purchase=data.minimum_purchase,
        minimum_quantity=data.minimum_quantity,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        usage_limit=data.usage_limit,
        per_customer_limit=data.per_customer_limit,
        allow_stacking=data.allow_stacking,
        priority=data.priority,
        is_active=data.is_active,
        created_by=created_by_id,
    )
    db.add(discount)
    db.flush()  # get discount.id before adding children

    # Product scope assignments
    for pid in data.product_ids:
        db.add(DiscountProduct(discount_id=discount.id, product_id=pid))

    # Plan scope assignments
    for plid in data.plan_ids:
        db.add(DiscountPlan(discount_id=discount.id, plan_id=plid))

    db.commit()
    db.refresh(discount)
    return discount


def get_discount(db: Session, discount_id: uuid.UUID) -> Discount | None:
    """Fetch a discount by primary key, eagerly loading scope assignments."""
    stmt = (
        select(Discount)
        .where(Discount.id == discount_id)
        .options(
            selectinload(Discount.discount_products),
            selectinload(Discount.discount_plans),
        )
    )
    return db.execute(stmt).scalar_one_or_none()


def get_discount_or_404(db: Session, discount_id: uuid.UUID) -> Discount:
    d = get_discount(db, discount_id)
    if d is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Discount {discount_id} not found.",
        )
    return d


def list_discounts(
    db: Session,
    is_active: bool | None,
    scope: DiscountScope | None,
    discount_type: DiscountType | None,
    page: int,
    page_size: int,
) -> tuple[list[Discount], int]:
    """Paginated list with optional filters."""
    stmt = select(Discount).options(
        selectinload(Discount.discount_products),
        selectinload(Discount.discount_plans),
    )
    if is_active is not None:
        stmt = stmt.where(Discount.is_active == is_active)
    if scope is not None:
        stmt = stmt.where(Discount.scope == scope)
    if discount_type is not None:
        stmt = stmt.where(Discount.discount_type == discount_type)

    total: int = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    items = (
        db.execute(
            stmt.order_by(Discount.priority.asc(), Discount.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return list(items), total


def update_discount(
    db: Session,
    discount_id: uuid.UUID,
    data: DiscountUpdate,
    updated_by_id: uuid.UUID,
) -> Discount:
    """Partial update. Replaces scope assignments when product_ids/plan_ids provided."""
    discount = get_discount_or_404(db, discount_id)

    update_fields = data.model_dump(exclude_unset=True, exclude={"product_ids", "plan_ids"})

    # Validate percentage range if value or type being updated
    new_type = update_fields.get("discount_type", discount.discount_type)
    new_value = update_fields.get("value", discount.value)
    if new_type == DiscountType.PERCENTAGE:
        val = _d(new_value)
        if not (0 < val <= 100):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Percentage discount value must be between 0 (exclusive) and 100.",
            )

    for field, value in update_fields.items():
        setattr(discount, field, value)

    # Replace product scope assignments if provided
    if data.product_ids is not None:
        for dp in list(discount.discount_products):
            db.delete(dp)
        db.flush()
        for pid in data.product_ids:
            db.add(DiscountProduct(discount_id=discount.id, product_id=pid))

    # Replace plan scope assignments if provided
    if data.plan_ids is not None:
        for dp in list(discount.discount_plans):
            db.delete(dp)
        db.flush()
        for plid in data.plan_ids:
            db.add(DiscountPlan(discount_id=discount.id, plan_id=plid))

    db.commit()
    db.refresh(discount)
    return discount


def deactivate_discount(db: Session, discount_id: uuid.UUID) -> Discount:
    """
    Soft-delete a discount.

    Also deactivates all active subscription_discount assignments so the
    billing engine will not try to apply this discount on future invoices.
    """
    discount = get_discount_or_404(db, discount_id)
    discount.is_active = False

    # Deactivate all subscription assignments
    stmt = select(SubscriptionDiscount).where(
        SubscriptionDiscount.discount_id == discount_id,
        SubscriptionDiscount.is_active.is_(True),
    )
    active_assignments = db.execute(stmt).scalars().all()
    now = _now_utc()
    for sd in active_assignments:
        sd.is_active = False
        sd.deactivated_at = now

    db.commit()
    db.refresh(discount)
    return discount


# ---------------------------------------------------------------------------
# CRUD — SubscriptionDiscount
# ---------------------------------------------------------------------------

def assign_discount_to_subscription(
    db: Session,
    subscription_id: uuid.UUID,
    data: SubscriptionDiscountAssign,
    assigned_by_id: uuid.UUID,
) -> SubscriptionDiscount:
    """
    Assign a discount to a subscription.

    Rules
    -----
    - The discount must be active and within its validity window.
    - A discount cannot be assigned twice to the same subscription while active
      (unique constraint on subscription_id + discount_id).
    """
    discount = get_discount_or_404(db, data.discount_id)

    if not discount.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discount '{discount.code}' is inactive and cannot be assigned.",
        )

    now = _now_utc()
    ok, reason = _is_within_window(discount, now)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    ok, reason = _is_under_global_limit(discount)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    # Check for existing active assignment
    existing = _get_active_subscription_discount(db, subscription_id, discount.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Discount '{discount.code}' is already actively assigned to this subscription.",
        )

    sd = SubscriptionDiscount(
        subscription_id=subscription_id,
        discount_id=discount.id,
        max_applications=data.max_applications,
        assigned_by=assigned_by_id,
    )
    db.add(sd)
    db.commit()
    db.refresh(sd)
    return sd


def revoke_subscription_discount(
    db: Session,
    subscription_id: uuid.UUID,
    subscription_discount_id: uuid.UUID,
) -> SubscriptionDiscount:
    """Manually deactivate a subscription discount assignment."""
    sd = _get_subscription_discount_by_id(db, subscription_discount_id)
    if sd is None or sd.subscription_id != subscription_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription discount {subscription_discount_id} not found for this subscription.",
        )
    if not sd.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This discount assignment is already inactive.",
        )
    sd.is_active = False
    sd.deactivated_at = _now_utc()
    db.commit()
    db.refresh(sd)
    return sd


def list_subscription_discounts(
    db: Session,
    subscription_id: uuid.UUID,
    is_active: bool | None,
    page: int,
    page_size: int,
) -> tuple[list[SubscriptionDiscount], int]:
    stmt = (
        select(SubscriptionDiscount)
        .where(SubscriptionDiscount.subscription_id == subscription_id)
        .options(
            selectinload(SubscriptionDiscount.discount).selectinload(Discount.discount_products),
            selectinload(SubscriptionDiscount.discount).selectinload(Discount.discount_plans),
        )
    )
    if is_active is not None:
        stmt = stmt.where(SubscriptionDiscount.is_active == is_active)

    total: int = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    items = (
        db.execute(
            stmt.order_by(SubscriptionDiscount.applied_at.desc()).offset(offset).limit(page_size)
        )
        .scalars()
        .all()
    )
    return list(items), total


# ---------------------------------------------------------------------------
# CRUD — InvoiceDiscount (read-only)
# ---------------------------------------------------------------------------

def list_invoice_discounts(
    db: Session,
    invoice_id: uuid.UUID,
    page: int,
    page_size: int,
) -> tuple[list[InvoiceDiscount], int]:
    stmt = select(InvoiceDiscount).where(InvoiceDiscount.invoice_id == invoice_id)
    total: int = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()
    offset = (page - 1) * page_size
    items = (
        db.execute(
            stmt.order_by(InvoiceDiscount.created_at.asc()).offset(offset).limit(page_size)
        )
        .scalars()
        .all()
    )
    return list(items), total


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_discount_by_code(db: Session, code: str) -> Discount | None:
    stmt = (
        select(Discount)
        .where(Discount.code == code.strip().upper())
        .options(
            selectinload(Discount.discount_products),
            selectinload(Discount.discount_plans),
        )
    )
    return db.execute(stmt).scalar_one_or_none()


def _get_active_subscription_discount(
    db: Session, subscription_id: uuid.UUID, discount_id: uuid.UUID
) -> SubscriptionDiscount | None:
    stmt = select(SubscriptionDiscount).where(
        SubscriptionDiscount.subscription_id == subscription_id,
        SubscriptionDiscount.discount_id == discount_id,
        SubscriptionDiscount.is_active.is_(True),
    )
    return db.execute(stmt).scalar_one_or_none()


def _get_subscription_discount_by_id(
    db: Session, sd_id: uuid.UUID
) -> SubscriptionDiscount | None:
    return db.get(SubscriptionDiscount, sd_id)

