"""
FastAPI dependency functions shared across all services.

Provides:
  - get_db / get_session — yields a SQLAlchemy Session per request
  - get_current_user     — authenticates via Bearer JWT token (with header fallback)
  - get_current_principal — Principal representation for product/catalog routes
  - Annotated type aliases: DbSession, CurrentUser, AdminUser, StaffOrAdminUser
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Generator

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
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
# Authentication & User Identity
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)
VALID_ROLES = frozenset({"admin", "staff", "customer"})


class _UserStub:
    """Authenticated user representation passed to endpoint handlers."""

    def __init__(
        self,
        user_id: str,
        role: str,
        email: str | None = None,
        name: str | None = None,
        company_name: str | None = None,
    ) -> None:
        try:
            self.id = uuid.UUID(user_id)
        except (ValueError, AttributeError):
            self.id = uuid.uuid4()
        self.role = role
        self.email = email or f"{role}@brightloop.io"
        self.name = name or role.capitalize()
        self.company_name = company_name
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
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
    x_user_role: Annotated[str | None, Header(alias="X-User-Role")] = None,
    db: Session = Depends(get_db),
) -> _UserStub:
    """
    Authenticate the caller using either:
    1. Standard JWT Bearer token (Authorization: Bearer <token>)
    2. Header stub (X-User-Id and X-User-Role) for testing
    """
    # 1. Bearer JWT Path
    if credentials is not None and credentials.credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            subject = payload.get("sub")
            role = payload.get("role")
            if not isinstance(subject, str) or role not in VALID_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token claims.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Attempt database user enrichment if user table exists
            email = None
            name = None
            company_name = None
            try:
                from app.auth.models import User
                db_user = db.query(User).filter(User.id == uuid.UUID(subject)).first()
                if db_user:
                    email = db_user.email
                    name = db_user.name
                    company_name = db_user.company_name
            except Exception:
                pass

            return _UserStub(
                user_id=subject,
                role=role,
                email=email,
                name=name,
                company_name=company_name,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exc),
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    # 2. Header-based stub path
    if x_user_id and x_user_role:
        if x_user_role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unknown role '{x_user_role}'. Must be admin, staff, or customer.",
            )
        return _UserStub(user_id=x_user_id, role=x_user_role)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a Bearer token or identification headers.",
        headers={"WWW-Authenticate": "Bearer"},
    )


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
# Principal helper (for product service compatibility)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Principal:
    subject: str
    role: str


def get_current_principal(user: _UserStub = Depends(get_current_user)) -> Principal:
    return Principal(subject=str(user.id), role=user.role)


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
