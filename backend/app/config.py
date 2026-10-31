"""
Application configuration loaded from environment variables.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/brightloop"

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # App
    app_name: str = "Brightloop Autopilot"
    debug: bool = False
    environment: str = "development"

    # Schema creation — useful for a brand-new local checkout.
    # Production deployments should run Alembic migrations and set this to false.
    auto_create_schema: bool = True

    # Brightloop company GST details (supplier)
    company_gstin: str = "29AABCT1332L000"   # example Karnataka GSTIN
    company_state_code: str = "29"            # Karnataka
    company_name: str = "Brightloop Software Pvt Ltd"
    company_address: str = "Bengaluru, Karnataka, India"
    company_state_name: str = "Karnataka"


@lru_cache
def get_settings() -> Settings:
    return Settings()
