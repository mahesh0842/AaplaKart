"""Authentication routes — phone OTP, token verification, test login, profile."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.db.database import get_session
from app.db.models import User
from app.middleware.auth_middleware import get_current_user
from app.models.user import (
    AuthResponse,
    ErrorResponse,
    GoogleAuthRequest,
    SendOTPRequest,
    UpdateUserRequest,
    UserProfile,
    VerifyFirebaseTokenRequest,
    VerifyOTPRequest,
)
from app.services.firebase_service import (
    mock_login,
    send_otp_via_rest,
    test_login,
    verify_google_id_token,
    verify_id_token,
    verify_otp_via_rest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Helpers ────────────────────────────────────────────────────────


async def _sync_user_to_firestore(uid: str, data: dict) -> None:
    """Sync user data to Firestore (best-effort)."""
    try:
        from app.services.firestore_service import fs_create_user
        await fs_create_user(uid, data)
    except Exception:
        pass  # Non-critical


async def _get_or_create_user(db: AsyncSession, uid: str, phone: str, **kwargs) -> tuple[User, bool]:
    """Return (user, is_new).
    
    First tries to find user by UID, then by phone (to avoid UNIQUE constraint).
    Also syncs to Firestore on create/update.
    """
    # Try by UID first
    result = await db.execute(select(User).where(User.uid == uid))
    user = result.scalar_one_or_none()

    # If not found by UID, try by phone (existing user logging in with new UID)
    if user is None and phone:
        result = await db.execute(select(User).where(User.phone_number == phone))
        user = result.scalar_one_or_none()

    if user is None:
        user = User(uid=uid, phone_number=phone, **kwargs)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        # Sync to Firestore
        await _sync_user_to_firestore(uid, {
            "uid": uid,
            "phone_number": phone,
            "display_name": kwargs.get("display_name", ""),
            "email": kwargs.get("email", ""),
            "photo_url": kwargs.get("photo_url", ""),
            "role": kwargs.get("role", "user"),
            "is_test_user": kwargs.get("is_test_user", 0),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return user, True

    # Update last_login / phone on every sign-in
    if phone and phone != user.phone_number:
        user.phone_number = phone
    user.updated_at = datetime.now(timezone.utc)

    # ── Only update display_name if it's a REAL name (not "AaplaKart User" default) ──
    # This preserves the user's actual name set via address/order/profile update
    incoming_display_name = kwargs.get("display_name", "").strip()
    is_default_name = (not incoming_display_name or incoming_display_name == "AaplaKart User")
    
    if not is_default_name and incoming_display_name:
        user.display_name = incoming_display_name
    
    for k, v in kwargs.items():
        if k == "display_name":
            continue  # handled above
        if v:
            setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    # Sync to Firestore
    await _sync_user_to_firestore(uid, {
        "uid": uid,
        "phone_number": user.phone_number,
        "display_name": user.display_name or "",
        "email": user.email or "",
        "photo_url": user.photo_url or "",
        "role": user.role or "user",
        "is_test_user": user.is_test_user or 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return user, False

async def _get_or_create_user_by_email(db: AsyncSession, email: str, name: str = "", photo_url: str = "") -> tuple[User, bool]:
    """Find user by email, or create a new one. Returns (user, is_new).
    Also syncs to Firestore."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        import hashlib
        uid = f"google-{hashlib.sha256(email.encode()).hexdigest()[:16]}"
        user = User(
            uid=uid,
            phone_number="",
            email=email,
            display_name=name or email.split("@")[0],
            photo_url=photo_url,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        # Sync to Firestore
        await _sync_user_to_firestore(uid, {
            "uid": uid,
            "phone_number": "",
            "email": email,
            "display_name": name or email.split("@")[0],
            "photo_url": photo_url,
            "role": "user",
            "is_test_user": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return user, True

    user.updated_at = datetime.now(timezone.utc)
    if name:
        user.display_name = name
    if photo_url:
        user.photo_url = photo_url
    await db.commit()
    # Sync to Firestore
    await _sync_user_to_firestore(user.uid, {
        "uid": user.uid,
        "phone_number": user.phone_number or "",
        "email": user.email or "",
        "display_name": user.display_name or "",
        "photo_url": user.photo_url or "",
        "role": user.role or "user",
        "is_test_user": user.is_test_user or 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.refresh(user)
    return user, False
    return user, False


# ── Test Login ─────────────────────────────────────────────────────


@router.post(
    "/test-login",
    summary="Sign in with the pre-configured test custom token",
    description=(
        "Uses the TEST_CUSTOM_TOKEN from .env to authenticate the test user "
        "(+1 000 000 0000). Useful for development without a real SIM card."
    ),
    responses={200: {"model": AuthResponse}, 500: {"model": ErrorResponse}},
)
async def test_login_endpoint(db: AsyncSession = Depends(get_session)):
    try:
        result = await test_login()
        uid = result.get("localId", "")
        phone = settings.test_phone_number

        user, _ = await _get_or_create_user(
            db, uid, phone, display_name="Test User", is_test_user=1
        )

        return AuthResponse(
            success=True,
            message="Test user signed in successfully.",
            uid=user.uid,
            phone_number=user.phone_number,
            id_token=result.get("idToken"),
            refresh_token=result.get("refreshToken"),
            is_new_user=False,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ── Mock Login (Dev/Testing) ──────────────────────────────────────


@router.post(
    "/mock-login",
    summary="Sign in with a dynamically generated mock account (dev only)",
    description=(
        "Generates a fresh Firebase custom token via Admin SDK and exchanges "
        "it for an ID token. No pre-configured TEST_CUSTOM_TOKEN needed. "
        "Use this when mock OTP mode is active in the frontend."
    ),
    responses={200: {"model": AuthResponse}, 500: {"model": ErrorResponse}},
)
async def mock_login_endpoint(db: AsyncSession = Depends(get_session)):
    try:
        result = await mock_login(settings.test_phone_number)
        uid = result.get("localId", "")
        phone = settings.test_phone_number

        user, _ = await _get_or_create_user(
            db, uid, phone, display_name="Mock User", is_test_user=1
        )

        return AuthResponse(
            success=True,
            message="Mock user signed in (dev mode).",
            uid=user.uid,
            phone_number=user.phone_number,
            id_token=result.get("idToken"),
            refresh_token=result.get("refreshToken"),
            is_new_user=False,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mock login failed: {exc}",
        )


# ── Admin Login (Dev/Testing) ──────────────────────────────────


@router.post(
    "/admin-login",
    summary="Admin login with username/password (dev only)",
    description=(
        "Authenticate as admin using hardcoded credentials. "
        "Returns a special admin_token that can be used as a Bearer token "
        "for admin endpoints. For development/testing only."
    ),
)
async def admin_login_endpoint(body: dict):
    username = body.get("username", "")
    password = body.get("password", "")
    
    # Default admin credentials (change in production!)
    if username == "admin" and password == "admin@123":
        import uuid
        admin_token = f"admin-dev-{uuid.uuid4().hex[:16]}"
        logger.info(f"Admin login success: {username}")
        return {
            "success": True,
            "message": "Admin logged in (dev mode).",
            "uid": f"admin-{username}",
            "id_token": admin_token,
            "role": "admin",
            "display_name": "Admin",
        }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin credentials",
    )


# ── Delivery Login (Dev/Testing) ──────────────────────────────


@router.post(
    "/delivery-login",
    summary="Delivery partner login with phone/OTP (dev only)",
    description=(
        "Authenticate delivery partner with phone and OTP. "
        "In dev mode, any OTP works (default mock: 123456). "
        "Returns a delivery_dev token for Bearer auth."
    ),
)
async def delivery_login_endpoint(body: dict):
    phone = body.get("phone_number", "")
    otp = body.get("otp", "")
    
    from app.services.delivery_partner_service import register_or_login
    partner = register_or_login(phone)
    
    import uuid
    delivery_token = f"delivery-dev-{uuid.uuid4().hex[:16]}"
    logger.info(f"Delivery login success: {phone} (uid={partner['uid']})")
    return {
        "success": True,
        "message": "Delivery partner logged in.",
        "token": delivery_token,
        "user": {
            "uid": partner["uid"],
            "phoneNumber": partner["phone"],
            "displayName": partner["name"],
            "vehicle": partner.get("vehicle", "Bike"),
            "status": partner.get("status", "online"),
            "totalDeliveries": partner.get("totalDeliveries", 0),
            "totalEarnings": partner.get("totalEarnings", 0),
            "role": "delivery",
        },
    }


# ── Simple Login (any phone/Gmail — dev/testing) ────────────────


@router.post(
    "/simple-login",
    summary="Login with any phone number (dev mode only)",
    description=(
        "Accepts ANY phone number and creates/finds the user. "
        "No SMS/OTP required. Returns a mock-dev- token that works "
        "with the Bearer auth middleware. For development/testing only."
    ),
)
async def simple_login(
    body: dict,
    db: AsyncSession = Depends(get_session),
):
    phone = body.get("phone_number", "")
    display_name = body.get("display_name", "").strip()
    email = body.get("email", "")
    
    import uuid
    uid = f"user{uuid.uuid4().hex[:12]}"
    existing_display_name = None  # track existing name
    
    # Check if user already exists with this phone or email
    if phone:
        # Normalize phone by removing + and non-digits
        phone_clean = "".join(c for c in phone if c.isdigit())
        result = await db.execute(select(User).where(User.phone_number == phone))
        existing = result.scalar_one_or_none()
        if existing:
            uid = existing.uid
            existing_display_name = existing.display_name  # save existing name
    elif email:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            uid = existing.uid
            existing_display_name = existing.display_name
    
    # ── Smart name resolution ──
    # Priority: existing saved name > incoming non-default name > default
    is_incoming_real = display_name and display_name != "AaplaKart User"
    final_display_name = (
        existing_display_name or  # keep existing name if available
        (display_name if is_incoming_real else None) or
        "AaplaKart User"
    )
    
    # Create or update user in DB (only pass real name, not default)
    user, _ = await _get_or_create_user(
        db, uid, phone,
        display_name=final_display_name,
        email=email or None
    )
    
    # Encode uid in token (uid should not contain hyphens for easy parsing)
    mock_token = f"mock-dev-{user.uid}-{uuid.uuid4().hex[:8]}"
    
    logger.info(f"Simple login: phone={phone}, uid={user.uid}, name={user.display_name}")
    
    return {
        "success": True,
        "message": "User authenticated (simple login).",
        "uid": user.uid,
        "phone_number": user.phone_number or "",
        "id_token": mock_token,
        "display_name": user.display_name or final_display_name,
        "is_new_user": False,
    }


# ── Rate limiter for OTP (in-memory) ──────────────────────────────

import time
from collections import defaultdict

_otp_rate_limit: dict[str, list[float]] = defaultdict(list)
OTP_MAX_REQUESTS = 3       # max OTP requests per window
OTP_WINDOW_SECONDS = 60    # sliding window in seconds


def _check_otp_rate_limit(key: str) -> bool:
    """Return True if request is allowed, False if rate limited."""
    now = time.time()
    window_start = now - OTP_WINDOW_SECONDS
    # Remove expired timestamps
    _otp_rate_limit[key] = [t for t in _otp_rate_limit[key] if t > window_start]
    if len(_otp_rate_limit[key]) >= OTP_MAX_REQUESTS:
        return False
    _otp_rate_limit[key].append(now)
    return True


# ── Send OTP ───────────────────────────────────────────────────────


@router.post(
    "/send-otp",
    summary="Send OTP to a phone number via Firebase",
    description=(
        "Calls Firebase Auth REST API to send an SMS. "
        "Returns a session_info token that the client must pass "
        "back when verifying the OTP. "
        f"Rate limit: {OTP_MAX_REQUESTS} requests per {OTP_WINDOW_SECONDS}s per phone number."
    ),
)
async def send_otp(body: SendOTPRequest, request: Request):
    # Rate limit by phone number
    phone = body.phone_number
    if not _check_otp_rate_limit(phone):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many OTP requests. Please wait {OTP_WINDOW_SECONDS} seconds before requesting again.",
        )

    # Also rate limit by client IP as secondary defense
    client_ip = request.client.host if request.client else "unknown"
    ip_key = f"ip:{client_ip}"
    if not _check_otp_rate_limit(ip_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many OTP requests from this IP. Please wait before trying again.",
        )

    try:
        result = await send_otp_via_rest(body.phone_number)
        return {
            "success": True,
            "message": "OTP sent.",
            "session_info": result.get("sessionInfo"),
        }
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send OTP: {exc}",
        )


# ── Verify OTP ─────────────────────────────────────────────────────


@router.post(
    "/verify-otp",
    summary="Verify the OTP code and sign in",
    description=(
        "Verifies the OTP code using the session_info returned "
        "from /send-otp. On success returns an id_token, uid, "
        "and creates/updates the user in the database."
    ),
    responses={200: {"model": AuthResponse}, 400: {"model": ErrorResponse}},
)
async def verify_otp(
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        result = await verify_otp_via_rest(body.session_info, body.otp)
    except RuntimeError as exc:
        err_msg = str(exc)
        if "INVALID_CODE" in err_msg or "SESSION_EXPIRED" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP. Please request a new one.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OTP verification failed: {exc}",
        )

    uid = result.get("localId", "")
    phone = result.get("phoneNumber", body.phone_number)

    # Create or update user in DB
    user, is_new = await _get_or_create_user(db, uid, phone)

    return AuthResponse(
        success=True,
        message="OTP verified. User authenticated.",
        uid=user.uid,
        phone_number=user.phone_number,
        id_token=result.get("idToken"),
        refresh_token=result.get("refreshToken"),
        is_new_user=is_new,
    )


# ── Verify Firebase ID Token ───────────────────────────────────────


@router.post(
    "/verify-token",
    summary="Verify a Firebase ID token obtained from the client SDK",
    description=(
        "Call this after the client completes phone-auth. "
        "The backend verifies the ID token via the Firebase Admin SDK, "
        "then creates/updates the user in Cloud SQL."
    ),
    responses={200: {"model": AuthResponse}, 401: {"model": ErrorResponse}},
)
async def verify_token(
    body: VerifyFirebaseTokenRequest,
    db: AsyncSession = Depends(get_session),
):
    claims = verify_id_token(body.id_token)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired.",
        )

    uid = claims.get("uid", "")
    phone = claims.get("phone_number") or body.phone_number or ""

    user, is_new = await _get_or_create_user(db, uid, phone)

    return AuthResponse(
        success=True,
        message="Token verified. User authenticated.",
        uid=user.uid,
        phone_number=user.phone_number,
        is_new_user=is_new,
    )


# ── Google Sign-In ─────────────────────────────────────────────────


@router.post(
    "/google",
    summary="Sign in with a Google ID token",
    description=(
        "Receives a Google-issued ID token from the client (obtained via "
        "expo-auth-session PKCE flow or any OAuth2 client). The backend "
        "verifies the token against Google's tokeninfo endpoint, extracts "
        "the user's email & name, and creates/finds the user in the database. "
        "No Firebase Auth or SHA-1 fingerprint required."
    ),
    responses={200: {"model": AuthResponse}, 401: {"model": ErrorResponse}},
)
async def google_sign_in(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_session),
):
    # 1. Verify the Google ID token
    claims = await verify_google_id_token(body.id_token)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google ID token.",
        )

    email = claims.get("email", "")
    name = body.display_name or claims.get("name", "")
    picture = body.photo_url or claims.get("picture", "")

    # 2. Find or create user by email
    user, is_new = await _get_or_create_user_by_email(db, email, name, picture)

    logger.info("Google sign-in: email={}, uid={}, is_new={}", email, user.uid, is_new)

    return AuthResponse(
        success=True,
        message="Google Sign-In successful.",
        uid=user.uid,
        phone_number=user.phone_number or "",
        is_new_user=is_new,
    )


# ── Get Profile (protected) ────────────────────────────────────────


@router.get(
    "/me",
    summary="Get the currently authenticated user's profile",
    responses={200: {"model": UserProfile}, 401: {"model": ErrorResponse}},
)
async def get_profile(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")
    result = await db.execute(select(User).where(User.uid == uid))
    db_user = result.scalar_one_or_none()

    if db_user is None:
        return UserProfile(
            uid=uid,
            phone_number=user.get("phone_number", ""),
        )

    return UserProfile(
        uid=db_user.uid,
        phone_number=db_user.phone_number,
        email=db_user.email,
        display_name=db_user.display_name,
        created_at=db_user.created_at,
        is_test_user=bool(db_user.is_test_user),
    )


# ── Update Profile (protected) ─────────────────────────────────────


@router.patch(
    "/me",
    summary="Update the current user's profile",
    responses={200: {"model": UserProfile}, 401: {"model": ErrorResponse}},
)
async def update_profile(
    body: UpdateUserRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")
    result = await db.execute(select(User).where(User.uid == uid))
    db_user = result.scalar_one_or_none()

    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    for k, v in update_data.items():
        if v is not None:
            setattr(db_user, k, v)
    db_user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(db_user)

    return UserProfile(
        uid=db_user.uid,
        phone_number=db_user.phone_number,
        email=db_user.email,
        display_name=db_user.display_name,
        created_at=db_user.created_at,
        is_test_user=bool(db_user.is_test_user),
    )
