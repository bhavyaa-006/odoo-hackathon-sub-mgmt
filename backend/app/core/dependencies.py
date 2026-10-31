"""Authentication dependencies. Roles are verified from signed JWT claims."""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=True)
VALID_ROLES = frozenset({"admin", "staff", "customer"})


@dataclass(frozen=True)
class Principal:
    subject: str
    role: str


def get_current_principal(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Principal:
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    subject, role = payload.get("sub"), payload.get("role")
    if not isinstance(subject, str) or role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    return Principal(subject=subject, role=role)


def require_admin(principal: Principal = Depends(get_current_principal)) -> Principal:
    if principal.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator permission is required")
    return principal
