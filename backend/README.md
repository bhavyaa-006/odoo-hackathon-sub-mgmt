# Backend — Subscription Management API

FastAPI backend for the **Brightloop Software Subscription Management System**.

## Tech Stack

- Python 3.11
- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- JWT Authentication
- Alembic (migrations)

## Project Structure

```text
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration / environment variables
│   ├── database.py          # Database engine and session management
│   ├── auth/                # Authentication routes, models, schemas, service
│   ├── users/               # Customer / staff management
│   ├── products/            # Products and variants
│   ├── plans/               # Subscription plans
│   ├── quotations/          # Quotation templates and lifecycle
│   ├── subscriptions/       # Subscription lifecycle
│   ├── billing/             # Billing and invoice generation
│   ├── invoices/            # Invoice management
│   ├── payments/            # Payment recording and reconciliation
│   ├── discounts/           # Discount rules
│   ├── taxes/               # Tax rules and calculations
│   ├── notifications/       # Notifications
│   ├── reporting/           # Reporting / finance views
│   ├── core/                # Audit, permissions, security, exceptions
│   └── utils/               # Calculations and number sequences
└── tests/                   # Backend tests
```

## Prerequisites

- Python 3.11+
- PostgreSQL database
- (Optional) Docker for containerized setup

## Local Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Linux / macOS
   # .venv\Scripts\activate       # Windows
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables (see below) and make sure PostgreSQL is running.

5. Start the development server:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. Verify the API:

   - Health check: `GET http://localhost:8000/health`
   - Swagger docs: `GET http://localhost:8000/docs`

## Environment Variables

| Variable        | Description                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`  | PostgreSQL connection string, e.g. `postgresql+psycopg2://user:pass@host.docker.internal:5432/subscriptions` |
| `JWT_SECRET`    | Secret used to sign JWT access tokens                                  |

## Docker

The repository's Compose setup starts PostgreSQL, builds the API image, runs
the Alembic product migration, and exposes Swagger at `http://localhost:8000/docs`.
From the repository root:

```bash
cp .env.example .env
# replace JWT_SECRET and POSTGRES_PASSWORD before any non-local deployment
docker compose up --build -d
```

Check readiness and stop the stack:

```bash
docker compose ps
curl http://localhost:8000/health
docker compose down
```

For a standalone image connected to an existing PostgreSQL server, build with
`docker build -t brightloop-product-service backend` and provide `DATABASE_URL`,
`JWT_SECRET`, and `AUTO_CREATE_SCHEMA=false` at runtime. The image entrypoint
runs `alembic upgrade head` before starting Uvicorn.

## Product Service — Routes

The backend currently exposes a product catalogue service, mounted from the
products module:

```python
router = APIRouter(prefix="/api/v1/products", tags=["Products"])
```

Base URL: `/api/v1/products`

### Health

- `GET /health` — public liveness probe. Returns `{"status":"ok"}`.

### Authenticated endpoints (JWT bearer required)

All product list/get endpoints require a valid JWT via the
`Authorization: Bearer <token>` header.

#### List products

- `GET /api/v1/products`
- Query params:
  - `page` — int, `>= 1`, default `1`
  - `page_size` — int, `1..100`, default `20`
  - `search` — optional string, max 255
  - `product_type` — optional
  - `status` — optional (bound to `status_filter` query alias)
  - `min_price` / `max_price` — optional decimals, `>= 0`
  - `sort_by` — `name` | `sales_price` | `created_at` | `updated_at`, default `created_at`
  - `sort_order` — `asc` | `desc`, default `desc`
- Returns `ProductPage`: `{ items: [...], total, page, page_size, total_pages }`

#### Get product

- `GET /api/v1/products/{product_id}`
- Returns the product; customers only see active variants; internal cost price is
  only included for admin/internal contexts.

#### Calculate price

- `POST /api/v1/products/{product_id}/calculate-price`
- Body: `{ "variant_ids": ["..."] }`
- Returns `PriceResponse` with base sales price and variant adjustments.

### Admin-only endpoints (require admin role)

- `POST /api/v1/products` — create product (`201 Created`)
- `PATCH /api/v1/products/{product_id}` — update product
- `DELETE /api/v1/products/{product_id}` — archive product (`204 No Content`)
- `POST /api/v1/products/{product_id}/variants` — create variant (`201 Created`)
- `PATCH /api/v1/products/{product_id}/variants/{variant_id}` — update variant
- `DELETE /api/v1/products/{product_id}/variants/{variant_id}` — archive variant (`204 No Content`)

### Authorization summary

- Authenticated endpoints use `Depends(get_current_principal)`.
- Admin-only endpoints use `Depends(require_admin)`.
- Missing token → `403 {"detail":"Not authenticated"}`.
- Valid token but insufficient role → `403 {"detail":"Administrator permission is required"}`.

## Plan Service

Plans are the second layer in the subscription workflow:
**Products → Plans → Quotations → Subscriptions → Billing → Invoices**

A plan captures:
- Pricing and currency
- Billing cadence (interval + interval count)
- Availability window (`available_from` / `available_until`)
- Lifecycle flags (`is_active`, `allow_pause`, `allow_renew`, `auto_close`, `allow_early_close`)
- Optional product references (many-to-many)

Historical correctness: editing a plan does **not** change existing subscription items or
invoice line amounts — those services snapshot prices at their own creation time.

### Plan model fields

| Field | Type | Notes |
|---|---|---|
| `id` | `String(36)` UUID | Primary key |
| `name` | `String(200)` | Unique, required |
| `description` | `Text` | Optional |
| `price` | `Numeric(12,2)` | Non-negative, stored as Decimal |
| `currency` | `String(3)` | ISO 4217 (e.g. `USD`, `EUR`) |
| `billing_interval` | Enum | `day`, `week`, `month`, `year` |
| `interval_count` | `Integer` | ≥ 1 |
| `min_quantity` | `Integer` | ≥ 1 |
| `available_from` | `Date` | Nullable |
| `available_until` | `Date` | Nullable; must be ≥ `available_from` if both set |
| `auto_close` | `Boolean` | Default `false` |
| `allow_early_close` | `Boolean` | Default `false` |
| `allow_pause` | `Boolean` | Default `true` |
| `allow_renew` | `Boolean` | Default `true` |
| `is_active` | `Boolean` | Default `true`; `false` hides plan from new subscriptions |
| `created_at` | `DateTime(tz)` | UTC, auto-set |
| `updated_at` | `DateTime(tz)` | UTC, auto-updated |

### Supported billing intervals

| Value | Meaning |
|---|---|
| `day` | Every N days |
| `week` | Every N weeks |
| `month` | Every N months |
| `year` | Every N years |

`interval_count` determines N. Example: `billing_interval=month, interval_count=3` = quarterly.

### Plan API endpoints

Base URL: `/api/v1/plans`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/plans` | admin | Create a plan — `201 Created` |
| `GET` | `/api/v1/plans` | all roles | List / search / filter / paginate |
| `GET` | `/api/v1/plans/{plan_id}` | all roles | Get plan by ID |
| `PATCH` | `/api/v1/plans/{plan_id}` | admin | Partial update |
| `DELETE` | `/api/v1/plans/{plan_id}` | admin | Archive (deactivate) — `204 No Content` |
| `GET` | `/api/v1/plans/{plan_id}/availability` | all roles | Check availability for a date |
| `POST` | `/api/v1/plans/{plan_id}/price` | all roles | Price breakdown for a quantity |

#### List query parameters

| Parameter | Description |
|---|---|
| `page` / `page_size` | Pagination (default 1 / 20, max 100) |
| `search` | Substring match on plan name |
| `billing_interval` | Filter by billing interval |
| `is_active` | Filter by active status (ignored for customers — always `true`) |
| `currency` | Filter by 3-letter currency code |
| `sort_by` | `name` \| `price` \| `created_at` \| `updated_at` |
| `sort_order` | `asc` \| `desc` |

#### Availability check

`GET /api/v1/plans/{plan_id}/availability?check_date=YYYY-MM-DD`

Omit `check_date` to use today (UTC). Returns:

```json
{
  "plan_id": "...",
  "check_date": "2026-11-01",
  "is_available": true,
  "reason": null
}
```

A plan is unavailable when:
1. `is_active` is `false`
2. `check_date` < `available_from` (plan not yet open)
3. `check_date` > `available_until` (plan has closed)

#### Price breakdown

`POST /api/v1/plans/{plan_id}/price` with body `{"quantity": 5}`. Returns:

```json
{
  "plan_id": "...",
  "unit_price": "499.00",
  "currency": "USD",
  "quantity": 5,
  "total_price": "2495.00",
  "billing_interval": "month",
  "interval_count": 1
}
```

Quantity must be ≥ `plan.min_quantity`.

### Plan authorization rules

| Operation | Admin | Staff | Customer |
|---|---|---|---|
| Create plan | ✅ | ❌ (403) | ❌ (403) |
| Update plan | ✅ | ❌ (403) | ❌ (403) |
| Archive plan | ✅ | ❌ (403) | ❌ (403) |
| List / get plans | ✅ all | ✅ all | ✅ active only |
| Check availability | ✅ | ✅ | ✅ |
| Price breakdown | ✅ | ✅ | ✅ active only |

Customers automatically see only active plans (`is_active=true`). Inactive plans
return `404` for customers on direct access, and are excluded from list results.

## Tests

```bash
pytest tests/
```

Test suite breakdown:

| File | Tests |
|---|---|
| `tests/test_products.py` | 12 — product catalogue CRUD, variants, pricing, auth |
| `tests/test_plans.py` | 48 — plan CRUD, validation, availability, pricing, auth, products |
