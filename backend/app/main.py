from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import Base, engine

# ---------------------------------------------------------------------------
# Import all models so their metadata is registered with Base before
# create_all() is called at startup.
# ---------------------------------------------------------------------------
from app.products import models as product_models  # noqa: F401

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.products.router import router as products_router
from app.taxes.router import router as taxes_router
from app.discounts.router import router as discounts_router
from app.billing.router import router as billing_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Create all tables on startup when AUTO_CREATE_SCHEMA is enabled."""
    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Brightloop Autopilot API",
    description=(
        "Backend API for the Brightloop Autopilot subscription management system. "
        "Handles subscriptions, billing, payments, and Indian GST tax calculations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(products_router)
app.include_router(taxes_router)
app.include_router(discounts_router)
app.include_router(billing_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"])
def health_check():
    """Basic liveness probe for the service."""
    return {"status": "ok"}
