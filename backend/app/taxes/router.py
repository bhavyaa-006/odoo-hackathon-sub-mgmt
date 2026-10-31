"""
FastAPI router for the Tax Service.

Prefix: /taxes

Endpoints:
  GET    /taxes                    List tax rules (admin, staff)
  POST   /taxes                    Create tax rule (admin)
  GET    /taxes/default            Get the current default rule (admin, staff)
  GET    /taxes/state-codes        List all Indian state codes (any auth)
  GET    /taxes/validate-gstin     Validate a GSTIN (any auth)
  GET    /taxes/calculations        List saved calculation logs (admin, staff)
  POST   /taxes/calculate          Calculate tax (admin, staff)
  GET    /taxes/{id}               Get single rule (admin, staff)
  PATCH  /taxes/{id}               Update rule (admin)
  DELETE /taxes/{id}               Deactivate (soft-delete) rule (admin)
  POST   /taxes/{id}/set-default   Make this the default rule (admin)

Note on ordering: FastAPI matches routes in definition order.  Static path
segments (/default, /state-codes, /validate-gstin, /calculate, /calculations)
MUST be declared BEFORE the parameterised /{id} routes to avoid being captured
as UUID values.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    AdminUser,
    CurrentUser,
    DbSession,
    StaffOrAdminUser,
    get_current_user,
)
from app.taxes import service
from app.taxes.schemas import (
    GSTINValidationResponse,
    StateCodeEntry,
    StateCodeLookupResponse,
    TaxBreakdown,
    TaxCalculationListResponse,
    TaxCalculationLogResponse,
    TaxCalculationRequest,
    TaxCalculationResponse,
    TaxRuleCreate,
    TaxRuleListResponse,
    TaxRuleResponse,
    TaxRuleUpdate,
)

router = APIRouter(prefix="/taxes", tags=["Taxes"])


# ---------------------------------------------------------------------------
# Static / utility endpoints  (MUST come before /{id} routes)
# ---------------------------------------------------------------------------

@router.get(
    "/default",
    response_model=TaxRuleResponse,
    summary="Get the current default tax rule",
)
def get_default_rule(
    db: DbSession,
    _user: StaffOrAdminUser,
) -> TaxRuleResponse:
    rule = service.get_default_tax_rule(db)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No default tax rule is configured.",
        )
    return TaxRuleResponse.model_validate(rule)


@router.get(
    "/state-codes",
    response_model=StateCodeLookupResponse,
    summary="List all Indian GST state codes and names",
)
def list_state_codes(
    _user: Annotated[object, Depends(get_current_user)],
) -> StateCodeLookupResponse:
    entries = [
        StateCodeEntry(code=code, name=name)
        for code, name in sorted(service.INDIAN_STATE_CODES.items())
    ]
    return StateCodeLookupResponse(state_codes=entries)


@router.get(
    "/validate-gstin",
    response_model=GSTINValidationResponse,
    summary="Validate an Indian GSTIN",
)
def validate_gstin_endpoint(
    gstin: Annotated[str, Query(..., min_length=15, max_length=15, description="15-character GSTIN to validate")],
    _user: Annotated[object, Depends(get_current_user)],
) -> GSTINValidationResponse:
    is_valid, state_code, error_message = service.validate_gstin(gstin)
    state_name: str | None = None
    if is_valid and state_code:
        try:
            state_name = service.get_state_name(state_code)
        except ValueError:
            state_name = None

    return GSTINValidationResponse(
        gstin=gstin.upper().strip(),
        is_valid=is_valid,
        state_code=state_code if is_valid else None,
        state_name=state_name,
        error_message=error_message if not is_valid else None,
    )


@router.post(
    "/calculate",
    response_model=TaxCalculationResponse,
    summary="Calculate GST for given inputs",
)
def calculate_tax_endpoint(
    payload: TaxCalculationRequest,
    db: DbSession,
    _user: StaffOrAdminUser,
) -> TaxCalculationResponse:
    """
    Calculate Indian GST for a taxable amount.

    - If `tax_rule_id` is omitted, the platform default rule is used.
    - Set `save_log=false` for preview / quote calculations that should not be
      persisted to the audit log.
    - Set `is_export=true` for zero-rated export transactions.
    """
    # Derive state codes
    supplier_state_code: str | None = None
    if payload.supplier_gstin:
        is_valid, sc, _ = service.validate_gstin(payload.supplier_gstin)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid supplier GSTIN: {_}",
            )
        supplier_state_code = sc

    customer_state_code: str | None = payload.customer_state_code
    if not customer_state_code and payload.customer_gstin:
        is_valid, sc, err = service.validate_gstin(payload.customer_gstin)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid customer GSTIN: {err}",
            )
        customer_state_code = sc

    # Validate explicit state code if supplied
    if payload.customer_state_code and payload.customer_state_code not in service.INDIAN_STATE_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown customer state code '{payload.customer_state_code}'.",
        )

    # Resolve tax rule
    if payload.tax_rule_id:
        rule = service.get_tax_rule(db, payload.tax_rule_id)
        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tax rule {payload.tax_rule_id} not found.",
            )
    else:
        rule = service.get_default_tax_rule(db)
        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No default tax rule configured. "
                    "Supply tax_rule_id or configure a default rule."
                ),
            )

    transaction_type = service.determine_transaction_type(
        supplier_state_code=supplier_state_code,
        customer_state_code=customer_state_code,
        is_export=payload.is_export,
    )

    breakdown = service.calculate_tax(
        db=db,
        taxable_amount=payload.taxable_amount,
        tax_rule=rule,
        transaction_type=transaction_type,
        supplier_gstin=payload.supplier_gstin,
        customer_gstin=payload.customer_gstin,
        supplier_state_code=supplier_state_code,
        customer_state_code=customer_state_code,
        is_rcm=payload.is_rcm,
        save_log=payload.save_log,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
    )

    log_id: uuid.UUID | None = breakdown.__dict__.get("_log_id")

    return TaxCalculationResponse(
        calculation_log_id=log_id,
        breakdown=breakdown,
    )


@router.get(
    "/calculations",
    response_model=TaxCalculationListResponse,
    summary="List saved tax calculation logs",
)
def list_calculations(
    db: DbSession,
    _user: StaffOrAdminUser,
    reference_type: Annotated[
        str | None, Query(description="Filter by reference type (e.g. invoice_item)")
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> TaxCalculationListResponse:
    items, total = service.list_tax_calculations(
        db=db, reference_type=reference_type, page=page, page_size=page_size
    )
    return TaxCalculationListResponse(
        items=[TaxCalculationLogResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Collection endpoints
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=TaxRuleListResponse,
    summary="List tax rules",
)
def list_tax_rules(
    db: DbSession,
    _user: StaffOrAdminUser,
    is_active: Annotated[
        bool | None, Query(description="Filter by active status")
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> TaxRuleListResponse:
    items, total = service.list_tax_rules(
        db=db, is_active=is_active, page=page, page_size=page_size
    )
    return TaxRuleListResponse(
        items=[TaxRuleResponse.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=TaxRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a tax rule (admin only)",
)
def create_tax_rule(
    payload: TaxRuleCreate,
    db: DbSession,
    current_user: AdminUser,
) -> TaxRuleResponse:
    rule = service.create_tax_rule(db=db, data=payload, created_by_id=current_user.id)
    return TaxRuleResponse.model_validate(rule)


# ---------------------------------------------------------------------------
# Item endpoints  (MUST come after all static paths)
# ---------------------------------------------------------------------------

@router.get(
    "/{rule_id}",
    response_model=TaxRuleResponse,
    summary="Get a single tax rule",
)
def get_tax_rule(
    rule_id: uuid.UUID,
    db: DbSession,
    _user: StaffOrAdminUser,
) -> TaxRuleResponse:
    rule = service.get_tax_rule(db, rule_id)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tax rule {rule_id} not found.",
        )
    return TaxRuleResponse.model_validate(rule)


@router.patch(
    "/{rule_id}",
    response_model=TaxRuleResponse,
    summary="Update a tax rule (admin only)",
)
def update_tax_rule(
    rule_id: uuid.UUID,
    payload: TaxRuleUpdate,
    db: DbSession,
    _user: AdminUser,
) -> TaxRuleResponse:
    rule = service.update_tax_rule(db=db, rule_id=rule_id, data=payload)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tax rule {rule_id} not found.",
        )
    return TaxRuleResponse.model_validate(rule)


@router.delete(
    "/{rule_id}",
    response_model=TaxRuleResponse,
    summary="Deactivate (soft-delete) a tax rule (admin only)",
)
def deactivate_tax_rule(
    rule_id: uuid.UUID,
    db: DbSession,
    _user: AdminUser,
) -> TaxRuleResponse:
    rule = service.deactivate_tax_rule(db=db, rule_id=rule_id)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tax rule {rule_id} not found.",
        )
    return TaxRuleResponse.model_validate(rule)


@router.post(
    "/{rule_id}/set-default",
    response_model=TaxRuleResponse,
    summary="Set a tax rule as the platform default (admin only)",
)
def set_default_tax_rule(
    rule_id: uuid.UUID,
    db: DbSession,
    _user: AdminUser,
) -> TaxRuleResponse:
    # service.set_default_tax_rule already raises 404 if not found
    rule = service.set_default_tax_rule(db=db, rule_id=rule_id)
    return TaxRuleResponse.model_validate(rule)

