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

Build the image (run from the repository root):

```bash
docker build -t odoo-hackathon-sub-mgmt-backend /path/to/odoo-hackathon-sub-mgmt/backend
```

Run the container:

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL="postgresql+psycopg2://user:pass@host.docker.internal:5432/subscriptions" \
  -e JWT_SECRET="<runtime-secret>" \
  odoo-hackathon-sub-mgmt-backend
```

The API will be available at `http://localhost:8000`.

## Tests

```bash
pytest tests/
```
