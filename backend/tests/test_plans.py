"""Tests for the Plan Service API.

Covers:
  - Plan CRUD (create, retrieve, list, update, archive)
  - Validation (name, price, currency, interval, dates, products)
  - Availability rules (active flag, available_from, available_until)
  - Authorization (admin required for writes; customers see only active plans)
  - Pricing (decimal safety, min_quantity enforcement, total calculation)
  - Product assignment (missing products, archived products, duplicates)
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.database import Base, get_session
from app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_get_session():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def headers(role: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token('test-user', role)}"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def plan_payload(name: str = "Brightloop Monthly", **overrides) -> dict:
    payload: dict = {
        "name": name,
        "price": "499.00",
        "currency": "USD",
        "billing_interval": "month",
        "interval_count": 1,
        "min_quantity": 1,
        "is_active": True,
    }
    payload.update(overrides)
    return payload


def create_plan(client: TestClient, name: str = "Brightloop Monthly", **overrides) -> dict:
    response = client.post(
        "/api/v1/plans", json=plan_payload(name, **overrides), headers=headers("admin")
    )
    assert response.status_code == 201, response.text
    return response.json()


def product_payload(name: str = "ERP Product") -> dict:
    return {
        "name": name,
        "product_type": "service",
        "sales_price": "100.00",
        "cost_price": "50.00",
        "status": "active",
    }


def create_product(client: TestClient, name: str = "ERP Product") -> dict:
    response = client.post(
        "/api/v1/products", json=product_payload(name), headers=headers("admin")
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def test_admin_can_create_and_retrieve_plan(client: TestClient):
    created = create_plan(client)
    assert created["name"] == "Brightloop Monthly"
    assert created["price"] == "499.00"
    assert created["currency"] == "USD"
    assert created["billing_interval"] == "month"
    assert created["interval_count"] == 1
    assert created["is_active"] is True

    retrieved = client.get(f"/api/v1/plans/{created['id']}", headers=headers("staff"))
    assert retrieved.status_code == 200
    assert retrieved.json()["id"] == created["id"]


def test_unknown_plan_is_404(client: TestClient):
    assert (
        client.get("/api/v1/plans/does-not-exist", headers=headers("staff")).status_code
        == 404
    )


def test_list_and_paginate_plans(client: TestClient):
    create_plan(client, "Plan A", billing_interval="month")
    create_plan(client, "Plan B", billing_interval="year")
    response = client.get(
        "/api/v1/plans?page=1&page_size=1&billing_interval=month",
        headers=headers("staff"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["page_size"] == 1
    assert body["total_pages"] == 1
    assert body["items"][0]["name"] == "Plan A"


def test_search_plans_by_name(client: TestClient):
    create_plan(client, "Brightloop ERP")
    create_plan(client, "Brightloop CRM")
    response = client.get("/api/v1/plans?search=ERP", headers=headers("staff"))
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Brightloop ERP"


def test_patch_preserves_omitted_fields(client: TestClient):
    created = create_plan(client)
    response = client.patch(
        f"/api/v1/plans/{created['id']}",
        json={"price": "599.00"},
        headers=headers("admin"),
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["price"] == "599.00"
    assert updated["currency"] == "USD"  # untouched
    assert updated["billing_interval"] == "month"  # untouched
    assert updated["name"] == "Brightloop Monthly"  # untouched


def test_archive_plan_is_non_destructive(client: TestClient):
    created = create_plan(client)
    response = client.delete(
        f"/api/v1/plans/{created['id']}", headers=headers("admin")
    )
    assert response.status_code == 204

    # Still retrievable by admin/staff
    still_there = client.get(
        f"/api/v1/plans/{created['id']}", headers=headers("staff")
    )
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is False

    # Not visible to customers
    assert (
        client.get(
            f"/api/v1/plans/{created['id']}", headers=headers("customer")
        ).status_code
        == 404
    )


def test_archive_already_inactive_plan_is_400(client: TestClient):
    created = create_plan(client, is_active=False)
    assert (
        client.delete(
            f"/api/v1/plans/{created['id']}", headers=headers("admin")
        ).status_code
        == 400
    )


def test_duplicate_plan_name_is_conflict(client: TestClient):
    create_plan(client, "Unique Plan")
    assert (
        client.post(
            "/api/v1/plans", json=plan_payload("Unique Plan"), headers=headers("admin")
        ).status_code
        == 409
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "field,value",
    [
        ("name", "   "),
        ("price", "-1"),
        ("interval_count", 0),
        ("min_quantity", 0),
        ("currency", "US"),       # too short
        ("currency", "USDD"),     # too long
        ("currency", "12$"),      # non-alpha
        ("billing_interval", "quarter"),  # unsupported
    ],
)
def test_create_plan_validates_fields(client: TestClient, field: str, value):
    payload = plan_payload()
    payload[field] = value
    assert (
        client.post("/api/v1/plans", json=payload, headers=headers("admin")).status_code
        == 422
    )


def test_create_plan_rejects_invalid_date_range(client: TestClient):
    payload = plan_payload(
        available_from="2026-12-01",
        available_until="2026-11-01",  # before available_from
    )
    assert (
        client.post("/api/v1/plans", json=payload, headers=headers("admin")).status_code
        == 422
    )


def test_patch_rejects_invalid_date_range(client: TestClient):
    created = create_plan(client, available_from="2026-11-01")
    assert (
        client.patch(
            f"/api/v1/plans/{created['id']}",
            json={"available_until": "2026-10-01"},
            headers=headers("admin"),
        ).status_code
        == 400
    )


def test_currency_is_normalised_to_uppercase(client: TestClient):
    created = create_plan(client, currency="usd")
    assert created["currency"] == "USD"


# ---------------------------------------------------------------------------
# Availability
# ---------------------------------------------------------------------------


def test_active_plan_with_no_dates_is_available(client: TestClient):
    plan = create_plan(client)
    response = client.get(
        f"/api/v1/plans/{plan['id']}/availability", headers=headers("customer")
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_available"] is True
    assert body["reason"] is None


def test_inactive_plan_is_not_available(client: TestClient):
    plan = create_plan(client, is_active=False)
    response = client.get(
        f"/api/v1/plans/{plan['id']}/availability",
        params={"check_date": "2026-11-01"},
        headers=headers("staff"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_available"] is False
    assert "not active" in body["reason"]


def test_date_before_available_from_is_not_available(client: TestClient):
    plan = create_plan(client, available_from="2026-12-01")
    response = client.get(
        f"/api/v1/plans/{plan['id']}/availability",
        params={"check_date": "2026-11-01"},
        headers=headers("customer"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_available"] is False
    assert "not yet" in body["reason"]


def test_date_after_available_until_is_not_available(client: TestClient):
    plan = create_plan(client, available_until="2026-10-31")
    response = client.get(
        f"/api/v1/plans/{plan['id']}/availability",
        params={"check_date": "2026-11-15"},
        headers=headers("customer"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_available"] is False
    assert "no longer" in body["reason"]


def test_date_within_availability_window_is_available(client: TestClient):
    plan = create_plan(
        client,
        available_from="2026-10-01",
        available_until="2026-12-31",
    )
    response = client.get(
        f"/api/v1/plans/{plan['id']}/availability",
        params={"check_date": "2026-11-15"},
        headers=headers("customer"),
    )
    body = response.json()
    assert body["is_available"] is True


def test_archive_does_not_remove_admin_access(client: TestClient):
    """Archiving a plan does not delete it; historical access is preserved."""
    plan = create_plan(client)
    client.delete(f"/api/v1/plans/{plan['id']}", headers=headers("admin"))
    # Admin can still retrieve the archived plan
    response = client.get(f"/api/v1/plans/{plan['id']}", headers=headers("admin"))
    assert response.status_code == 200
    assert response.json()["is_active"] is False


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


def test_staff_and_customer_cannot_create_plans(client: TestClient):
    for role in ("staff", "customer"):
        assert (
            client.post(
                "/api/v1/plans", json=plan_payload("New Plan"), headers=headers(role)
            ).status_code
            == 403
        )


def test_staff_and_customer_cannot_update_plans(client: TestClient):
    plan = create_plan(client)
    for role in ("staff", "customer"):
        assert (
            client.patch(
                f"/api/v1/plans/{plan['id']}",
                json={"price": "1.00"},
                headers=headers(role),
            ).status_code
            == 403
        )


def test_staff_and_customer_cannot_archive_plans(client: TestClient):
    plan = create_plan(client)
    for role in ("staff", "customer"):
        assert (
            client.delete(
                f"/api/v1/plans/{plan['id']}", headers=headers(role)
            ).status_code
            == 403
        )


def test_customer_list_excludes_inactive_plans(client: TestClient):
    create_plan(client, "Active Plan", is_active=True)
    create_plan(client, "Inactive Plan", is_active=False)
    response = client.get("/api/v1/plans", headers=headers("customer"))
    names = [item["name"] for item in response.json()["items"]]
    assert "Active Plan" in names
    assert "Inactive Plan" not in names


def test_unauthenticated_request_is_rejected(client: TestClient):
    # FastAPI's HTTPBearer(auto_error=True) returns 403 when no Authorization
    # header is supplied (consistent with the products API behaviour).
    assert client.get("/api/v1/plans").status_code in (401, 403)


# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------


def test_price_endpoint_returns_decimal_safe_total(client: TestClient):
    plan = create_plan(client, price="100.50")
    response = client.post(
        f"/api/v1/plans/{plan['id']}/price",
        json={"quantity": 3},
        headers=headers("staff"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["unit_price"] == "100.50"
    assert body["total_price"] == "301.50"
    assert body["currency"] == "USD"
    assert body["quantity"] == 3


def test_price_endpoint_enforces_min_quantity(client: TestClient):
    plan = create_plan(client, min_quantity=5)
    response = client.post(
        f"/api/v1/plans/{plan['id']}/price",
        json={"quantity": 2},
        headers=headers("staff"),
    )
    assert response.status_code == 400


def test_price_endpoint_returns_correct_billing_cadence(client: TestClient):
    plan = create_plan(client, billing_interval="year", interval_count=2)
    response = client.post(
        f"/api/v1/plans/{plan['id']}/price",
        json={"quantity": 1},
        headers=headers("staff"),
    )
    body = response.json()
    assert body["billing_interval"] == "year"
    assert body["interval_count"] == 2


def test_customer_cannot_price_inactive_plan(client: TestClient):
    plan = create_plan(client, is_active=False)
    assert (
        client.post(
            f"/api/v1/plans/{plan['id']}/price",
            json={"quantity": 1},
            headers=headers("customer"),
        ).status_code
        == 404
    )


# ---------------------------------------------------------------------------
# Product assignment
# ---------------------------------------------------------------------------


def test_plan_with_products_includes_product_info(client: TestClient):
    product = create_product(client)
    plan = create_plan(client, product_ids=[product["id"]])
    assert len(plan["products"]) == 1
    assert plan["products"][0]["id"] == product["id"]


def test_create_plan_rejects_nonexistent_products(client: TestClient):
    assert (
        client.post(
            "/api/v1/plans",
            json=plan_payload(product_ids=["not-a-real-id"]),
            headers=headers("admin"),
        ).status_code
        == 404
    )


def test_create_plan_rejects_archived_products(client: TestClient):
    product = create_product(client, "To Archive")
    # Archive the product
    client.delete(f"/api/v1/products/{product['id']}", headers=headers("admin"))
    assert (
        client.post(
            "/api/v1/plans",
            json=plan_payload(product_ids=[product["id"]]),
            headers=headers("admin"),
        ).status_code
        == 400
    )


def test_create_plan_rejects_duplicate_product_ids(client: TestClient):
    product = create_product(client)
    assert (
        client.post(
            "/api/v1/plans",
            json=plan_payload(product_ids=[product["id"], product["id"]]),
            headers=headers("admin"),
        ).status_code
        == 422
    )


def test_update_plan_can_replace_products(client: TestClient):
    product_a = create_product(client, "Product A")
    product_b = create_product(client, "Product B")
    plan = create_plan(client, product_ids=[product_a["id"]])
    assert len(plan["products"]) == 1

    response = client.patch(
        f"/api/v1/plans/{plan['id']}",
        json={"product_ids": [product_b["id"]]},
        headers=headers("admin"),
    )
    assert response.status_code == 200
    product_ids_in_response = [p["id"] for p in response.json()["products"]]
    assert product_b["id"] in product_ids_in_response
    assert product_a["id"] not in product_ids_in_response


def test_update_plan_preserves_products_when_not_supplied(client: TestClient):
    product = create_product(client)
    plan = create_plan(client, product_ids=[product["id"]])
    # Update name only — products should be unchanged
    response = client.patch(
        f"/api/v1/plans/{plan['id']}",
        json={"name": "Renamed Plan"},
        headers=headers("admin"),
    )
    assert response.status_code == 200
    assert len(response.json()["products"]) == 1


# ---------------------------------------------------------------------------
# Billing interval edge-cases
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("interval", ["day", "week", "month", "year"])
def test_all_billing_intervals_are_accepted(client: TestClient, interval: str):
    plan = create_plan(client, name=f"Plan {interval}", billing_interval=interval)
    assert plan["billing_interval"] == interval


def test_interval_count_greater_than_one_is_stored(client: TestClient):
    plan = create_plan(client, billing_interval="month", interval_count=3)
    assert plan["interval_count"] == 3


def test_price_for_every_3_months_plan(client: TestClient):
    plan = create_plan(client, billing_interval="month", interval_count=3, price="150.00")
    response = client.post(
        f"/api/v1/plans/{plan['id']}/price",
        json={"quantity": 2},
        headers=headers("staff"),
    )
    body = response.json()
    assert body["total_price"] == "300.00"
    assert body["billing_interval"] == "month"
    assert body["interval_count"] == 3


# ---------------------------------------------------------------------------
# Currency filtering
# ---------------------------------------------------------------------------


def test_filter_by_currency(client: TestClient):
    create_plan(client, "USD Plan", currency="USD")
    create_plan(client, "EUR Plan", currency="EUR")
    response = client.get("/api/v1/plans?currency=EUR", headers=headers("staff"))
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "EUR Plan"


# ---------------------------------------------------------------------------
# Filter by is_active (admin/staff)
# ---------------------------------------------------------------------------


def test_staff_can_filter_inactive_plans(client: TestClient):
    create_plan(client, "Active Plan")
    create_plan(client, "Inactive Plan", is_active=False)
    response = client.get(
        "/api/v1/plans?is_active=false", headers=headers("staff")
    )
    body = response.json()
    assert all(not item["is_active"] for item in body["items"])
