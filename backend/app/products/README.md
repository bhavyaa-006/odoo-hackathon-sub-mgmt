# Product Service

The Product Service owns Brightloop's catalogue, configurable product options, and server-side price previews. It deliberately does not create subscriptions, quotations, invoices, or billing records.

## Database model

The initial repository had no database schema, ORM models, or migrations. Migration `20261031_01` introduces the minimum PostgreSQL-compatible catalogue schema:

- `products`: UUID-like string ID, unique name, `product_type`, exact `sales_price` / `cost_price`, optional `description`, lifecycle `status`, and timestamps.
- `product_variants`: product FK, attribute/value option, exact signed `price_adjustment`, active flag, timestamps, and a unique `(product_id, attribute_name, value)` constraint.

`DELETE` archives a product by setting its status to `archived`; it never removes a record. This protects future plan, quotation, subscription, and invoice references. Variant deletion similarly archives the option (`is_active=false`).

## API

All endpoints require a JWT Bearer token with a `sub` and `role` claim. Roles are `admin`, `staff`, and `customer`.

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/v1/products` | Admin |
| GET | `/api/v1/products` | All (customers see active products only) |
| GET | `/api/v1/products/{product_id}` | All (customers: active only) |
| PATCH | `/api/v1/products/{product_id}` | Admin |
| DELETE | `/api/v1/products/{product_id}` | Admin; archives |
| POST | `/api/v1/products/{product_id}/variants` | Admin |
| GET | `/api/v1/products/{product_id}/variants` | All (customers: active options only) |
| PATCH | `/api/v1/products/{product_id}/variants/{variant_id}` | Admin |
| DELETE | `/api/v1/products/{product_id}/variants/{variant_id}` | Admin; archives |
| POST | `/api/v1/products/{product_id}/calculate-price` | All for a visible product |

Customers never receive `cost_price`. Staff and admins receive it to support internal operations.

Example create request:

```json
{
  "name": "Brightloop ERP",
  "product_type": "service",
  "sales_price": "5000.00",
  "cost_price": "2000.00",
  "description": "ERP suite",
  "status": "active"
}
```

Example price request:

```json
{"variant_ids": ["brand-option-id", "edition-option-id"]}
```

The response returns the base price, each verified adjustment, and final price. The calculation uses `Decimal` throughout:

```text
final_sales_price = sales_price + sum(selected variant price_adjustment)
```

Only one option for a given attribute may be selected. Negative adjustments are supported; clients cannot submit an arbitrary final price.

## Validation and errors

Names and variant attribute/value text are trimmed and cannot be blank. Base prices cannot be negative; variant adjustments are decimal values (including valid discounts). Unknown resources return `404`, duplicate name or attribute/value options return `409`, and invalid request/price selections return `422`.

List filters: `page`, `page_size` (1–100), `search`, `product_type`, `status`, `min_price`, `max_price`, `sort_by` (`name`, `sales_price`, `created_at`, `updated_at`), and `sort_order`. Pagination and filtering execute in SQL.

## Run

```bash
cd backend
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
DATABASE_URL='postgresql+psycopg2://user:password@localhost:5432/brightloop' \
  .venv/bin/alembic upgrade head
JWT_SECRET='replace-with-a-long-random-secret' AUTO_CREATE_SCHEMA=false \
  .venv/bin/uvicorn app.main:app --reload
```

Swagger/OpenAPI is served by the existing FastAPI app at `/docs` and `/openapi.json`.

Run the tests with:

```bash
cd backend
.venv/bin/python -m pytest tests/ -q
```
