"""
FastAPI dependency functions shared across all services.

Provides:
  - get_db / get_session — yields a SQLAlchemy Session per request
  - get_current_user     — stub reading user identity from X-User-Id / X-User-Role
                           headers (replaced when auth service is complete)
  - get_current_principal — JWT-based principal (for product service; wired to stub
                            until auth service is live)
  - Annotated type aliases: DbSession, CurrentUser, AdminUser, StaffOrAdminUser
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Generator

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import SessionLocal

# ---------------------------------------------------------------------------
# Database session
# ---------------------------------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """Yield a database session and ensure it is closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Alias used by product service
get_session = get_db

DbSession = Annotated[Session, Depends(get_db)]


# ---------------------------------------------------------------------------
# Auth stub (header-based)
# ---------------------------------------------------------------------------
# NOTE: Replace with real JWT dependency once the auth service is implemented.
# Callers pass role via X-User-Role header so all services can be developed
# and tested independently.

class _UserStub:
    """Minimal user representation used before the real auth service exists."""

    def __init__(self, user_id: str, role: str) -> None:
        try:
            self.id = uuid.UUID(user_id)
        except (ValueError, AttributeError):
            self.id = uuid.uuid4()
        self.role = role
        # Compatibility attribute used by product service
        self.subject = str(self.id)

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_staff(self) -> bool:
        return self.role in ("admin", "staff")

    @property
    def is_customer(self) -> bool:
        return self.role == "customer"


def get_current_user(
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
    x_user_role: Annotated[str | None, Header(alias="X-User-Role")] = None,
) -> _UserStub:
    """
    Auth stub: reads user identity from request headers.

    Expected headers:
      X-User-Id:   UUID of the acting user
      X-User-Role: one of admin | staff | customer

    Both headers are required. A real JWT implementation will replace this.
    """
    if not x_user_id or not x_user_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-Id and X-User-Role headers are required (auth stub).",
        )
    if x_user_role not in ("admin", "staff", "customer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unknown role '{x_user_role}'. Must be admin, staff, or customer.",
        )
    return _UserStub(user_id=x_user_id, role=x_user_role)


def _require_admin(user: _UserStub = Depends(get_current_user)) -> _UserStub:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


def _require_staff_or_admin(user: _UserStub = Depends(get_current_user)) -> _UserStub:
    if not user.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or admin access required.",
        )
    return user


# ---------------------------------------------------------------------------
# JWT-based principal (used by product service — wired to stub until auth live)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Principal:
    subject: str
    role: str


_bearer_scheme = HTTPBearer(auto_error=False)
VALID_ROLES = frozenset({"admin", "staff", "customer"})


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
    x_user_role: Annotated[str | None, Header(alias="X-User-Role")] = None,
) -> Principal:
    """
    Returns a Principal from either:
      1. Bearer JWT token (when auth service is live), or
      2. X-User-Id / X-User-Role headers (stub mode, current default).
    """
    if credentials is not None:
        # Real JWT path — decode when auth service is available
        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(credentials.credentials)
            subject = payload.get("sub")
            role = payload.get("role")
            if not isinstance(subject, str) or role not in VALID_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token.",
                )
            return Principal(subject=subject, role=role)
        except ImportError:
            pass  # auth service not yet implemented, fall through to stub

    # Header stub path
    if not x_user_id or not x_user_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    if x_user_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unknown role '{x_user_role}'.",
        )
    return Principal(subject=x_user_id, role=x_user_role)


def require_admin(principal: Principal = Depends(get_current_principal)) -> Principal:
    if principal.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator permission is required.",
        )
    return principal


# ---------------------------------------------------------------------------
# Annotated aliases used in router function signatures
# ---------------------------------------------------------------------------
CurrentUser = Annotated[_UserStub, Depends(get_current_user)]
AdminUser = Annotated[_UserStub, Depends(_require_admin)]
StaffOrAdminUser = Annotated[_UserStub, Depends(_require_staff_or_admin)]
