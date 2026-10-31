"""
FastAPI router for the Billing & Invoice Service.

Prefix layout
-------------
  /billing/runs          — trigger and inspect billing runs
  /invoices              — invoice CRUD + lifecycle transitions

Authentication / authorisation (header-based stub, replaced by JWT in auth service)
  AdminUser        — X-User-Role: admin
  StaffOrAdminUser — X-User-Role: admin | staff
  CurrentUser      — any authenticated user (admin | staff | customer)

GST-compliant print endpoint (GET /invoices/{id}/print)
  Returns text/html — Rule 46 mandatory fields:
    invoice number, issue date, supplier name/GSTIN/address,
    customer name/GSTIN/address, place of supply, RCM indicator, SAC code,
    taxable value, CGST/SGST or IGST amounts, total, amount in words.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import HTMLResponse

from app.billing import invoice_service, service as billing_svc
from app.billing.models import BillingRun, BillingRunStatus, Invoice, InvoiceKind, InvoiceStatus
from app.billing.schemas import (
    BillingRunListResponse,
    BillingRunRequest,
    BillingRunResponse,
    InvoiceConfirmResponse,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceVoidRequest,
)
from app.config import get_settings
from app.core.dependencies import AdminUser, CurrentUser, DbSession, StaffOrAdminUser

router = APIRouter(tags=["Billing & Invoices"])
settings = get_settings()

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_ZERO = Decimal("0")


def _run_to_response(run: BillingRun, include_items: bool = False) -> BillingRunResponse:
    """Convert ORM BillingRun to Pydantic response, optionally embedding items."""
    resp = BillingRunResponse.model_validate(run)
    if not include_items:
        resp.items = []
    return resp


def _invoice_to_response(inv: Invoice) -> InvoiceResponse:
    """Convert ORM Invoice to response schema, filling derived fields."""
    resp = InvoiceResponse.model_validate(inv)
    enriched = invoice_service.enrich_invoice_response(inv)
    resp.outstanding = enriched.get("outstanding", _ZERO)
    resp.is_overdue = enriched.get("is_overdue", False)
    return resp


# ---------------------------------------------------------------------------
# Billing Run endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/billing/runs",
    response_model=BillingRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a billing run",
    description=(
        "Calculates and (unless dry_run=true) commits invoices for all subscriptions "
        "due on or before `as_of_date`. Idempotent via unique-constraint deduplication. "
        "Staff users may only trigger dry runs."
    ),
)
def trigger_billing_run(
    body: BillingRunRequest,
    current_user: StaffOrAdminUser,
    db: DbSession,
) -> BillingRunResponse:
    # Staff restricted to dry-run only — prevents accidental live billing
    if current_user.role == "staff" and not body.dry_run:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff users may only trigger dry runs. Set dry_run=true.",
        )

    run = billing_svc.run_billing(
        db=db,
        as_of_date=body.as_of_date,
        dry_run=body.dry_run,
        subscription_ids=body.subscription_ids,
        triggered_by_id=current_user.id,
    )
    return _run_to_response(run, include_items=True)


@router.get(
    "/billing/runs",
    response_model=BillingRunListResponse,
    summary="List billing runs",
    description="Returns a paginated list of billing runs, newest first.",
)
def list_billing_runs(
    current_user: StaffOrAdminUser,
    db: DbSession,
    page: int = Query(default=1, ge=1, description="1-based page number"),
    page_size: int = Query(default=25, ge=1, le=100, description="Results per page"),
) -> BillingRunListResponse:
    runs, total = billing_svc.list_billing_runs(db=db, page=page, page_size=page_size)
    return BillingRunListResponse(
        items=[_run_to_response(r, include_items=False) for r in runs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/billing/runs/{run_id}",
    response_model=BillingRunResponse,
    summary="Get a billing run with all its items",
)
def get_billing_run(
    run_id: uuid.UUID,
    current_user: StaffOrAdminUser,
    db: DbSession,
) -> BillingRunResponse:
    run = billing_svc.get_billing_run(db=db, run_id=run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Billing run {run_id} not found.",
        )
    return _run_to_response(run, include_items=True)


@router.post(
    "/billing/runs/{run_id}/retry",
    response_model=BillingRunResponse,
    summary="Retry failed items in a billing run",
    description=(
        "Re-attempts all items that ended in ERROR status. "
        "Admin only. Returns the updated BillingRun record."
    ),
)
def retry_billing_run(
    run_id: uuid.UUID,
    current_user: AdminUser,
    db: DbSession,
) -> BillingRunResponse:
    run = billing_svc.get_billing_run(db=db, run_id=run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Billing run {run_id} not found.",
        )
    if run.status == BillingRunStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Billing run is still in progress. Wait for it to complete.",
        )
    if run.status == BillingRunStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All items already completed. Nothing to retry.",
        )

    updated_run = billing_svc.retry_failed_run_items(
        db=db,
        run_id=run_id,
        triggered_by_id=current_user.id,
    )
    return _run_to_response(updated_run, include_items=True)


# ---------------------------------------------------------------------------
# Invoice endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/invoices",
    response_model=InvoiceListResponse,
    summary="List invoices",
    description=(
        "Paginated invoice listing. Customers only see their own invoices. "
        "Admin/staff see all. Supports filtering by customer, subscription, "
        "status, kind, overdue flag, date range, and invoice number search."
    ),
)
def list_invoices(
    current_user: CurrentUser,
    db: DbSession,
    customer_id: uuid.UUID | None = Query(default=None),
    subscription_id: uuid.UUID | None = Query(default=None),
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    kind: InvoiceKind | None = Query(default=None),
    overdue_only: bool = Query(default=False),
    date_from: date | None = Query(default=None, description="Filter issue_date >="),
    date_to: date | None = Query(default=None, description="Filter issue_date <="),
    q: str | None = Query(default=None, description="Search on invoice_number"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> InvoiceListResponse:
    # Customers may only see their own invoices
    effective_customer_id: uuid.UUID | None = customer_id
    if current_user.role == "customer":
        effective_customer_id = current_user.id

    invoices, total = invoice_service.list_invoices(
        db=db,
        customer_id=effective_customer_id,
        subscription_id=subscription_id,
        status=status_filter,
        kind=kind,
        overdue_only=overdue_only,
        date_from=date_from,
        date_to=date_to,
        q=q,
        page=page,
        page_size=page_size,
    )
    return InvoiceListResponse(
        items=[_invoice_to_response(inv) for inv in invoices],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a manual draft invoice",
    description=(
        "Creates a DRAFT invoice manually. Staff/admin only. "
        "Tax is calculated automatically from customer GSTIN (CGST+SGST or IGST). "
        "The invoice is not visible to the customer until confirmed."
    ),
)
def create_invoice(
    body: InvoiceCreate,
    current_user: StaffOrAdminUser,
    db: DbSession,
) -> InvoiceResponse:
    inv = invoice_service.create_invoice(
        db=db,
        payload=body,
        created_by_id=current_user.id,
    )
    return _invoice_to_response(inv)


@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceResponse,
    summary="Get a single invoice with line items",
)
def get_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> InvoiceResponse:
    inv = invoice_service.get_invoice(db=db, invoice_id=invoice_id)
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found.",
        )
    # Customers may only view their own invoices
    if current_user.role == "customer" and inv.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this invoice.",
        )
    return _invoice_to_response(inv)


@router.post(
    "/invoices/{invoice_id}/confirm",
    response_model=InvoiceConfirmResponse,
    summary="Confirm a draft invoice",
    description=(
        "Transitions DRAFT → CONFIRMED. Recalculates totals, assigns confirmed_at. "
        "Once confirmed, the invoice is immutable — it can only be voided."
    ),
)
def confirm_invoice(
    invoice_id: uuid.UUID,
    current_user: StaffOrAdminUser,
    db: DbSession,
) -> InvoiceConfirmResponse:
    inv = invoice_service.confirm_invoice(
        db=db,
        invoice_id=invoice_id,
        confirmed_by_id=current_user.id,
    )
    return InvoiceConfirmResponse(
        invoice=_invoice_to_response(inv),
        message="Invoice confirmed successfully.",
    )


@router.post(
    "/invoices/{invoice_id}/void",
    response_model=InvoiceResponse,
    summary="Void an invoice",
    description=(
        "Voids a CONFIRMED or PARTIALLY_PAID invoice. Admin only. "
        "A reason string is required. Voided invoices cannot be restored."
    ),
)
def void_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceVoidRequest,
    current_user: AdminUser,
    db: DbSession,
) -> InvoiceResponse:
    inv = invoice_service.void_invoice(
        db=db,
        invoice_id=invoice_id,
        voided_by_id=current_user.id,
        reason=body.reason,
    )
    return _invoice_to_response(inv)


@router.get(
    "/invoices/{invoice_id}/print",
    response_class=HTMLResponse,
    summary="GST-compliant printable invoice (HTML)",
    description=(
        "Returns a print-ready HTML page conforming to Rule 46 of CGST Rules 2017. "
        "Mandatory fields: supplier/customer GSTIN + address, place of supply, RCM flag, "
        "SAC 998315, taxable value, CGST/SGST or IGST amounts, grand total, amount in words. "
        "Customers may only print their own invoices."
    ),
)
def print_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> HTMLResponse:
    inv = invoice_service.get_invoice(db=db, invoice_id=invoice_id)
    if inv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found.",
        )
    if current_user.role == "customer" and inv.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this invoice.",
        )
    html = _render_gst_invoice_html(inv)
    return HTMLResponse(content=html, status_code=200)


# ===========================================================================
# HTML rendering — Rule 46 CGST Rules 2017 compliant Tax Invoice
# ===========================================================================

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty",
         "Sixty", "Seventy", "Eighty", "Ninety"]


def _num_to_words_below_thousand(n: int) -> str:
    if n == 0:
        return ""
    if n < 20:
        return _ONES[n]
    if n < 100:
        tens = _TENS[n // 10]
        ones = "" if n % 10 == 0 else " " + _ONES[n % 10]
        return tens + ones
    return (
        _ONES[n // 100]
        + " Hundred"
        + ("" if n % 100 == 0 else " " + _num_to_words_below_thousand(n % 100))
    )


def _amount_in_words(amount: Decimal) -> str:
    """
    Convert a Decimal rupee amount to Indian number-system words.
    e.g. 118000.50 → "One Lakh Eighteen Thousand Rupees and Fifty Paise Only"
    Uses crore/lakh groupings per the Indian numbering system.
    """
    amount = amount.quantize(Decimal("0.01"))
    total_paise = int(amount * 100)
    if total_paise < 0:
        return "Minus " + _amount_in_words(-amount)

    rupees = total_paise // 100
    paise = total_paise % 100

    if rupees == 0 and paise == 0:
        return "Zero Rupees Only"

    parts: list[str] = []
    crores = rupees // 10_000_000
    rupees %= 10_000_000
    lakhs = rupees // 100_000
    rupees %= 100_000
    thousands = rupees // 1_000
    rupees %= 1_000
    remainder = rupees

    if crores:
        parts.append(_num_to_words_below_thousand(crores) + " Crore")
    if lakhs:
        parts.append(_num_to_words_below_thousand(lakhs) + " Lakh")
    if thousands:
        parts.append(_num_to_words_below_thousand(thousands) + " Thousand")
    if remainder:
        parts.append(_num_to_words_below_thousand(remainder))

    rupee_words = " ".join(parts) + " Rupees" if parts else ""

    if paise:
        paise_words = _num_to_words_below_thousand(paise) + " Paise"
        if rupee_words:
            return rupee_words + " and " + paise_words + " Only"
        return paise_words + " Only"
    return rupee_words + " Only"


def _fmt(v: Any) -> str:
    """Format Decimal to 2-dp Indian comma-notation string (e.g. 1,18,000.00)."""
    try:
        d = Decimal(str(v)).quantize(Decimal("0.01"))
    except Exception:
        return str(v)
    negative = d < 0
    d = abs(d)
    integer_part, _, decimal_part = f"{d:.2f}".partition(".")
    if len(integer_part) > 3:
        last3 = integer_part[-3:]
        rest = integer_part[:-3]
        groups: list[str] = []
        while rest:
            groups.append(rest[-2:])
            rest = rest[:-2]
        groups.reverse()
        integer_part = ",".join(groups) + "," + last3
    return ("-" if negative else "") + integer_part + "." + decimal_part


def _esc(s: Any) -> str:
    """Minimal HTML-escape; returns em-dash for None."""
    if s is None:
        return "\u2014"
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ---------------------------------------------------------------------------
# Indian state code lookup (all 37 states + UTs per GST registration)
# ---------------------------------------------------------------------------
_STATE_CODES: dict[str, str] = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa",
    "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman & Nicobar Islands",
    "36": "Telangana", "37": "Andhra Pradesh",
    "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
}


def _state_name_from_code(code: str | None) -> str:
    if not code:
        return "Unknown"
    return _STATE_CODES.get(str(code).strip().zfill(2), f"State {code}")


# ---------------------------------------------------------------------------
# Line-item and tax-summary HTML renderers
# ---------------------------------------------------------------------------

def _render_line_items(items: list[Any], is_igst: bool) -> str:
    """Render <tr> rows for each invoice line item (Rule 46 columns)."""
    rows: list[str] = []
    for idx, item in enumerate(items, start=1):
        qty = Decimal(str(getattr(item, "quantity", 1)))
        unit_price = Decimal(str(getattr(item, "unit_price", 0)))
        line_subtotal = Decimal(str(getattr(item, "line_subtotal", 0)))
        discount = Decimal(str(getattr(item, "discount_amount", 0)))
        taxable = Decimal(str(getattr(item, "taxable_amount", 0)))
        line_total = Decimal(str(getattr(item, "line_total", 0)))
        description = _esc(getattr(item, "description", ""))

        if is_igst:
            igst_rate = Decimal(str(getattr(item, "igst_rate", 0)))
            igst_amt = Decimal(str(getattr(item, "igst_amount", 0)))
            tax_cols = (
                f'<td class="num">{_fmt(igst_rate)}%</td>'
                f'<td class="num">{_fmt(igst_amt)}</td>'
            )
        else:
            cgst_rate = Decimal(str(getattr(item, "cgst_rate", 0)))
            cgst_amt = Decimal(str(getattr(item, "cgst_amount", 0)))
            sgst_rate = Decimal(str(getattr(item, "sgst_rate", 0)))
            sgst_amt = Decimal(str(getattr(item, "sgst_amount", 0)))
            tax_cols = (
                f'<td class="num">{_fmt(cgst_rate)}%</td>'
                f'<td class="num">{_fmt(cgst_amt)}</td>'
                f'<td class="num">{_fmt(sgst_rate)}%</td>'
                f'<td class="num">{_fmt(sgst_amt)}</td>'
            )

        rows.append(
            f"<tr>"
            f"<td>{idx}</td>"
            f"<td>{description}</td>"
            f'<td class="num">{_fmt(qty)}</td>'
            f'<td class="num">{_fmt(unit_price)}</td>'
            f'<td class="num">{_fmt(line_subtotal)}</td>'
            f'<td class="num">{_fmt(discount)}</td>'
            f'<td class="num">{_fmt(taxable)}</td>'
            f"{tax_cols}"
            f'<td class="num"><strong>{_fmt(line_total)}</strong></td>'
            f"</tr>"
        )
    return "\n".join(rows)


def _render_tax_summary(items: list[Any], is_igst: bool) -> str:
    """
    SAC-wise tax summary table as required by Rule 46.
    For SaaS, all items share SAC 998315 (IT software services).
    """
    sac_groups: dict[str, dict[str, Decimal]] = {}
    for item in items:
        sac = str(getattr(item, "sac_code", None) or "998315")
        if sac not in sac_groups:
            sac_groups[sac] = {
                "taxable": Decimal("0"),
                "cgst_rate": Decimal("0"),
                "cgst": Decimal("0"),
                "sgst_rate": Decimal("0"),
                "sgst": Decimal("0"),
                "igst_rate": Decimal("0"),
                "igst": Decimal("0"),
                "total_tax": Decimal("0"),
            }
        g = sac_groups[sac]
        g["taxable"] += Decimal(str(getattr(item, "taxable_amount", 0)))
        g["cgst_rate"] = Decimal(str(getattr(item, "cgst_rate", 0)))
        g["cgst"] += Decimal(str(getattr(item, "cgst_amount", 0)))
        g["sgst_rate"] = Decimal(str(getattr(item, "sgst_rate", 0)))
        g["sgst"] += Decimal(str(getattr(item, "sgst_amount", 0)))
        g["igst_rate"] = Decimal(str(getattr(item, "igst_rate", 0)))
        g["igst"] += Decimal(str(getattr(item, "igst_amount", 0)))
        g["total_tax"] += Decimal(str(getattr(item, "tax_amount", 0)))

    if is_igst:
        header = (
            "<table class='tax-summary' style='margin-top:6px;'>"
            "<thead><tr>"
            "<th>SAC Code</th>"
            "<th class='num'>Taxable (&#8377;)</th>"
            "<th class='num'>IGST Rate</th>"
            "<th class='num'>IGST (&#8377;)</th>"
            "<th class='num'>Total Tax (&#8377;)</th>"
            "</tr></thead><tbody>"
        )
        rows_html = []
        for sac, g in sac_groups.items():
            rows_html.append(
                f"<tr><td>{_esc(sac)}</td>"
                f"<td class='num'>{_fmt(g['taxable'])}</td>"
                f"<td class='num'>{_fmt(g['igst_rate'])}%</td>"
                f"<td class='num'>{_fmt(g['igst'])}</td>"
                f"<td class='num'>{_fmt(g['total_tax'])}</td></tr>"
            )
    else:
        header = (
            "<table class='tax-summary' style='margin-top:6px;'>"
            "<thead><tr>"
            "<th>SAC Code</th>"
            "<th class='num'>Taxable (&#8377;)</th>"
            "<th class='num'>CGST %</th>"
            "<th class='num'>CGST (&#8377;)</th>"
            "<th class='num'>SGST %</th>"
            "<th class='num'>SGST (&#8377;)</th>"
            "<th class='num'>Total Tax (&#8377;)</th>"
            "</tr></thead><tbody>"
        )
        rows_html = []
        for sac, g in sac_groups.items():
            rows_html.append(
                f"<tr><td>{_esc(sac)}</td>"
                f"<td class='num'>{_fmt(g['taxable'])}</td>"
                f"<td class='num'>{_fmt(g['cgst_rate'])}%</td>"
                f"<td class='num'>{_fmt(g['cgst'])}</td>"
                f"<td class='num'>{_fmt(g['sgst_rate'])}%</td>"
                f"<td class='num'>{_fmt(g['sgst'])}</td>"
                f"<td class='num'>{_fmt(g['total_tax'])}</td></tr>"
            )

    return header + "\n".join(rows_html) + "</tbody></table>"


# ---------------------------------------------------------------------------
# Main HTML renderer
# ---------------------------------------------------------------------------

def _render_gst_invoice_html(inv: Invoice) -> str:
    """
    Build a fully Rule 46 (CGST Rules 2017) compliant HTML invoice.

    Mandatory fields per Rule 46:
    (a)  "Tax Invoice" header
    (b)  Name, address, GSTIN of supplier
    (c)  Consecutive serial number (max 16 alphanumeric chars, unique per year)
    (d)  Date of issue
    (e)  Name, address, GSTIN of recipient (if registered)
    (f)  Place of supply (state name + state code)
    (g)  HSN/SAC code for each line
    (h)  Description of services
    (i)  Quantity + unit
    (j)  Total value of supply
    (k)  Taxable value and applicable discount
    (l)  Rate and amount of tax — CGST/SGST (intrastate) or IGST (interstate)
    (m)  Whether tax is payable under reverse charge (RCM)
    (n)  Signature of supplier / digital signature
    """
    today = date.today()
    is_igst = bool(inv.is_igst)
    is_void = inv.status == InvoiceStatus.VOID
    is_draft = inv.status == InvoiceStatus.DRAFT

    # ---------- supplier info (from settings) --------------------------------
    supplier_gstin = _esc(settings.company_gstin)
    supplier_name = _esc(getattr(settings, "company_name", "Brightloop Technologies Pvt. Ltd."))
    supplier_address = _esc(getattr(settings, "company_address", "Bengaluru, Karnataka \u2014 560001"))
    supplier_state = _esc(getattr(settings, "company_state_name", "Karnataka"))
    supplier_state_code = _esc(getattr(settings, "company_state_code", "29"))

    # ---------- customer info (snapshot on invoice) --------------------------
    customer_gstin_display = _esc(inv.customer_gstin) if inv.customer_gstin else "Unregistered"
    customer_name = "\u2014"
    customer_address = "\u2014"
    if hasattr(inv, "customer") and inv.customer is not None:
        cust = inv.customer
        customer_name = _esc(
            getattr(cust, "name", None)
            or getattr(cust, "full_name", None)
            or getattr(cust, "company_name", None)
        )
        customer_address = _esc(
            getattr(cust, "billing_address", None)
            or getattr(cust, "address", None)
        )

    # ---------- place of supply ----------------------------------------------
    pos_code = _esc(inv.place_of_supply) if inv.place_of_supply else "\u2014"
    pos_name = _esc(_state_name_from_code(inv.place_of_supply)) if inv.place_of_supply else "\u2014"

    # ---------- RCM ----------------------------------------------------------
    rcm_text = "Yes" if inv.is_rcm else "No"

    # ---------- dates --------------------------------------------------------
    issue_date_str = inv.issue_date.strftime("%d %b %Y") if inv.issue_date else "\u2014"
    due_date_str = inv.due_date.strftime("%d %b %Y") if inv.due_date else "On Receipt"
    period_str = ""
    if inv.period_start and inv.period_end:
        period_str = (
            f"{inv.period_start.strftime('%d %b %Y')} to "
            f"{inv.period_end.strftime('%d %b %Y')}"
        )

    # ---------- totals -------------------------------------------------------
    subtotal = Decimal(str(inv.subtotal or 0))
    discount_total = Decimal(str(inv.discount_total or 0))
    taxable_total = Decimal(str(inv.taxable_total or 0))
    cgst_total = Decimal(str(inv.cgst_total or 0))
    sgst_total = Decimal(str(inv.sgst_total or 0))
    igst_total = Decimal(str(inv.igst_total or 0))
    tax_total = Decimal(str(inv.tax_total or 0))
    grand_total = Decimal(str(inv.total or 0))
    amount_paid = Decimal(str(inv.amount_paid or 0))
    outstanding = grand_total - amount_paid

    # ---------- line items & tax summary html --------------------------------
    items_html = _render_line_items(inv.items or [], is_igst)
    tax_summary_html = _render_tax_summary(inv.items or [], is_igst)

    # ---------- amount in words (Indian numbering system) --------------------
    words = _amount_in_words(grand_total)

    # ---------- status watermark ---------------------------------------------
    if is_void:
        watermark = '<div class="watermark void-wm">VOID</div>'
    elif is_draft:
        watermark = '<div class="watermark draft-wm">DRAFT</div>'
    else:
        watermark = ""

    # ---------- tax columns header -------------------------------------------
    if is_igst:
        tax_th = "<th class='num'>IGST %</th><th class='num'>IGST (&#8377;)</th>"
    else:
        tax_th = (
            "<th class='num'>CGST %</th><th class='num'>CGST (&#8377;)</th>"
            "<th class='num'>SGST %</th><th class='num'>SGST (&#8377;)</th>"
        )

    # ---------- tax total rows -----------------------------------------------
    if is_igst:
        tax_total_rows = f"<tr><td class='label'>IGST @ 18%</td><td class='amount'>&#8377; {_fmt(igst_total)}</td></tr>"
    else:
        tax_total_rows = (
            f"<tr><td class='label'>CGST @ 9%</td><td class='amount'>&#8377; {_fmt(cgst_total)}</td></tr>"
            f"<tr><td class='label'>SGST @ 9%</td><td class='amount'>&#8377; {_fmt(sgst_total)}</td></tr>"
        )

    # ---------- conditional rows ---------------------------------------------
    period_meta = ""
    if period_str:
        period_meta = f"<div class='meta-cell'><label>Service Period</label><span>{_esc(period_str)}</span></div>"

    discount_row = ""
    if discount_total > _ZERO:
        discount_row = f"<tr><td class='label'>Discount</td><td class='amount' style='color:#2e7d32;'>&#8722; &#8377; {_fmt(discount_total)}</td></tr>"

    paid_row = ""
    if amount_paid > _ZERO:
        paid_row = f"<tr><td class='label' style='color:#2e7d32;'>Amount Paid</td><td class='amount' style='color:#2e7d32;'>&#8377; {_fmt(amount_paid)}</td></tr>"

    outstanding_row = ""
    if outstanding > _ZERO:
        outstanding_row = f"<tr class='outstanding-row'><td class='label'>Outstanding Balance</td><td class='amount'>&#8377; {_fmt(outstanding)}</td></tr>"

    due_date_display = ""
    if inv.due_date:
        due_date_display = f"<div class='inv-date' style='color:#c62828;font-weight:600;'>Due: {_esc(due_date_str)}</div>"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Tax Invoice \u2014 {_esc(inv.invoice_number)}</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #fff;
    }}
    .page {{
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 28px;
      position: relative;
    }}
    /* ---- watermark ---- */
    .watermark {{
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 90px;
      font-weight: 900;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
      letter-spacing: 8px;
    }}
    .void-wm {{ color: #c62828; }}
    .draft-wm {{ color: #e65100; }}
    /* ---- header ---- */
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #1a237e;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }}
    .company-block h1 {{
      font-size: 20px;
      font-weight: 700;
      color: #1a237e;
    }}
    .company-block p {{
      font-size: 11px;
      color: #444;
      margin-top: 3px;
      line-height: 1.5;
    }}
    .invoice-title-block {{ text-align: right; }}
    .invoice-title-block h2 {{
      font-size: 20px;
      font-weight: 700;
      color: #1a237e;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }}
    .invoice-title-block .inv-number {{
      font-size: 14px;
      font-weight: 600;
      color: #222;
      margin-top: 4px;
      font-family: monospace;
    }}
    .invoice-title-block .inv-date {{
      font-size: 11px;
      color: #555;
      margin-top: 2px;
    }}
    /* ---- parties grid ---- */
    .parties {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 14px;
    }}
    .party-box {{
      border: 1px solid #c5cae9;
      border-radius: 4px;
      padding: 10px 12px;
      background: #f8f9ff;
    }}
    .party-box h3 {{
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1a237e;
      margin-bottom: 6px;
      border-bottom: 1px solid #c5cae9;
      padding-bottom: 4px;
    }}
    .party-box p {{ font-size: 11px; color: #333; line-height: 1.6; }}
    .party-box .gstin {{
      font-weight: 600;
      font-family: monospace;
      font-size: 12px;
      color: #1a237e;
    }}
    /* ---- meta row ---- */
    .meta-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
      font-size: 11px;
    }}
    .meta-cell {{
      flex: 1;
      min-width: 160px;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 6px 10px;
      background: #fafafa;
    }}
    .meta-cell label {{
      display: block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 2px;
    }}
    .meta-cell span {{ font-size: 12px; color: #222; font-weight: 500; }}
    /* ---- items table ---- */
    table.items {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }}
    table.items thead tr {{ background: #1a237e; color: #fff; }}
    table.items thead th {{
      padding: 7px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }}
    table.items thead th.num {{ text-align: right; }}
    table.items tbody tr:nth-child(even) {{ background: #f0f2ff; }}
    table.items tbody td {{
      padding: 6px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }}
    table.items tbody td.num {{
      text-align: right;
      font-family: monospace;
    }}
    /* ---- summaries ---- */
    .summaries {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 14px;
    }}
    table.tax-summary {{
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 6px;
    }}
    table.tax-summary th {{
      background: #e8eaf6;
      padding: 5px 8px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      color: #1a237e;
      border: 1px solid #c5cae9;
    }}
    table.tax-summary th.num, table.tax-summary td.num {{ text-align: right; }}
    table.tax-summary td {{
      padding: 5px 8px;
      border: 1px solid #e0e0e0;
      font-family: monospace;
      font-size: 11px;
    }}
    /* ---- totals ---- */
    table.totals {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
    table.totals td {{ padding: 5px 8px; }}
    table.totals td.label {{ text-align: right; color: #555; width: 70%; }}
    table.totals td.amount {{
      text-align: right;
      font-family: monospace;
      font-weight: 500;
      white-space: nowrap;
    }}
    table.totals tr.grand td {{
      font-size: 14px;
      font-weight: 700;
      color: #1a237e;
      border-top: 2px solid #1a237e;
      padding-top: 8px;
    }}
    table.totals tr.outstanding-row td {{
      font-size: 12px;
      font-weight: 600;
      color: #c62828;
    }}
    /* ---- amount in words ---- */
    .amount-words {{
      border: 1px dashed #c5cae9;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 11px;
      color: #333;
    }}
    .amount-words strong {{ color: #1a237e; }}
    /* ---- footer ---- */
    .footer {{
      border-top: 1px solid #e0e0e0;
      margin-top: 20px;
      padding-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      font-size: 10px;
      color: #555;
    }}
    .footer .legal {{ line-height: 1.7; }}
    .footer .signature {{ text-align: right; }}
    .sig-line {{
      margin-top: 36px;
      border-top: 1px solid #888;
      display: inline-block;
      width: 180px;
      font-size: 10px;
      color: #888;
      text-align: center;
      padding-top: 4px;
    }}
    @media print {{
      body {{ background: white; }}
      .page {{ padding: 16px; max-width: 100%; }}
      .watermark {{ position: fixed; }}
    }}
  </style>
</head>
<body>
<div class="page">
  {watermark}

  <!-- HEADER -->
  <div class="header">
    <div class="company-block">
      <h1>{supplier_name}</h1>
      <p>{supplier_address}</p>
      <p><strong>GSTIN:</strong> <span style="font-family:monospace;">{supplier_gstin}</span></p>
      <p><strong>State:</strong> {supplier_state} ({supplier_state_code})</p>
    </div>
    <div class="invoice-title-block">
      <h2>Tax Invoice</h2>
      <div class="inv-number">{_esc(inv.invoice_number)}</div>
      <div class="inv-date">Issued: {_esc(issue_date_str)}</div>
      {due_date_display}
    </div>
  </div>

  <!-- PARTIES -->
  <div class="parties">
    <div class="party-box">
      <h3>Billed From (Supplier)</h3>
      <p><span class="gstin">{supplier_gstin}</span></p>
      <p>{supplier_name}</p>
      <p>{supplier_address}</p>
    </div>
    <div class="party-box">
      <h3>Billed To (Recipient)</h3>
      <p><span class="gstin">{customer_gstin_display}</span></p>
      <p>{customer_name}</p>
      <p>{customer_address}</p>
    </div>
  </div>

  <!-- META -->
  <div class="meta-row">
    <div class="meta-cell">
      <label>Invoice Kind</label>
      <span>{_esc(inv.kind.value.replace('_', ' ').title())}</span>
    </div>
    <div class="meta-cell">
      <label>Place of Supply</label>
      <span>{pos_name} ({pos_code})</span>
    </div>
    <div class="meta-cell">
      <label>Tax Type</label>
      <span>{"IGST (Inter-state)" if is_igst else "CGST + SGST (Intra-state)"}</span>
    </div>
    <div class="meta-cell">
      <label>Reverse Charge (RCM)</label>
      <span>{rcm_text}</span>
    </div>
    {period_meta}
    <div class="meta-cell">
      <label>Currency</label>
      <span>{_esc(inv.currency or 'INR')}</span>
    </div>
  </div>

  <!-- LINE ITEMS -->
  <table class="items">
    <thead>
      <tr>
        <th>#</th>
        <th>Description &amp; SAC Code</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price (&#8377;)</th>
        <th class="num">Gross (&#8377;)</th>
        <th class="num">Discount (&#8377;)</th>
        <th class="num">Taxable (&#8377;)</th>
        {tax_th}
        <th class="num">Line Total (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      {items_html}
    </tbody>
  </table>

  <!-- SUMMARIES -->
  <div class="summaries">
    <div>
      <strong style="font-size:11px;color:#1a237e;text-transform:uppercase;letter-spacing:0.5px;">
        Tax Summary (SAC-wise)
      </strong>
      {tax_summary_html}
    </div>
    <div>
      <table class="totals">
        <tr>
          <td class="label">Gross Subtotal</td>
          <td class="amount">&#8377; {_fmt(subtotal)}</td>
        </tr>
        {discount_row}
        <tr>
          <td class="label">Taxable Value</td>
          <td class="amount">&#8377; {_fmt(taxable_total)}</td>
        </tr>
        {tax_total_rows}
        <tr>
          <td class="label">Total Tax</td>
          <td class="amount">&#8377; {_fmt(tax_total)}</td>
        </tr>
        <tr class="grand">
          <td class="label">Grand Total (INR)</td>
          <td class="amount">&#8377; {_fmt(grand_total)}</td>
        </tr>
        {paid_row}
        {outstanding_row}
      </table>
    </div>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="amount-words">
    <strong>Invoice Total in Words:</strong> {_esc(words)}<br/>
    <span style="font-size:10px;color:#888;">
      Rounded to nearest rupee as per Section 170, CGST Act 2017.
    </span>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="legal">
      <p><strong>Terms &amp; Conditions</strong></p>
      <p>1. This is a computer-generated Tax Invoice valid without a physical signature.</p>
      <p>2. Payment due within {inv.payment_term_days or 0} day(s) of invoice date.</p>
      <p>3. GST payable under Reverse Charge: <strong>{rcm_text}</strong>.</p>
      <p>4. Subject to {supplier_state} jurisdiction.</p>
      <p style="margin-top:6px;color:#aaa;">
        Printed on: {today.strftime('%d %b %Y')} | Powered by Brightloop Autopilot
      </p>
    </div>
    <div class="signature">
      <p style="font-size:11px;"><strong>For {supplier_name}</strong></p>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>

</div>
</body>
</html>"""
    return html

