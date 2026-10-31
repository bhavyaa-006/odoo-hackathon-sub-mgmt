"""JWT helpers shared by authenticated API modules."""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET


def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed access token. Authentication flows can reuse this helper."""
    expires_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode({"sub": subject, "role": role, "exp": expires_at}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired authentication token") from exc
