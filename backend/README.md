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

## Tests

```bash
pytest tests/
```
