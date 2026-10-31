"""
FastAPI router for Authentication, Registration, and Password Recovery.

Endpoints:
- POST /auth/login   — Exchange email + password for Bearer JWT
- POST /auth/signup  — Register new customer account and return JWT
- GET  /auth/me      — Return profile for currently authenticated user
- POST /auth/forgot  — Request password reset token
- POST /auth/reset   — Consume token and update password
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import service as auth_svc
from app.auth.schemas import (
    ForgotPasswordRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserLogin,
    UserResponse,
    UserSignup,
)
from app.core.dependencies import CurrentUser, DbSession
from app.core.security import create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate with email & password",
    description="Validates credentials and returns a signed JWT access token.",
)
def login(
    payload: UserLogin,
    db: DbSession,
) -> TokenResponse:
    user = auth_svc.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account",
    description="Creates a new customer user and returns an initial access token.",
)
def signup(
    payload: UserSignup,
    db: DbSession,
) -> TokenResponse:
    user = auth_svc.create_user(db, payload, role="customer")
    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user identity",
    description="Returns user record extracted from Bearer JWT claims.",
)
def get_current_user_profile(
    current_user: CurrentUser,
    db: DbSession,
) -> UserResponse:
    user = auth_svc.get_user_by_id(db, current_user.id)
    if not user:
        # Fallback to stub attributes if user not yet persisted
        return UserResponse(
            id=current_user.id,
            email=getattr(current_user, "email", "user@brightloop.io"),
            name=getattr(current_user, "name", "Authenticated User"),
            role=current_user.role,
            company_name=getattr(current_user, "company_name", None),
            is_active=True,
            created_at=getattr(current_user, "created_at", None) or "2026-01-01T00:00:00Z",
        )
    return UserResponse.model_validate(user)


@router.post(
    "/forgot",
    response_model=MessageResponse,
    summary="Request password reset instructions",
    description="Issues a password reset token for the specified email.",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: DbSession,
) -> MessageResponse:
    token = auth_svc.create_password_reset_token(db, payload.email)
    if token:
        logger.info(f"Password reset token issued for {payload.email}: {token}")
    return MessageResponse(
        message="If an account exists with this email, you will receive password reset instructions."
    )


@router.post(
    "/reset",
    response_model=MessageResponse,
    summary="Reset password using token",
    description="Validates the recovery token and sets the new password.",
)
def reset_password(
    payload: ResetPasswordRequest,
    db: DbSession,
) -> MessageResponse:
    new_pw = payload.new_password or payload.password
    if not new_pw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password is required.",
        )
    auth_svc.reset_password_with_token(db, payload.token, new_pw)
    return MessageResponse(
        message="Your password has been successfully reset. You may now sign in with your new password."
    )

