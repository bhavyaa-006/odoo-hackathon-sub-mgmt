from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import AUTO_CREATE_SCHEMA
from app.database import Base, engine
from app.plans import models as plan_models  # noqa: F401 - registers plan metadata
from app.plans.router import router as plans_router
from app.products import models as product_models  # noqa: F401 - registers product metadata
from app.products.router import router as products_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    if AUTO_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="Brightloop Subscription Management API",
    description="Backend API for the Brightloop Software subscription management system.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(products_router)
app.include_router(plans_router)


@app.get("/health")
def health_check():
    """Basic liveness probe for the service."""
    return {"status": "ok"}
