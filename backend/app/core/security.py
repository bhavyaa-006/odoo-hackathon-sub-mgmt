"""
JWT helpers and password hashing shared by authenticated API modules.
Supports passlib[bcrypt] with standard-library pbkdf2 fallback.
"""
from __future__ import annotations
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from app.config import get_settings

_settings = get_settings()

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
try:
    from passlib.context import CryptContext
    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _HAS_PASSLIB = True
except ImportError:
    _pwd_context = None
    _HAS_PASSLIB = False

def get_password_hash(password: str) -> str:
    """Generate a secure salted hash for the given plain password."""
    if _HAS_PASSLIB and _pwd_context is not None:
        try:
            return _pwd_context.hash(password)
        except Exception:
            pass  # Fall back to pbkdf2
    # Standard library fallback (cryptographically secure PBKDF2-HMAC-SHA256)
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash (supports both bcrypt and pbkdf2)."""
    if hashed_password.startswith("pbkdf2:sha256:"):
        try:
            parts = hashed_password.split("$")
            salt = parts[1]
            stored_key = parts[2]
            computed_key = hashlib.pbkdf2_hmac(
                "sha256",
                plain_password.encode("utf-8"),
                salt.encode("utf-8"),
                100000,
            ).hex()
            return hmac.compare_digest(stored_key, computed_key)
        except Exception:
            return False
    if _HAS_PASSLIB and _pwd_context is not None:
        try:
            return _pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False
    return False

# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------
try:
    from jose import JWTError, jwt
    _HAS_JOSE = True
except ImportError:
    import json
    import base64
    _HAS_JOSE = False
    JWTError = Exception

def create_access_token(subject: str, role: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed access token with sub, role, and exp claims."""
    expires_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=_settings.access_token_expire_minutes)
    )
    payload = {
        "sub": str(subject),
        "role": str(role),
        "exp": int(expires_at.timestamp()),
    }
    if _HAS_JOSE:
        return jwt.encode(payload, _settings.secret_key, algorithm=_settings.algorithm)
    # Lightweight fallback JWT encoder using stdlib HMAC-SHA256
    import json, base64
    def _b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")
    header = {"alg": "HS256", "typ": "JWT"}
    h_bytes = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_bytes = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_bytes}.{p_bytes}".encode("utf-8")
    sig = hmac.new(_settings.secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h_bytes}.{p_bytes}.{_b64url(sig)}"

def decode_access_token(token: str) -> dict:
    """Decode and verify a signed access token. Raises ValueError on failure."""
    if _HAS_JOSE:
        try:
            return jwt.decode(token, _settings.secret_key, algorithms=[_settings.algorithm])
        except JWTError as exc:
            raise ValueError("Invalid or expired authentication token") from exc
    # Lightweight fallback JWT decoder
    try:
        import json, base64
        def _b64decode(s: str) -> bytes:
            padding = "=" * (4 - (len(s) % 4)) if len(s) % 4 != 0 else ""
            return base64.urlsafe_b64decode(s + padding)
        parts = token.strip().split(".")
        if len(parts) != 3:
            raise ValueError("Malformed token")
        h_part, p_part, s_part = parts
        signing_input = f"{h_part}.{p_part}".encode("utf-8")
        expected_sig = hmac.new(_settings.secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64decode(s_part)
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Token signature mismatch")
        payload = json.loads(_b64decode(p_part).decode("utf-8"))
        exp = payload.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            raise ValueError("Token has expired")
        return payload
    except Exception as exc:
        raise ValueError(f"Invalid or expired authentication token: {exc}") from exc
