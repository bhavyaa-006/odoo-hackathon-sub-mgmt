"""Application configuration loaded from the environment."""

import os


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brightloop.db")
JWT_SECRET = os.getenv("JWT_SECRET", "development-only-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Schema creation is useful for a brand-new local checkout.  Production deployments
# should run Alembic migrations and set this to false.
AUTO_CREATE_SCHEMA = os.getenv("AUTO_CREATE_SCHEMA", "true").lower() == "true"
