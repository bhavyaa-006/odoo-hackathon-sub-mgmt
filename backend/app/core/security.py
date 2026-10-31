"""JWT helpers shared by authenticated API modules."""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import get_settings

_settings = get_settings()


def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed access token. Authentication flows can reuse this helper."""
    expires_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=_settings.access_token_expire_minutes)
    )
    return jwt.encode(
        {"sub": subject, "role": role, "exp": expires_at},
        _settings.secret_key,
        algorithm=_settings.algorithm,
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, _settings.secret_key, algorithms=[_settings.algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired authentication token") from exc
