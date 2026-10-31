"""Create the plan catalogue tables.

Adds:
  - plans       — subscription plan with pricing, cadence, availability, and flags
  - plan_products — many-to-many association between plans and products

Requires the initial product catalogue migration (20261031_01) to have been
applied first so that the products table and its primary key exist.
"""

from alembic import op
import sqlalchemy as sa

revision = "20261031_02"
down_revision = "20261031_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    billing_interval = sa.Enum(
        "day", "week", "month", "year",
        name="billing_interval",
        native_enum=False,
        create_constraint=True,
    )

    op.create_table(
        "plans",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("billing_interval", billing_interval, nullable=False),
        sa.Column("interval_count", sa.Integer(), nullable=False),
        sa.Column("min_quantity", sa.Integer(), nullable=False),
        sa.Column("available_from", sa.Date(), nullable=True),
        sa.Column("available_until", sa.Date(), nullable=True),
        sa.Column("auto_close", sa.Boolean(), nullable=False),
        sa.Column("allow_early_close", sa.Boolean(), nullable=False),
        sa.Column("allow_pause", sa.Boolean(), nullable=False),
        sa.Column("allow_renew", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_plans_name", "plans", ["name"])
    op.create_index("ix_plans_billing_interval", "plans", ["billing_interval"])
    op.create_index("ix_plans_currency", "plans", ["currency"])
    op.create_index("ix_plans_is_active", "plans", ["is_active"])

    op.create_table(
        "plan_products",
        sa.Column("plan_id", sa.String(length=36), nullable=False),
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("plan_id", "product_id"),
    )
    op.create_index("ix_plan_products_plan_id", "plan_products", ["plan_id"])
    op.create_index("ix_plan_products_product_id", "plan_products", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_products_product_id", table_name="plan_products")
    op.drop_index("ix_plan_products_plan_id", table_name="plan_products")
    op.drop_table("plan_products")

    op.drop_index("ix_plans_is_active", table_name="plans")
    op.drop_index("ix_plans_currency", table_name="plans")
    op.drop_index("ix_plans_billing_interval", table_name="plans")
    op.drop_index("ix_plans_name", table_name="plans")
    op.drop_table("plans")
