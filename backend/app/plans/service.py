"""Business rules for the plan catalogue.

Responsibilities:
  - CRUD on Plan records.
  - Plan availability check (active flag + date window).
  - Billing cadence and price breakdown (unit_price × quantity).
  - Product assignment validation (products must exist; no duplicates).

NOT responsible for:
  - Creating subscriptions, invoices, or payments.
  - Scheduling recurring billing.
  - Historical financial data reconstruction.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import conflict, invalid_operation, not_found
from app.plans import repository
from app.plans.models import BillingInterval, Plan
from app.plans.schemas import PlanCreate, PlanUpdate
from app.products.models import Product


class PlanService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_plan(self, plan_id: str, *, customer_visible: bool = False) -> Plan:
        """Return a Plan or raise 404.

        When *customer_visible* is True the plan must be active for new
        subscriptions (inactive plans still exist for historical references but
        are hidden from the public catalogue).
        """
        plan = self.session.scalar(repository.plan_by_id(plan_id))
        if plan is None:
            raise not_found("Plan")
        if customer_visible and not plan.is_active:
            raise not_found("Plan")
        return plan

    def list_plans(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None,
        billing_interval: BillingInterval | None,
        is_active: bool | None,
        currency: str | None,
        sort_by: str,
        sort_order: str,
        customer_visible: bool,
    ) -> tuple[list[Plan], int]:
        statement = repository.plan_filters(
            search=search,
            billing_interval=billing_interval,
            is_active=is_active,
            currency=currency,
            customer_visible=customer_visible,
        )
        total = repository.count(self.session, statement)
        sort_column = getattr(Plan, sort_by)
        statement = statement.order_by(
            sort_column.desc() if sort_order == "desc" else sort_column.asc(),
            Plan.id.asc(),
        )
        statement = statement.offset((page - 1) * page_size).limit(page_size)
        return list(self.session.scalars(statement)), total

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def create_plan(self, payload: PlanCreate) -> Plan:
        products = self._resolve_products(payload.product_ids)
        plan = Plan(
            **{
                k: v
                for k, v in payload.model_dump().items()
                if k != "product_ids"
            }
        )
        plan.products = products
        self.session.add(plan)
        self._commit_or_conflict("A plan with this name already exists")
        return self.get_plan(plan.id)

    def update_plan(self, plan_id: str, payload: PlanUpdate) -> Plan:
        plan = self.get_plan(plan_id)
        updates = payload.model_dump(exclude_unset=True)

        # Handle product_ids separately from scalar fields
        new_product_ids: list[str] | None = updates.pop("product_ids", None)

        for field, value in updates.items():
            setattr(plan, field, value)

        # Validate the resulting date range after applying partial updates
        effective_from = plan.available_from
        effective_until = plan.available_until
        if (
            effective_from is not None
            and effective_until is not None
            and effective_until < effective_from
        ):
            raise invalid_operation(
                "available_until must not be earlier than available_from"
            )

        if new_product_ids is not None:
            plan.products = self._resolve_products(new_product_ids)

        self._commit_or_conflict("A plan with this name already exists")
        return self.get_plan(plan.id)

    def archive_plan(self, plan_id: str) -> None:
        """Deactivate a plan — never physically delete.

        Existing subscriptions and invoices that reference this plan remain
        valid; only new subscriptions are prevented by the active flag.
        """
        plan = self.get_plan(plan_id)
        if not plan.is_active:
            raise invalid_operation("Plan is already inactive")
        plan.is_active = False
        self.session.commit()

    # ------------------------------------------------------------------
    # Availability
    # ------------------------------------------------------------------

    def check_availability(
        self, plan_id: str, check_date: date
    ) -> tuple[bool, str | None]:
        """Determine whether a plan is available for a new subscription.

        Returns (is_available, reason).  *reason* is non-None when the plan
        is not available and describes why.

        Rules (evaluated in order):
          1. Plan must be active.
          2. check_date must be >= available_from (if set).
          3. check_date must be <= available_until (if set).
        """
        plan = self.get_plan(plan_id)
        return self._availability_for_plan(plan, check_date)

    @staticmethod
    def _availability_for_plan(
        plan: Plan, check_date: date
    ) -> tuple[bool, str | None]:
        if not plan.is_active:
            return False, "Plan is not active"
        if plan.available_from is not None and check_date < plan.available_from:
            return False, (
                f"Plan is not yet available (opens {plan.available_from.isoformat()})"
            )
        if plan.available_until is not None and check_date > plan.available_until:
            return False, (
                f"Plan is no longer available (closed {plan.available_until.isoformat()})"
            )
        return True, None

    # ------------------------------------------------------------------
    # Pricing
    # ------------------------------------------------------------------

    def calculate_price(
        self, plan_id: str, quantity: int, *, customer_visible: bool = False
    ) -> tuple[Plan, Decimal]:
        """Return (plan, total_price) for the requested quantity.

        Uses Decimal arithmetic throughout — never float.
        Validates that quantity >= plan.min_quantity.
        """
        plan = self.get_plan(plan_id, customer_visible=customer_visible)
        if quantity < plan.min_quantity:
            raise invalid_operation(
                f"Minimum quantity for this plan is {plan.min_quantity}"
            )
        total = plan.price * Decimal(quantity)
        return plan, total

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_products(self, product_ids: list[str]) -> list[Product]:
        """Fetch product records for the given IDs.

        Raises 404 if any ID is not found.
        Raises 422 if any product is archived (cannot be newly assigned).
        """
        if not product_ids:
            return []
        products: list[Product] = list(
            self.session.scalars(
                select(Product).where(Product.id.in_(product_ids))
            )
        )
        found_ids = {p.id for p in products}
        missing = set(product_ids) - found_ids
        if missing:
            raise not_found(f"Product(s) {', '.join(sorted(missing))}")

        from app.products.models import ProductStatus

        archived = [p for p in products if p.status == ProductStatus.ARCHIVED]
        if archived:
            names = ", ".join(p.name for p in archived)
            raise invalid_operation(
                f"Archived products cannot be assigned to a plan: {names}"
            )
        return products

    def _commit_or_conflict(self, message: str) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise conflict(message) from exc
