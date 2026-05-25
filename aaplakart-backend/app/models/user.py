"""Pydantic models for user-related request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Request Schemas ────────────────────────────────────────────────


class SendOTPRequest(BaseModel):
    phone_number: str = Field(..., example="+10000000000")


class VerifyOTPRequest(BaseModel):
    phone_number: str = Field(..., example="+10000000000")
    otp: str = Field(..., example="123456")
    session_info: str = Field(
        ...,
        example="ABYPLDta0BwOabVMoH68jfb...",
        description="Session info returned from /send-otp",
    )


class TokenLoginRequest(BaseModel):
    """Exchange a Firebase custom token for an ID token (test flow)."""

    custom_token: str = Field(
        ...,
        example="AdrTqXG76uYk8ZSrM5518ZVoUTcIRYM3jnelLbCocrw3lSTUV6dOonMSC7-...",
    )


class VerifyFirebaseTokenRequest(BaseModel):
    """Verify a Firebase ID token obtained from the client SDK."""

    id_token: str = Field(..., example="eyJhbGciOiJSUzI1NiIs...")
    phone_number: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    """Sign in with a Google ID token obtained from expo-auth-session.

    The backend verifies this token against Google's tokeninfo endpoint,
    extracts the user's email & name, and creates/finds the user.
    No Firebase Auth configuration needed on the client side.
    """

    id_token: str = Field(..., example="eyJhbGciOiJSUzI1NiIs...", description="Google-issued ID token")
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None


# ── Response Schemas ───────────────────────────────────────────────


class AuthResponse(BaseModel):
    success: bool
    message: str
    uid: Optional[str] = None
    phone_number: Optional[str] = None
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    is_new_user: bool = False


class UserProfile(BaseModel):
    uid: str
    phone_number: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    created_at: Optional[datetime] = None
    is_test_user: bool = False


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
