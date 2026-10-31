from fastapi import FastAPI

app = FastAPI(
    title="Brightloop Subscription Management API",
    description="Backend API for the Brightloop Software subscription management system.",
)


@app.get("/health")
def health_check():
    """Basic liveness probe for the service."""
    return {"status": "ok"}
