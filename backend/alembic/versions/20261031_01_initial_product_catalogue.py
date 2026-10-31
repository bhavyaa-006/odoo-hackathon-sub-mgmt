"""Create the initial product catalogue tables.

This is an initial migration, required because the repository contained no
database schema, product model, or prior migration.
"""

from alembic import op
import sqlalchemy as sa

revision = "20261031_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    product_type = sa.Enum("service", "product", "add_on", name="product_type", native_enum=False, create_constraint=True)
    product_status = sa.Enum("draft", "active", "inactive", "archived", name="product_status", native_enum=False, create_constraint=True)
    op.create_table(
        "products",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("product_type", product_type, nullable=False),
        sa.Column("sales_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("cost_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", product_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_product_type", "products", ["product_type"])
    op.create_index("ix_products_status", "products", ["status"])
    op.create_table(
        "product_variants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.Column("attribute_name", sa.String(length=100), nullable=False),
        sa.Column("value", sa.String(length=100), nullable=False),
        sa.Column("price_adjustment", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "attribute_name", "value", name="uq_product_variant_attribute_value"),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])
    op.create_index("ix_product_variants_is_active", "product_variants", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_product_variants_is_active", table_name="product_variants")
    op.drop_index("ix_product_variants_product_id", table_name="product_variants")
    op.drop_table("product_variants")
    op.drop_index("ix_products_status", table_name="products")
    op.drop_index("ix_products_product_type", table_name="products")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_table("products")
