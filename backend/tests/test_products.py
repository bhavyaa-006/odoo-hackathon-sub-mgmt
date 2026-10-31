from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.database import Base, get_session
from app.main import app


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


def product_payload(name: str = "Brightloop ERP", **overrides):
    payload = {
        "name": name,
        "product_type": "service",
        "sales_price": "5000.00",
        "cost_price": "2000.00",
        "description": "ERP suite",
        "status": "active",
    }
    payload.update(overrides)
    return payload


def create_product(client: TestClient, name: str = "Brightloop ERP", **overrides) -> dict:
    response = client.post("/api/v1/products", json=product_payload(name, **overrides), headers=headers("admin"))
    assert response.status_code == 201, response.text
    return response.json()


def test_admin_can_create_and_retrieve_product(client: TestClient):
    created = create_product(client)
    assert created["cost_price"] == "2000.00"
    retrieved = client.get(f"/api/v1/products/{created['id']}", headers=headers("staff"))
    assert retrieved.status_code == 200
    assert retrieved.json()["name"] == "Brightloop ERP"


@pytest.mark.parametrize("field,value", [("name", "   "), ("sales_price", "-1"), ("cost_price", "-1")])
def test_create_validates_product_data(client: TestClient, field: str, value: str):
    payload = product_payload()
    payload[field] = value
    assert client.post("/api/v1/products", json=payload, headers=headers("admin")).status_code == 422


def test_duplicate_product_is_a_conflict(client: TestClient):
    create_product(client)
    assert client.post("/api/v1/products", json=product_payload(), headers=headers("admin")).status_code == 409


def test_list_search_filter_and_database_pagination(client: TestClient):
    create_product(client, "Brightloop ERP")
    create_product(client, "Brightloop CRM", product_type="product")
    response = client.get("/api/v1/products?search=ERP&page=1&page_size=1&product_type=service", headers=headers("staff"))
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1 and body["page"] == 1 and body["page_size"] == 1 and body["total_pages"] == 1
    assert body["items"][0]["name"] == "Brightloop ERP"


def test_patch_preserves_omitted_fields_and_unknown_product_is_404(client: TestClient):
    created = create_product(client)
    response = client.patch(f"/api/v1/products/{created['id']}", json={"sales_price": "5500.00"}, headers=headers("admin"))
    assert response.status_code == 200
    assert response.json()["sales_price"] == "5500.00"
    assert response.json()["cost_price"] == "2000.00"
    assert client.get("/api/v1/products/missing", headers=headers("staff")).status_code == 404


def test_variant_crud_and_cross_product_protection(client: TestClient):
    first = create_product(client, "ERP")
    second = create_product(client, "CRM")
    created = client.post(
        f"/api/v1/products/{first['id']}/variants",
        json={"attribute_name": "Brand", "value": "Odoo", "price_adjustment": "560.00"},
        headers=headers("admin"),
    )
    assert created.status_code == 201, created.text
    variant = created.json()
    assert variant["effective_sales_price"] == "5560.00"
    assert client.get(f"/api/v1/products/{first['id']}/variants", headers=headers("staff")).json()[0]["id"] == variant["id"]
    assert client.patch(
        f"/api/v1/products/{second['id']}/variants/{variant['id']}", json={"value": "Other"}, headers=headers("admin")
    ).status_code == 404
    assert client.post(
        f"/api/v1/products/{first['id']}/variants",
        json={"attribute_name": "Brand", "value": "Odoo", "price_adjustment": "0"}, headers=headers("admin")
    ).status_code == 409
    assert client.delete(f"/api/v1/products/{first['id']}/variants/{variant['id']}", headers=headers("admin")).status_code == 204


def test_server_side_pricing_and_invalid_selections(client: TestClient):
    product = create_product(client)
    brand = client.post(
        f"/api/v1/products/{product['id']}/variants", json={"attribute_name": "Brand", "value": "Odoo", "price_adjustment": "560"}, headers=headers("admin")
    ).json()
    edition = client.post(
        f"/api/v1/products/{product['id']}/variants", json={"attribute_name": "Edition", "value": "Enterprise", "price_adjustment": "1000"}, headers=headers("admin")
    ).json()
    response = client.post(f"/api/v1/products/{product['id']}/calculate-price", json={"variant_ids": [brand["id"]]}, headers=headers("staff"))
    assert response.json()["final_sales_price"] == "5560.00"
    response = client.post(f"/api/v1/products/{product['id']}/calculate-price", json={"variant_ids": [brand["id"], edition["id"]]}, headers=headers("staff"))
    assert response.json()["final_sales_price"] == "6560.00"
    assert client.post(f"/api/v1/products/{product['id']}/calculate-price", json={"variant_ids": ["missing"]}, headers=headers("staff")).status_code == 422
    assert client.post(f"/api/v1/products/{product['id']}/calculate-price", json={"variant_ids": [brand["id"], brand["id"]]}, headers=headers("staff")).status_code == 422
    other_product = create_product(client, "Other ERP")
    other_variant = client.post(
        f"/api/v1/products/{other_product['id']}/variants", json={"attribute_name": "Brand", "value": "Other", "price_adjustment": "0"}, headers=headers("admin")
    ).json()
    assert client.post(f"/api/v1/products/{product['id']}/calculate-price", json={"variant_ids": [other_variant["id"]]}, headers=headers("staff")).status_code == 422


def test_negative_variant_adjustment_is_supported(client: TestClient):
    product = create_product(client)
    variant = client.post(
        f"/api/v1/products/{product['id']}/variants", json={"attribute_name": "Promotion", "value": "Launch", "price_adjustment": "-500"}, headers=headers("admin")
    ).json()
    response = client.post(f"/api/v1/products/{product['id']}/calculate-price", json={"variant_ids": [variant["id"]]}, headers=headers("staff"))
    assert response.json()["final_sales_price"] == "4500.00"


def test_role_enforcement_and_customer_data_visibility(client: TestClient):
    product = create_product(client)
    assert client.post("/api/v1/products", json=product_payload("Unauthorised"), headers=headers("staff")).status_code == 403
    assert client.post("/api/v1/products", json=product_payload("Unauthorised 2"), headers=headers("customer")).status_code == 403
    customer_response = client.get(f"/api/v1/products/{product['id']}", headers=headers("customer"))
    assert customer_response.status_code == 200
    assert "cost_price" not in customer_response.json()
    assert client.patch(f"/api/v1/products/{product['id']}", json={"name": "No"}, headers=headers("staff")).status_code == 403


def test_customer_cannot_view_unpublished_and_archive_is_non_destructive(client: TestClient):
    draft = create_product(client, "Draft Product", status="draft")
    assert client.get(f"/api/v1/products/{draft['id']}", headers=headers("customer")).status_code == 404
    assert client.delete(f"/api/v1/products/{draft['id']}", headers=headers("admin")).status_code == 204
    archived = client.get(f"/api/v1/products/{draft['id']}", headers=headers("staff"))
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"
