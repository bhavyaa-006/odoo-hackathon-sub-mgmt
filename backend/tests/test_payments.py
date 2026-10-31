"""
Tests for Payment Service API.

Covers:
  - Payment recording (electronic instant confirm vs cheque pending)
  - Duplicate reference prevention (409 Conflict)
  - Non-positive amount validation (422 Unprocessable Entity)
  - FIFO auto-allocation across open invoices (oldest due date first)
  - Manual allocation to specific invoices with validation
  - Confirming pending payments (cheque clearance triggers FIFO allocation)
  - Reversing confirmed payments (admin only, active allocations undone, invoice status refreshed)
  - Issuing refunds (admin only, bounded by original amount, cannot refund a refund)
  - Customer outstanding balance computation and RBAC isolation
  - Payment listing with filters and RBAC isolation
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.main  # ensure all models are registered
from app.auth.models import User
from app.billing.models import Invoice, InvoiceKind, InvoiceStatus
from app.core.security import create_access_token
from app.core.dependencies import get_db
from app.database import Base, get_session
from app.main import app
from app.payments.models import InvoicePaymentAllocation, Payment


# ---------------------------------------------------------------------------
# Fixtures & Helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_get_session():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_session
    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def auth_header(user_id: uuid.UUID, role: str) -> dict[str, str]:
    token = create_access_token(subject=str(user_id), role=role)
    return {"Authorization": f"Bearer {token}"}


def create_user(
    client: TestClient,
    email: str,
    name: str,
    role: str = "customer",
) -> uuid.UUID:
    session = next(app.dependency_overrides[get_session]())
    user = User(
        id=uuid.uuid4(),
        email=email,
        name=name,
        role=role,
        hashed_password="hashed_pw_dummy",
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return user_id


def create_invoice(
    customer_id: uuid.UUID,
    total: Decimal,
    invoice_number: str,
    due_date: date | None = None,
    issue_date: date | None = None,
    status: InvoiceStatus = InvoiceStatus.CONFIRMED,
    amount_paid: Decimal = Decimal("0.00"),
) -> uuid.UUID:
    session = next(app.dependency_overrides[get_session]())
    inv = Invoice(
        id=uuid.uuid4(),
        invoice_number=invoice_number,
        customer_id=customer_id,
        kind=InvoiceKind.RECURRING,
        status=status,
        issue_date=issue_date or date.today(),
        due_date=due_date or (date.today() + timedelta(days=15)),
        total=total,
        subtotal=total,
        amount_paid=amount_paid,
        currency="INR",
        payment_term_days=15,
    )
    session.add(inv)
    session.commit()
    inv_id = inv.id
    session.close()
    return inv_id


# ---------------------------------------------------------------------------
# Test: Payment Recording & Status Lifecycle
# ---------------------------------------------------------------------------

def test_record_electronic_payment_immediately_confirmed(client: TestClient):
    """Electronic payments (UPI, NEFT, RTGS, etc.) start as confirmed."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust@test.com", "Cust 1", role="customer")

    payload = {
        "customer_id": str(cust_id),
        "amount": "1500.00",
        "payment_date": str(date.today()),
        "payment_method": "upi",
        "payment_reference": "UPI-TXN-1001",
        "currency": "INR",
        "auto_allocate": False,
    }

    res = client.post("/payments", json=payload, headers=auth_header(admin_id, "admin"))
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "confirmed"
    assert data["payment_number"].startswith("PAY/")
    assert Decimal(data["amount"]) == Decimal("1500.00")
    assert Decimal(data["unallocated_amount"]) == Decimal("1500.00")


def test_record_cheque_starts_pending(client: TestClient):
    """Cheque payments start as pending."""
    staff_id = create_user(client, "staff@test.com", "Staff", role="staff")
    cust_id = create_user(client, "cust2@test.com", "Cust 2", role="customer")

    payload = {
        "customer_id": str(cust_id),
        "amount": "5000.00",
        "payment_date": str(date.today()),
        "payment_method": "cheque",
        "payment_reference": "CHQ-889900",
        "auto_allocate": True,
    }

    res = client.post("/payments", json=payload, headers=auth_header(staff_id, "staff"))
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert len(data["allocations"]) == 0


def test_record_payment_duplicate_reference_rejected(client: TestClient):
    """A duplicate payment_reference returns 409 Conflict."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust3@test.com", "Cust 3", role="customer")

    payload = {
        "customer_id": str(cust_id),
        "amount": "1000.00",
        "payment_date": str(date.today()),
        "payment_method": "neft",
        "payment_reference": "NEFT-UTR-SAME",
    }

    res1 = client.post("/payments", json=payload, headers=auth_header(admin_id, "admin"))
    assert res1.status_code == 201

    res2 = client.post("/payments", json=payload, headers=auth_header(admin_id, "admin"))
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_record_payment_non_positive_amount_rejected(client: TestClient):
    """Amounts <= 0 are rejected with 422."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust4@test.com", "Cust 4", role="customer")

    for bad_amt in ["0.00", "-50.00"]:
        payload = {
            "customer_id": str(cust_id),
            "amount": bad_amt,
            "payment_date": str(date.today()),
            "payment_method": "cash",
        }
        res = client.post("/payments", json=payload, headers=auth_header(admin_id, "admin"))
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# Test: Auto-Allocation (FIFO: oldest due date first)
# ---------------------------------------------------------------------------

def test_auto_allocation_fifo_oldest_first(client: TestClient):
    """
    Payments auto-allocate to open invoices in FIFO order (oldest due_date first).
    Invoice 1 ($1000, due in 5 days) + Invoice 2 ($500, due in 10 days).
    Payment of $1200 covers Invoice 1 fully ($1000 -> PAID) and Invoice 2 partially ($200 -> PARTIALLY_PAID).
    """
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust_fifo@test.com", "Cust FIFO", role="customer")

    inv1_id = create_invoice(
        customer_id=cust_id,
        total=Decimal("1000.00"),
        invoice_number="INV/2026/000001",
        due_date=date.today() + timedelta(days=5),
    )
    inv2_id = create_invoice(
        customer_id=cust_id,
        total=Decimal("500.00"),
        invoice_number="INV/2026/000002",
        due_date=date.today() + timedelta(days=10),
    )

    payload = {
        "customer_id": str(cust_id),
        "amount": "1200.00",
        "payment_date": str(date.today()),
        "payment_method": "bank_transfer",
        "payment_reference": "BT-FIFO-01",
        "auto_allocate": True,
    }

    res = client.post("/payments", json=payload, headers=auth_header(admin_id, "admin"))
    assert res.status_code == 201
    data = res.json()
    assert Decimal(data["unallocated_amount"]) == Decimal("0.00")
    assert len(data["allocations"]) == 2

    # Check allocations
    alloc1 = next(a for a in data["allocations"] if a["invoice_id"] == str(inv1_id))
    alloc2 = next(a for a in data["allocations"] if a["invoice_id"] == str(inv2_id))
    assert Decimal(alloc1["allocated_amount"]) == Decimal("1000.00")
    assert Decimal(alloc2["allocated_amount"]) == Decimal("200.00")

    # Verify database state of invoices
    session = next(app.dependency_overrides[get_session]())
    inv1 = session.query(Invoice).filter(Invoice.id == inv1_id).first()
    inv2 = session.query(Invoice).filter(Invoice.id == inv2_id).first()
    assert inv1.status == InvoiceStatus.PAID
    assert Decimal(str(inv1.amount_paid)) == Decimal("1000.00")
    assert inv2.status == InvoiceStatus.PARTIALLY_PAID
    assert Decimal(str(inv2.amount_paid)) == Decimal("200.00")
    session.close()


def test_auto_allocation_with_overpayment(client: TestClient):
    """Excess payment leaves unallocated balance on the payment."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust_over@test.com", "Cust Over", role="customer")

    inv_id = create_invoice(
        customer_id=cust_id,
        total=Decimal("400.00"),
        invoice_number="INV/2026/000003",
    )

    payload = {
        "customer_id": str(cust_id),
        "amount": "700.00",
        "payment_date": str(date.today()),
        "payment_method": "cash",
        "auto_allocate": True,
    }

    res = client.post("/payments", json=payload, headers=auth_header(admin_id, "admin"))
    assert res.status_code == 201
    data = res.json()
    assert Decimal(data["unallocated_amount"]) == Decimal("300.00")
    assert len(data["allocations"]) == 1
    assert Decimal(data["allocations"][0]["allocated_amount"]) == Decimal("400.00")


# ---------------------------------------------------------------------------
# Test: Manual Allocation
# ---------------------------------------------------------------------------

def test_manual_allocation_to_specific_invoice(client: TestClient):
    """Manual allocation allows applying unallocated funds to a designated invoice."""
    staff_id = create_user(client, "staff@test.com", "Staff", role="staff")
    cust_id = create_user(client, "cust_manual@test.com", "Cust Manual", role="customer")

    inv_id = create_invoice(
        customer_id=cust_id,
        total=Decimal("800.00"),
        invoice_number="INV/2026/000004",
    )

    # Record unallocated payment
    pay_res = client.post(
        "/payments",
        json={
            "customer_id": str(cust_id),
            "amount": "1000.00",
            "payment_date": str(date.today()),
            "payment_method": "bank_transfer",
            "auto_allocate": False,
        },
        headers=auth_header(staff_id, "staff"),
    )
    payment_id = pay_res.json()["id"]

    # Allocate 500 to the invoice
    alloc_res = client.post(
        f"/payments/{payment_id}/allocate",
        json={
            "payment_id": payment_id,
            "invoice_id": str(inv_id),
            "allocated_amount": "500.00",
            "notes": "Partial manual settlement",
        },
        headers=auth_header(staff_id, "staff"),
    )
    assert alloc_res.status_code == 201
    alloc_data = alloc_res.json()
    assert Decimal(alloc_data["allocated_amount"]) == Decimal("500.00")

    # Verify payment unallocated balance is now 500
    pay_check = client.get(f"/payments/{payment_id}", headers=auth_header(staff_id, "staff"))
    assert Decimal(pay_check.json()["unallocated_amount"]) == Decimal("500.00")

    # Exceeding remaining unallocated balance is rejected
    err_res = client.post(
        f"/payments/{payment_id}/allocate",
        json={
            "payment_id": payment_id,
            "invoice_id": str(inv_id),
            "allocated_amount": "600.00",
        },
        headers=auth_header(staff_id, "staff"),
    )
    assert err_res.status_code == 400
    assert "exceeds the payment's unallocated balance" in err_res.json()["detail"]


def test_manual_allocation_cross_customer_rejected(client: TestClient):
    """Cannot allocate payment to an invoice belonging to a different customer."""
    staff_id = create_user(client, "staff@test.com", "Staff", role="staff")
    cust_a = create_user(client, "cust_a@test.com", "Cust A", role="customer")
    cust_b = create_user(client, "cust_b@test.com", "Cust B", role="customer")

    inv_b = create_invoice(
        customer_id=cust_b,
        total=Decimal("500.00"),
        invoice_number="INV/2026/000005",
    )

    pay_a = client.post(
        "/payments",
        json={
            "customer_id": str(cust_a),
            "amount": "500.00",
            "payment_date": str(date.today()),
            "payment_method": "upi",
            "auto_allocate": False,
        },
        headers=auth_header(staff_id, "staff"),
    ).json()

    res = client.post(
        f"/payments/{pay_a['id']}/allocate",
        json={
            "payment_id": pay_a["id"],
            "invoice_id": str(inv_b),
            "allocated_amount": "500.00",
        },
        headers=auth_header(staff_id, "staff"),
    )
    assert res.status_code == 400
    assert "different customers" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Test: Confirming Pending Payments (Cheque clearing)
# ---------------------------------------------------------------------------

def test_confirm_pending_payment_triggers_allocation(client: TestClient):
    """Confirming a pending cheque triggers FIFO auto-allocation."""
    staff_id = create_user(client, "staff@test.com", "Staff", role="staff")
    cust_id = create_user(client, "cust_chq@test.com", "Cust Cheque", role="customer")

    inv_id = create_invoice(
        customer_id=cust_id,
        total=Decimal("1500.00"),
        invoice_number="INV/2026/000006",
    )

    pay = client.post(
        "/payments",
        json={
            "customer_id": str(cust_id),
            "amount": "1500.00",
            "payment_date": str(date.today()),
            "payment_method": "cheque",
            "payment_reference": "CHQ-1234",
            "auto_allocate": True,
        },
        headers=auth_header(staff_id, "staff"),
    ).json()
    assert pay["status"] == "pending"

    # Confirm the cheque cleared
    conf_res = client.post(
        f"/payments/{pay['id']}/confirm",
        json={"notes": "Cleared at HDFC Bank"},
        headers=auth_header(staff_id, "staff"),
    )
    assert conf_res.status_code == 200
    conf_data = conf_res.json()
    assert conf_data["status"] == "confirmed"
    assert len(conf_data["allocations"]) == 1
    assert Decimal(conf_data["allocations"][0]["allocated_amount"]) == Decimal("1500.00")

    # Invoice should now be PAID
    session = next(app.dependency_overrides[get_session]())
    inv = session.query(Invoice).filter(Invoice.id == inv_id).first()
    assert inv.status == InvoiceStatus.PAID
    session.close()


# ---------------------------------------------------------------------------
# Test: Payment Reversal (Admin only)
# ---------------------------------------------------------------------------

def test_reverse_payment_by_admin_restores_invoice_status(client: TestClient):
    """
    Reversing a payment marks it reversed, sets reversed_at on allocations,
    and recalculates invoice amount_paid and status back to CONFIRMED.
    """
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust_rev@test.com", "Cust Rev", role="customer")

    inv_id = create_invoice(
        customer_id=cust_id,
        total=Decimal("600.00"),
        invoice_number="INV/2026/000007",
    )

    pay = client.post(
        "/payments",
        json={
            "customer_id": str(cust_id),
            "amount": "600.00",
            "payment_date": str(date.today()),
            "payment_method": "upi",
            "auto_allocate": True,
        },
        headers=auth_header(admin_id, "admin"),
    ).json()

    # Verify invoice was marked paid
    session = next(app.dependency_overrides[get_session]())
    inv = session.query(Invoice).filter(Invoice.id == inv_id).first()
    assert inv.status == InvoiceStatus.PAID
    session.close()

    # Admin reverses the payment
    rev_res = client.post(
        f"/payments/{pay['id']}/reverse",
        json={"reason": "Customer bank bounce / chargeback"},
        headers=auth_header(admin_id, "admin"),
    )
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["status"] == "reversed"
    assert rev_data["reversal_reason"] == "Customer bank bounce / chargeback"
    assert rev_data["reversed_at"] is not None

    # Check invoice status reverted to CONFIRMED and amount_paid to 0
    session = next(app.dependency_overrides[get_session]())
    inv = session.query(Invoice).filter(Invoice.id == inv_id).first()
    assert inv.status == InvoiceStatus.CONFIRMED
    assert Decimal(str(inv.amount_paid)) == Decimal("0.00")
    session.close()


def test_reverse_payment_non_admin_forbidden(client: TestClient):
    """Staff or customer cannot reverse payments (403 Forbidden)."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    staff_id = create_user(client, "staff@test.com", "Staff", role="staff")
    cust_id = create_user(client, "cust_rev2@test.com", "Cust Rev 2", role="customer")

    pay = client.post(
        "/payments",
        json={
            "customer_id": str(cust_id),
            "amount": "200.00",
            "payment_date": str(date.today()),
            "payment_method": "upi",
        },
        headers=auth_header(admin_id, "admin"),
    ).json()

    res = client.post(
        f"/payments/{pay['id']}/reverse",
        json={"reason": "Unauthorized attempt"},
        headers=auth_header(staff_id, "staff"),
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Test: Refunds (Admin only)
# ---------------------------------------------------------------------------

def test_issue_refund_validates_and_creates_record(client: TestClient):
    """Admin can issue refund against an original confirmed payment."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    cust_id = create_user(client, "cust_rfnd@test.com", "Cust Refund", role="customer")

    original = client.post(
        "/payments",
        json={
            "customer_id": str(cust_id),
            "amount": "2000.00",
            "payment_date": str(date.today()),
            "payment_method": "bank_transfer",
        },
        headers=auth_header(admin_id, "admin"),
    ).json()

    # Issue partial refund
    rfnd_res = client.post(
        "/payments/refunds",
        json={
            "original_payment_id": original["id"],
            "amount": "800.00",
            "refund_date": str(date.today()),
            "payment_method": "bank_transfer",
            "notes": "Service dissatisfaction refund",
        },
        headers=auth_header(admin_id, "admin"),
    )
    assert rfnd_res.status_code == 201
    rfnd_data = rfnd_res.json()
    assert rfnd_data["is_refund"] is True
    assert rfnd_data["refund_for_payment_id"] == original["id"]
    assert Decimal(rfnd_data["amount"]) == Decimal("800.00")
    assert rfnd_data["status"] == "confirmed"

    # Refund exceeding original payment is rejected
    err_res = client.post(
        "/payments/refunds",
        json={
            "original_payment_id": original["id"],
            "amount": "3000.00",
            "refund_date": str(date.today()),
            "payment_method": "bank_transfer",
        },
        headers=auth_header(admin_id, "admin"),
    )
    assert err_res.status_code == 400
    assert "exceeds original payment amount" in err_res.json()["detail"]


# ---------------------------------------------------------------------------
# Test: Customer Outstanding Balances
# ---------------------------------------------------------------------------

def test_customer_outstanding_balance_calculation(client: TestClient):
    """Calculates total unpaid amount, invoice count, and earliest due date."""
    staff_id = create_user(client, "staff@test.com", "Staff", role="staff")
    cust_id = create_user(client, "cust_out@test.com", "Cust Out", role="customer")

    earliest_date = date.today() + timedelta(days=3)
    later_date = date.today() + timedelta(days=15)

    create_invoice(
        customer_id=cust_id,
        total=Decimal("1200.00"),
        invoice_number="INV/2026/000008",
        due_date=earliest_date,
        amount_paid=Decimal("200.00"),
        status=InvoiceStatus.PARTIALLY_PAID,
    )
    create_invoice(
        customer_id=cust_id,
        total=Decimal("800.00"),
        invoice_number="INV/2026/000009",
        due_date=later_date,
        status=InvoiceStatus.CONFIRMED,
    )

    res = client.get(
        f"/customers/{cust_id}/outstanding",
        headers=auth_header(staff_id, "staff"),
    )
    assert res.status_code == 200
    data = res.json()
    # 1000 remaining on inv 1 + 800 on inv 2 = 1800
    assert Decimal(str(data["total_outstanding"])) == Decimal("1800.00")
    assert data["invoice_count"] == 2
    assert data["oldest_due_date"] == str(earliest_date)


def test_customer_cannot_view_others_outstanding(client: TestClient):
    """Customer receives 403 when trying to access another customer's balance."""
    cust1_id = create_user(client, "c1@test.com", "Customer One", role="customer")
    cust2_id = create_user(client, "c2@test.com", "Customer Two", role="customer")

    res = client.get(
        f"/customers/{cust2_id}/outstanding",
        headers=auth_header(cust1_id, "customer"),
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Test: Payment Listing & RBAC Filtering
# ---------------------------------------------------------------------------

def test_customer_only_sees_own_payments_in_list(client: TestClient):
    """Customers are restricted to their own payment records."""
    admin_id = create_user(client, "admin@test.com", "Admin", role="admin")
    c1 = create_user(client, "c1_list@test.com", "C1", role="customer")
    c2 = create_user(client, "c2_list@test.com", "C2", role="customer")

    # C1 payment
    client.post(
        "/payments",
        json={
            "customer_id": str(c1),
            "amount": "100.00",
            "payment_date": str(date.today()),
            "payment_method": "upi",
        },
        headers=auth_header(admin_id, "admin"),
    )

    # C2 payment
    client.post(
        "/payments",
        json={
            "customer_id": str(c2),
            "amount": "200.00",
            "payment_date": str(date.today()),
            "payment_method": "cash",
        },
        headers=auth_header(admin_id, "admin"),
    )

    # C1 lists payments
    c1_list = client.get("/payments", headers=auth_header(c1, "customer"))
    assert c1_list.status_code == 200
    assert c1_list.json()["total"] == 1
    assert c1_list.json()["items"][0]["customer_id"] == str(c1)

    # Admin lists all payments
    admin_list = client.get("/payments", headers=auth_header(admin_id, "admin"))
    assert admin_list.status_code == 200
    assert admin_list.json()["total"] >= 2
