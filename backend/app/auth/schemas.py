"""
Pydantic v2 schemas for Authentication, Registration, and Identity.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserLogin(BaseModel):
    """Payload for POST /auth/login."""
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserSignup(BaseModel):
    """Payload for POST /auth/signup."""
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    company_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    gstin: str | None = Field(default=None, max_length=15)
    billing_address: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(BaseModel):
    """User profile data returned in auth responses."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    role: str
    company_name: str | None = None
    phone: str | None = None
    gstin: str | None = None
    billing_address: str | None = None
    is_active: bool = True
    created_at: datetime


class TokenResponse(BaseModel):
    """Standard Bearer token response with embedded user details."""
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    """Payload for POST /auth/forgot."""
    email: str = Field(min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class ResetPasswordRequest(BaseModel):
    """Payload for POST /auth/reset."""
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=128)
    password: str | None = None  # Frontend alias


class UserProfileUpdate(BaseModel):
    """Payload for updating user profile."""
    name: str | None = Field(default=None, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    gstin: str | None = Field(default=None, max_length=15)
    billing_address: str | None = None


class MessageResponse(BaseModel):
    message: str

