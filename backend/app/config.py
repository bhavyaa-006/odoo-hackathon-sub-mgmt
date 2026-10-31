"""
Application configuration loaded from environment variables.
Supports pydantic_settings with pydantic v2 fallback.
"""
from __future__ import annotations

import os
from functools import lru_cache

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    _HAS_SETTINGS = True
except ImportError:
    from pydantic import BaseModel as BaseSettings
    _HAS_SETTINGS = False
    SettingsConfigDict = None


class Settings(BaseSettings):
    if _HAS_SETTINGS:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=False,
            extra="ignore",
        )

    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://brightloop:oddo@localhost:5433/brightloop",
    )

    # JWT
    secret_key: str = os.getenv("JWT_SECRET", "brightloop-super-secure-jwt-secret-key-production-ready")
    algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))  # 24 hours

    # App
    app_name: str = "Brightloop Autopilot"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Schema creation — useful for local dev and hackathon demo runs
    auto_create_schema: bool = os.getenv("AUTO_CREATE_SCHEMA", "true").lower() == "true"

    # Brightloop company GST details (supplier)
    company_gstin: str = os.getenv("COMPANY_GSTIN", "29AABCT1332L000")   # example Karnataka GSTIN
    company_state_code: str = os.getenv("COMPANY_STATE_CODE", "29")      # Karnataka
    company_name: str = os.getenv("COMPANY_NAME", "Brightloop Software Pvt Ltd")
    company_address: str = os.getenv("COMPANY_ADDRESS", "Bengaluru, Karnataka, India")
    company_state_name: str = os.getenv("COMPANY_STATE_NAME", "Karnataka")


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Module-level exports for direct imports
_s = get_settings()
DATABASE_URL = _s.database_url
JWT_SECRET = _s.secret_key
JWT_ALGORITHM = _s.algorithm
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = _s.access_token_expire_minutes
AUTO_CREATE_SCHEMA = _s.auto_create_schema
