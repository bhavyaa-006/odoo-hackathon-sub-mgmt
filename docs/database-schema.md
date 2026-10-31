# Database schema status

At implementation time this repository did not contain SQL schema files, migrations, an Alembic environment, ORM mappings, or a database initialization script. The Product Service therefore adds the smallest required initial schema in `backend/alembic/versions/20261031_01_initial_product_catalogue.py`.

It creates only `products` and `product_variants`. It does not alter or replace any pre-existing table, FK, or relationship because none were present. The Product Service README describes the fields and constraints.

Before merging into a deployment that already has a product catalogue outside this repository, reconcile that live schema with this migration rather than running a competing migration. In particular, map any existing product references (plans, subscription lines, quotation lines, and invoices) to `products.id` before enabling hard FK constraints in those services.
