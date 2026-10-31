"""
Brightloop Autopilot Main Application.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine

# ---------------------------------------------------------------------------
# Import all models so their metadata is registered with Base before
# create_all() is called at startup.
# ---------------------------------------------------------------------------
from app.auth import models as auth_models  # noqa: F401
from app.plans import models as plan_models  # noqa: F401
from app.products import models as product_models  # noqa: F401
from app.subscriptions import models as subscription_models  # noqa: F401
from app.taxes import models as tax_models  # noqa: F401
from app.discounts import models as discount_models  # noqa: F401
from app.billing import models as billing_models  # noqa: F401
from app.payments import models as payment_models  # noqa: F401
from app.utils import numbering as numbering_models  # noqa: F401

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.auth.router import router as auth_router
from app.users.customer_router import router as portal_router
from app.plans.router import router as plans_router
from app.products.router import router as products_router
from app.taxes.router import router as taxes_router
from app.discounts.router import router as discounts_router
from app.billing.router import router as billing_router
from app.payments.router import router as payments_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    Application startup & shutdown events:
    1. Creates database tables if auto_create_schema is True
    2. Seeds default demo accounts (admin, staff, customer)
    """
    if settings.auto_create_schema:
        try:
            Base.metadata.create_all(bind=engine)
            # Seed default accounts for frontend login
            from app.auth.service import seed_default_users
            with SessionLocal() as db:
                seed_default_users(db)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"Startup DB auto-init skipped or failed: {exc}")
    yield


app = FastAPI(
    title="Brightloop Autopilot API",
    description=(
        "Backend API for the Brightloop Autopilot subscription management system. "
        "Handles authentication, subscriptions, billing, payments, and Indian GST tax calculations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Configuration (allows frontend development and production origins)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Router Registration
# ---------------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(portal_router)
app.include_router(products_router)
app.include_router(plans_router)
app.include_router(taxes_router)
app.include_router(discounts_router)
app.include_router(billing_router)
app.include_router(payments_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
def health_check():
    """Basic liveness probe for the service."""
    return {"status": "ok"}
