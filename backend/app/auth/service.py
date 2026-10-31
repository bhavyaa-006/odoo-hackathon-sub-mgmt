"""
Authentication & User domain service.

Handles:
- User credential verification and authentication
- User registration and password hashing
- Password recovery (forgot / reset token workflow)
- Profile updates
- Automatic seeding of default demo accounts (admin, staff, customer)
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import PasswordResetToken, User, UserRole
from app.auth.schemas import UserProfileUpdate, UserSignup
from app.core.security import get_password_hash, verify_password


def get_user_by_email(db: Session, email: str) -> User | None:
    """Find a user by normalized email address."""
    clean_email = email.strip().lower()
    stmt = select(User).where(User.email == clean_email)
    return db.execute(stmt).scalar_one_or_none()


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    """Find a user by primary key UUID."""
    stmt = select(User).where(User.id == user_id)
    return db.execute(stmt).scalar_one_or_none()


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Verify credentials and return user if active, otherwise None."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(
    db: Session,
    payload: UserSignup,
    role: str = UserRole.CUSTOMER.value,
) -> User:
    """Register a new user account with hashed password."""
    clean_email = payload.email.strip().lower()
    existing = get_user_by_email(db, clean_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        id=uuid.uuid4(),
        email=clean_email,
        hashed_password=get_password_hash(payload.password),
        name=payload.name.strip(),
        role=role,
        company_name=payload.company_name.strip() if payload.company_name else None,
        phone=payload.phone.strip() if payload.phone else None,
        gstin=payload.gstin.strip().upper() if payload.gstin else None,
        billing_address=payload.billing_address.strip() if payload.billing_address else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(
    db: Session,
    user_id: uuid.UUID,
    payload: UserProfileUpdate,
) -> User:
    """Update profile attributes for an existing user."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.company_name is not None:
        user.company_name = payload.company_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.gstin is not None:
        user.gstin = payload.gstin.strip().upper()
    if payload.billing_address is not None:
        user.billing_address = payload.billing_address.strip()

    db.commit()
    db.refresh(user)
    return user


def create_password_reset_token(db: Session, email: str) -> str | None:
    """
    Generate a 1-hour password reset token for the given email.
    Returns token string if user exists, otherwise None (prevents user enumeration).
    """
    user = get_user_by_email(db, email)
    if not user or not user.is_active:
        return None

    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    record = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token=raw_token,
        expires_at=expires_at,
        used=False,
    )
    db.add(record)
    db.commit()
    return raw_token


def reset_password_with_token(
    db: Session,
    token: str,
    new_password: str,
) -> bool:
    """Validate reset token and set new password on user account."""
    clean_token = token.strip()
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.token == clean_token,
        PasswordResetToken.used.is_(False),
    )
    record = db.execute(stmt).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )

    now = datetime.now(timezone.utc)
    # Ensure timezone aware comparison
    token_exp = record.expires_at
    if token_exp.tzinfo is None:
        token_exp = token_exp.replace(tzinfo=timezone.utc)

    if now > token_exp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )

    user = get_user_by_id(db, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token not found.",
        )

    user.hashed_password = get_password_hash(new_password)
    record.used = True
    db.commit()
    return True


def seed_default_users(db: Session) -> None:
    """
    Ensure the standard default accounts exist in the database.
    Idempotent: skips accounts that already exist.
    """
    defaults = [
        {
            "email": "admin@brightloop.io",
            "name": "David Vance",
            "role": UserRole.ADMIN.value,
            "company_name": "Brightloop Admin",
            "password": "Password123!",
        },
        {
            "email": "staff@brightloop.io",
            "name": "Sarah Chen",
            "role": UserRole.STAFF.value,
            "company_name": "Brightloop Internal",
            "password": "Password123!",
        },
        {
            "email": "customer@brightloop.io",
            "name": "Alex Mercer",
            "role": UserRole.CUSTOMER.value,
            "company_name": "Mercer Media Private Limited",
            "password": "Password123!",
        },
    ]

    for item in defaults:
        existing = get_user_by_email(db, item["email"])
        if not existing:
            user = User(
                id=uuid.uuid4(),
                email=item["email"],
                hashed_password=get_password_hash(item["password"]),
                name=item["name"],
                role=item["role"],
                company_name=item["company_name"],
                is_active=True,
            )
            db.add(user)
    db.commit()
