"""
Tax Service — core business logic for Indian GST calculations.

ALL monetary arithmetic uses Python's decimal.Decimal with ROUND_HALF_UP.
No float is used for money math anywhere in this module.

Key references:
  - CGST Act 2017
  - IGST Act 2017 — Section 12 (Place of Supply rules)
  - Section 170 CGST Act (rounding)
  - Rule 46 CGST Rules (mandatory invoice fields)
"""

from __future__ import annotations

import re
import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.taxes.models import TaxCalculation, TaxRule, TransactionType
from app.taxes.schemas import TaxBreakdown, TaxCalculationRequest, TaxRuleCreate, TaxRuleUpdate

# ---------------------------------------------------------------------------
# Indian State Code Registry
# GST Council — first 2 digits of a GSTIN identify the state/UT.
# ---------------------------------------------------------------------------

INDIAN_STATE_CODES: dict[str, str] = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Other Country",
}

# GSTIN format:
#   [0-1]   2 digits  → state code
#   [2-11]  10 chars  → PAN (5 alpha + 4 digits + 1 alpha)
#   [12]    1 char    → entity number (1-9 or A-Z)
#   [13]    1 char    → always 'Z'
#   [14]    1 char    → checksum (alphanumeric)
_GSTIN_RE = re.compile(
    r"^(\d{2})"           # state code
    r"([A-Z]{5}\d{4}[A-Z])"  # PAN
    r"([1-9A-Z])"         # entity number
    r"Z"                   # always Z
    r"([0-9A-Z])$"         # checksum
)

# Luhn-like checksum character set used by GST portal
_GSTIN_CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


# ---------------------------------------------------------------------------
# GSTIN utilities
# ---------------------------------------------------------------------------

def _compute_gstin_checksum(gstin14: str) -> str:
    """
    Compute the 15th character (checksum) of a 14-character partial GSTIN.

    The algorithm used by the GSTN is:
      1. Map each character to its index in the alphanumeric string
         "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".
      2. Multiply odd-positioned values (1-based) by 1, even-positioned by 2.
      3. For products >= 36, add the digits of the result (i.e., quotient + remainder
         after dividing by 36, following the same base-36 digit-sum logic).
      4. Sum all these processed values.
      5. Checksum = (36 - (sum % 36)) % 36, mapped back to the charset.
    """
    total = 0
    for i, ch in enumerate(gstin14):
        val = _GSTIN_CHECKSUM_CHARS.index(ch)
        if i % 2 != 0:  # even position (0-based odd index = 1-based even)
            val *= 2
        # Base-36 digit sum
        total += val // 36 + val % 36
    checksum_index = (36 - (total % 36)) % 36
    return _GSTIN_CHECKSUM_CHARS[checksum_index]


def validate_gstin(gstin: str) -> tuple[bool, str, str]:
    """
    Validate GSTIN format and checksum.

    Returns:
        (is_valid: bool, state_code: str, error_message: str)
        On success: (True, "27", "")
        On failure: (False, "", "<reason>")
    """
    if not gstin:
        return False, "", "GSTIN cannot be empty."

    gstin = gstin.strip().upper()

    if len(gstin) != 15:
        return False, "", f"GSTIN must be exactly 15 characters; got {len(gstin)}."

    m = _GSTIN_RE.match(gstin)
    if not m:
        return (
            False,
            "",
            "GSTIN format invalid. Expected: <2-digit state><5-alpha PAN><4-digit PAN>"
            "<1-alpha PAN><entity-no><Z><checksum>.",
        )

    state_code = m.group(1)
    if state_code not in INDIAN_STATE_CODES:
        return False, "", f"Unknown state code '{state_code}' in GSTIN."

    # Validate checksum (15th char)
    expected_checksum = _compute_gstin_checksum(gstin[:14])
    if gstin[14] != expected_checksum:
        return (
            False,
            "",
            f"GSTIN checksum mismatch: expected '{expected_checksum}', "
            f"got '{gstin[14]}'.",
        )

    return True, state_code, ""


def extract_state_code(gstin: str) -> str:
    """
    Extract the 2-digit state code from a GSTIN.

    Does NOT validate the full GSTIN; call validate_gstin first when needed.
    """
    if not gstin or len(gstin) < 2:
        raise ValueError(f"Cannot extract state code from GSTIN '{gstin}'.")
    return gstin[:2].upper()


def get_state_name(state_code: str) -> str:
    """
    Return the state/UT name for a 2-digit Indian state code.

    Raises ValueError for unknown codes.
    """
    name = INDIAN_STATE_CODES.get(state_code)
    if name is None:
        raise ValueError(f"Unknown Indian state code: '{state_code}'.")
    return name


# ---------------------------------------------------------------------------
# Transaction type determination
# ---------------------------------------------------------------------------

def determine_transaction_type(
    supplier_state_code: str | None,
    customer_state_code: str | None,
    is_export: bool = False,
) -> TransactionType:
    """
    Determine GST transaction type.

    Rules (Section 12, IGST Act 2017):
      - Export (overseas) → EXPORT (zero-rated)
      - Supplier state == Customer state → INTRASTATE (CGST + SGST)
      - Supplier state != Customer state → INTERSTATE (IGST)
      - Either party state unknown → default to INTERSTATE (conservative)
    """
    if is_export:
        return TransactionType.EXPORT

    if supplier_state_code and customer_state_code:
        if supplier_state_code.strip() == customer_state_code.strip():
            return TransactionType.INTRASTATE
        return TransactionType.INTERSTATE

    # When supply geography is unknown we default to INTERSTATE (IGST) which is
    # the safe/conservative choice: it avoids incorrectly splitting into
    # CGST+SGST for a state that might differ.
    return TransactionType.INTERSTATE


# ---------------------------------------------------------------------------
# Core calculation engine
# ---------------------------------------------------------------------------

_TWO_PLACES = Decimal("0.01")
_FOUR_PLACES = Decimal("0.0001")
_ONE = Decimal("1")
_HUNDRED = Decimal("100")
_ZERO = Decimal("0")


def _to_decimal(value: object) -> Decimal:
    """Safely convert a value (int, float, str, Decimal) to Decimal."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def calculate_tax(
    db: Session,
    taxable_amount: Decimal,
    tax_rule: TaxRule,
    transaction_type: TransactionType,
    supplier_gstin: str | None = None,
    customer_gstin: str | None = None,
    supplier_state_code: str | None = None,
    customer_state_code: str | None = None,
    is_rcm: bool = False,
    save_log: bool = True,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
) -> TaxBreakdown:
    """
    Core GST calculation engine.

    Section 170 CGST Act rounding rules:
      - Intermediate values kept at full Decimal precision.
      - Each tax component rounded to 2 decimal places (paise) for display.
      - Grand total rounded to nearest rupee (ROUND_HALF_UP).

    Transaction mapping:
      INTRASTATE  → CGST (half rate) + SGST (half rate); IGST = 0
      INTERSTATE  → IGST (full rate); CGST = SGST = 0
      EXPORT      → all zero (zero-rated)
      EXEMPT      → all zero

    Returns:
        TaxBreakdown with all amounts in INR (Decimal, 2dp).
    """
    taxable = _to_decimal(taxable_amount)

    # Resolve rule rates (stored as Numeric in DB, may come back as Decimal)
    gst_rate = _to_decimal(tax_rule.gst_rate)
    raw_cgst_rate = _to_decimal(tax_rule.cgst_rate) if tax_rule.cgst_rate is not None else gst_rate / 2
    raw_sgst_rate = _to_decimal(tax_rule.sgst_rate) if tax_rule.sgst_rate is not None else gst_rate / 2
    raw_igst_rate = _to_decimal(tax_rule.igst_rate) if tax_rule.igst_rate is not None else gst_rate

    # Determine place of supply
    pos_state_code = customer_state_code
    pos_state_name: str | None = None
    if pos_state_code:
        try:
            pos_state_name = get_state_name(pos_state_code)
        except ValueError:
            pos_state_name = None

    # Initialise all components to zero
    cgst_rate = _ZERO
    cgst_amount = _ZERO
    sgst_rate = _ZERO
    sgst_amount = _ZERO
    igst_rate = _ZERO
    igst_amount = _ZERO

    if transaction_type == TransactionType.INTRASTATE:
        cgst_rate = raw_cgst_rate.quantize(_FOUR_PLACES, rounding=ROUND_HALF_UP)
        sgst_rate = raw_sgst_rate.quantize(_FOUR_PLACES, rounding=ROUND_HALF_UP)
        # Full-precision intermediate values
        cgst_amount_full = taxable * cgst_rate / _HUNDRED
        sgst_amount_full = taxable * sgst_rate / _HUNDRED
        # Round each component to 2dp (paise)
        cgst_amount = cgst_amount_full.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        sgst_amount = sgst_amount_full.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

    elif transaction_type == TransactionType.INTERSTATE:
        igst_rate = raw_igst_rate.quantize(_FOUR_PLACES, rounding=ROUND_HALF_UP)
        igst_amount_full = taxable * igst_rate / _HUNDRED
        igst_amount = igst_amount_full.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

    # EXPORT / EXEMPT → all zero (already initialised)

    total_tax_amount = (cgst_amount + sgst_amount + igst_amount).quantize(
        _TWO_PLACES, rounding=ROUND_HALF_UP
    )
    total_with_tax = (taxable + total_tax_amount).quantize(
        _TWO_PLACES, rounding=ROUND_HALF_UP
    )
    # Grand total rounded to nearest rupee (Section 170)
    rounded_total = total_with_tax.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    breakdown = TaxBreakdown(
        tax_rule_id=tax_rule.id,
        tax_rule_name=tax_rule.name,
        sac_code=tax_rule.sac_code,
        transaction_type=transaction_type,
        place_of_supply=pos_state_name,
        supplier_state_code=supplier_state_code,
        customer_state_code=pos_state_code,
        taxable_amount=taxable,
        cgst_rate=cgst_rate,
        cgst_amount=cgst_amount,
        sgst_rate=sgst_rate,
        sgst_amount=sgst_amount,
        igst_rate=igst_rate,
        igst_amount=igst_amount,
        total_tax_amount=total_tax_amount,
        total_with_tax=total_with_tax,
        rounded_total=rounded_total,
        is_rcm=is_rcm,
    )

    if save_log:
        log = TaxCalculation(
            reference_type=reference_type or "preview",
            reference_id=reference_id,
            tax_rule_id=tax_rule.id,
            supplier_gstin=supplier_gstin,
            customer_gstin=customer_gstin,
            supplier_state_code=supplier_state_code,
            customer_state_code=pos_state_code,
            place_of_supply=pos_state_name,
            transaction_type=transaction_type,
            taxable_amount=taxable,
            cgst_rate=cgst_rate,
            cgst_amount=cgst_amount,
            sgst_rate=sgst_rate,
            sgst_amount=sgst_amount,
            igst_rate=igst_rate,
            igst_amount=igst_amount,
            total_tax_amount=total_tax_amount,
            total_with_tax=total_with_tax,
            is_rcm=is_rcm,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        # Attach log id so the router can return it
        breakdown.__dict__["_log_id"] = log.id

    return breakdown


# ---------------------------------------------------------------------------
# Integrity verification
# ---------------------------------------------------------------------------

def verify_tax_calculation_integrity(
    cgst: Decimal,
    sgst: Decimal,
    igst: Decimal,
    gst_rate: Decimal,
    taxable_amount: Decimal,
) -> bool:
    """
    Cross-check that calculated tax amounts are consistent with the rate.

    For INTRASTATE:  cgst == sgst, cgst + sgst ≈ taxable * gst_rate / 100
    For INTERSTATE:  igst ≈ taxable * gst_rate / 100
    Returns True when all checks pass, False otherwise.
    """
    cgst = _to_decimal(cgst)
    sgst = _to_decimal(sgst)
    igst = _to_decimal(igst)
    gst_rate = _to_decimal(gst_rate)
    taxable_amount = _to_decimal(taxable_amount)

    expected_total = (taxable_amount * gst_rate / _HUNDRED).quantize(
        _TWO_PLACES, rounding=ROUND_HALF_UP
    )

    is_intrastate = igst == _ZERO and (cgst > _ZERO or sgst > _ZERO)
    is_interstate = cgst == _ZERO and sgst == _ZERO and igst > _ZERO

    if is_intrastate:
        # CGST must equal SGST for standard GST
        if cgst != sgst:
            return False
        actual_total = (cgst + sgst).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        return actual_total == expected_total

    if is_interstate:
        actual_total = igst.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
        return actual_total == expected_total

    # All zero (export/exempt) — valid if gst_rate is 0 or all amounts are 0
    if cgst == _ZERO and sgst == _ZERO and igst == _ZERO:
        return expected_total == _ZERO or gst_rate == _ZERO

    return False


# ---------------------------------------------------------------------------
# Default rule
# ---------------------------------------------------------------------------

def get_default_tax_rule(db: Session) -> TaxRule | None:
    """Return the active default tax rule, or None if none is configured."""
    stmt = (
        select(TaxRule)
        .where(TaxRule.is_default.is_(True), TaxRule.is_active.is_(True))
        .limit(1)
    )
    return db.execute(stmt).scalars().first()


# ---------------------------------------------------------------------------
# High-level helper used by the billing engine
# ---------------------------------------------------------------------------

def calculate_tax_for_invoice_line(
    db: Session,
    taxable_amount: Decimal,
    tax_rule_id: uuid.UUID | None,
    supplier_gstin: str | None,
    customer_gstin: str | None,
    customer_state_code: str | None = None,
    is_export: bool = False,
    is_rcm: bool = False,
    reference_type: str = "invoice_item",
    reference_id: uuid.UUID | None = None,
) -> TaxBreakdown:
    """
    High-level entry point for the billing engine.

    Resolves the tax rule (by id or platform default), derives state codes from
    GSTINs when available, determines the transaction type, and delegates to
    calculate_tax().
    """
    # Resolve tax rule
    if tax_rule_id:
        rule = get_tax_rule(db, tax_rule_id)
        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tax rule {tax_rule_id} not found.",
            )
    else:
        rule = get_default_tax_rule(db)
        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No default tax rule is configured. "
                    "Please create and mark one as default, or supply tax_rule_id."
                ),
            )

    # Derive state codes
    supplier_state_code: str | None = None
    if supplier_gstin:
        is_valid, sc, _ = validate_gstin(supplier_gstin)
        if is_valid:
            supplier_state_code = sc

    cust_state_code: str | None = customer_state_code
    if not cust_state_code and customer_gstin:
        is_valid, sc, _ = validate_gstin(customer_gstin)
        if is_valid:
            cust_state_code = sc

    transaction_type = determine_transaction_type(
        supplier_state_code=supplier_state_code,
        customer_state_code=cust_state_code,
        is_export=is_export,
    )

    return calculate_tax(
        db=db,
        taxable_amount=taxable_amount,
        tax_rule=rule,
        transaction_type=transaction_type,
        supplier_gstin=supplier_gstin,
        customer_gstin=customer_gstin,
        supplier_state_code=supplier_state_code,
        customer_state_code=cust_state_code,
        is_rcm=is_rcm,
        save_log=True,
        reference_type=reference_type,
        reference_id=reference_id,
    )


# ---------------------------------------------------------------------------
# CRUD — TaxRule
# ---------------------------------------------------------------------------

def create_tax_rule(
    db: Session, data: TaxRuleCreate, created_by_id: uuid.UUID
) -> TaxRule:
    """Create a new tax rule. If is_default=True, clears existing default first."""
    if data.is_default:
        _clear_existing_default(db)

    rule = TaxRule(
        name=data.name,
        description=data.description,
        tax_type=data.tax_type,
        gst_rate=data.gst_rate,
        cgst_rate=data.cgst_rate,
        sgst_rate=data.sgst_rate,
        igst_rate=data.igst_rate,
        sac_code=data.sac_code,
        hsn_code=data.hsn_code,
        is_active=data.is_active,
        is_default=data.is_default,
        applies_to_products=data.applies_to_products,
        applies_to_plans=data.applies_to_plans,
        created_by=created_by_id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def get_tax_rule(db: Session, rule_id: uuid.UUID) -> TaxRule | None:
    """Fetch a single tax rule by primary key."""
    return db.get(TaxRule, rule_id)


def list_tax_rules(
    db: Session,
    is_active: bool | None,
    page: int,
    page_size: int,
) -> tuple[list[TaxRule], int]:
    """
    Return a paginated list of tax rules.

    Args:
        is_active: When not None, filter by active flag.
        page:      1-based page number.
        page_size: Number of rows per page.

    Returns:
        (items, total_count)
    """
    stmt = select(TaxRule)
    if is_active is not None:
        stmt = stmt.where(TaxRule.is_active == is_active)

    total: int = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    items = db.execute(
        stmt.order_by(TaxRule.created_at.desc()).offset(offset).limit(page_size)
    ).scalars().all()

    return list(items), total


def update_tax_rule(
    db: Session, rule_id: uuid.UUID, data: TaxRuleUpdate
) -> TaxRule | None:
    """Apply a partial update to a tax rule."""
    rule = db.get(TaxRule, rule_id)
    if rule is None:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if update_data.get("is_default") is True and not rule.is_default:
        _clear_existing_default(db)

    for field, value in update_data.items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule


def deactivate_tax_rule(db: Session, rule_id: uuid.UUID) -> TaxRule | None:
    """Soft-delete: mark the rule as inactive."""
    rule = db.get(TaxRule, rule_id)
    if rule is None:
        return None
    rule.is_active = False
    if rule.is_default:
        rule.is_default = False
    db.commit()
    db.refresh(rule)
    return rule


def set_default_tax_rule(db: Session, rule_id: uuid.UUID) -> TaxRule:
    """
    Set the given rule as the platform default.

    Clears any existing default first, then sets is_default=True and
    is_active=True on the target rule.

    Raises 404 if the rule does not exist.
    """
    rule = db.get(TaxRule, rule_id)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tax rule {rule_id} not found.",
        )
    _clear_existing_default(db)
    rule.is_default = True
    rule.is_active = True
    db.commit()
    db.refresh(rule)
    return rule


def _clear_existing_default(db: Session) -> None:
    """Remove the is_default flag from whichever rule currently holds it."""
    stmt = select(TaxRule).where(TaxRule.is_default.is_(True))
    existing = db.execute(stmt).scalars().all()
    for r in existing:
        r.is_default = False
    # Flush so the UPDATE hits the DB before we proceed
    db.flush()


# ---------------------------------------------------------------------------
# CRUD — TaxCalculation (read-only list)
# ---------------------------------------------------------------------------

def list_tax_calculations(
    db: Session,
    reference_type: str | None,
    page: int,
    page_size: int,
) -> tuple[list[TaxCalculation], int]:
    """
    Return a paginated list of tax calculation log entries.

    Args:
        reference_type: Optional filter (e.g. 'invoice_item').
        page:           1-based page number.
        page_size:      Rows per page.

    Returns:
        (items, total_count)
    """
    stmt = select(TaxCalculation)
    if reference_type:
        stmt = stmt.where(TaxCalculation.reference_type == reference_type)

    total: int = db.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    items = db.execute(
        stmt.order_by(TaxCalculation.calculated_at.desc()).offset(offset).limit(page_size)
    ).scalars().all()

    return list(items), total

