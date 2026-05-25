"""Service layer that wraps Firebase Auth & Firestore operations.

Routes should call these helpers — never raw Admin SDK calls directly —
so that we can add logging, error-handling, and mock/test logic in one place.
"""

from __future__ import annotations

from typing import Optional

import httpx
from loguru import logger

from app.config.firebase import (
    is_firebase_ready,
    verify_id_token as admin_verify_id_token,
    get_firestore_client,
)
from app.config.firebase import admin_auth
from app.config.settings import settings
from app.utils.constants import FIREBASE_AUTH_BASE


# ── Firebase REST API helpers (no Admin SDK needed) ────────────────


async def _rest_post(path: str, body: dict) -> dict:
    """POST to the Firebase Auth REST API."""
    url = f"{FIREBASE_AUTH_BASE}{path}?key={settings.firebase_api_key}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body)
    if resp.status_code != 200:
        err = resp.json().get("error", {}).get("message", "Unknown error")
        logger.warning("Firebase REST error [{}]: {}", resp.status_code, err)
        raise RuntimeError(err)
    return resp.json()


async def sign_in_with_custom_token(custom_token: str) -> dict:
    """Exchange a Firebase custom token for an ID token via REST API."""
    return await _rest_post(
        "/accounts:signInWithCustomToken",
        {"token": custom_token, "returnSecureToken": True},
    )


async def send_otp_via_rest(phone_number: str) -> dict:
    """Send an SMS OTP via Firebase Auth REST API.

    Returns ``{"sessionInfo": "..."}`` on success.
    The client must pass ``sessionInfo`` back when verifying the OTP.

    The ``iosBundleId`` is required for test-mode OTP via REST.
    """
    return await _rest_post(
        "/accounts:sendVerificationCode",
        {
            "phoneNumber": phone_number,
            "iosBundleId": "com.aaplakart.app",
        },
    )


async def verify_otp_via_rest(session_info: str, otp: str) -> dict:
    """Verify an OTP code via Firebase Auth REST API.

    Returns the full sign-in response containing ``idToken``,
    ``refreshToken``, ``localId`` (uid), ``phoneNumber``, etc.
    """
    return await _rest_post(
        "/accounts:signInWithPhoneNumber",
        {
            "sessionInfo": session_info,
            "code": otp,
            "operation": "SIGN_IN",
        },
    )


# ── Admin SDK helpers ──────────────────────────────────────────────


async def verify_id_token_rest(id_token: str) -> Optional[dict]:
    """Verify a Firebase ID token using the REST API (no Admin SDK needed)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{FIREBASE_AUTH_BASE}/accounts:lookup?key={settings.firebase_api_key}",
                json={"idToken": id_token},
            )
        if resp.status_code != 200:
            logger.warning("REST token verification failed: {}", resp.text)
            return None
        data = resp.json()
        users = data.get("users", [])
        if not users:
            return None
        user_info = users[0]
        return {
            "uid": user_info.get("localId", ""),
            "phone_number": user_info.get("phoneNumber", ""),
            "email": user_info.get("email", ""),
            "display_name": user_info.get("displayName", ""),
            "photo_url": user_info.get("photoUrl", ""),
            "auth_method": "firebase_rest",
        }
    except Exception as exc:
        logger.warning("REST token verification error: {}", exc)
        return None


def verify_id_token(id_token: str) -> Optional[dict]:
    """Verify a Firebase ID token using the Admin SDK.

    Returns decoded claims dict on success, or None if Admin SDK is
    not configured / token is invalid.
    """
    if not is_firebase_ready():
        logger.warning("Firebase Admin SDK not ready — cannot verify token.")
        return None
    try:
        return admin_verify_id_token(id_token)
    except Exception as exc:
        logger.warning("Token verification failed: {}", exc)
        return None


async def save_user_to_firestore(uid: str, data: dict) -> None:
    """Store (or update) a user document in Firestore."""
    db = get_firestore_client()
    if db is None:
        logger.warning("Firestore not available — user not persisted.")
        return
    try:
        db.collection("users").document(uid).set(data, merge=True)
    except Exception as exc:
        logger.error("Failed to save user to Firestore: {}", exc)


async def get_user_from_firestore(uid: str) -> Optional[dict]:
    """Retrieve a user document from Firestore."""
    db = get_firestore_client()
    if db is None:
        return None
    try:
        doc = db.collection("users").document(uid).get()
        return doc.to_dict() if doc.exists else None
    except Exception as exc:
        logger.error("Failed to read user from Firestore: {}", exc)
        return None


async def save_order_to_firestore(order_data: dict) -> None:
    """Save an order document to Firestore under `orders/{order_id}`."""
    db = get_firestore_client()
    if db is None:
        logger.warning("Firestore not available — order not persisted to Firebase.")
        return
    try:
        order_id = order_data.get("id", "")
        doc_data = {
            "id": order_id,
            "user_uid": order_data.get("user_uid", ""),
            "status": order_data.get("status", "pending"),
            "subtotal": float(order_data.get("subtotal", 0)),
            "delivery_fee": float(order_data.get("delivery_fee", 0)),
            "total": float(order_data.get("total", 0)),
            "payment_method": order_data.get("payment_method", "cod"),
            "delivery_slot": order_data.get("delivery_slot", "asap"),
            "delivery_slot_label": order_data.get("delivery_slot_label", "ASAP"),
            "address_full_name": order_data.get("address_full_name", ""),
            "address_phone": order_data.get("address_phone", ""),
            "address_line1": order_data.get("address_line1", ""),
            "address_city": order_data.get("address_city", ""),
            "address_pincode": order_data.get("address_pincode", ""),
            "items": order_data.get("items", []),
            "placed_at": order_data.get("placed_at", ""),
            "estimated_delivery": order_data.get("estimated_delivery", ""),
            "razorpay_payment_id": order_data.get("razorpay_payment_id", ""),
            "razorpay_order_id": order_data.get("razorpay_order_id", ""),
        }
        db.collection("orders").document(order_id).set(doc_data)
        logger.info(f"[Firestore] Order saved: {order_id}")
    except Exception as exc:
        logger.error(f"Failed to save order to Firestore: {exc}")


# ── Test-login helper ──────────────────────────────────────────────


async def test_login() -> dict:
    """Sign in with the pre-configured test custom token.

    Returns the same shape as ``sign_in_with_custom_token``.
    Falls back to generating a fresh custom token via Admin SDK if
    the env-var token is missing or expired.
    """
    # Try env-var custom token first
    if settings.test_custom_token:
        try:
            return await sign_in_with_custom_token(settings.test_custom_token)
        except RuntimeError:
            logger.warning("TEST_CUSTOM_TOKEN from .env is invalid/expired, generating fresh one...")

    # Generate a fresh custom token via Admin SDK
    if not is_firebase_ready():
        raise RuntimeError("Firebase Admin SDK not available — cannot create mock token.")

    try:
        # Use the test phone number's UID or create a deterministic mock UID
        mock_uid = f"mock-{settings.test_phone_number.replace('+', '')}"
        custom_token = admin_auth.create_custom_token(mock_uid)
        return await sign_in_with_custom_token(custom_token.decode() if isinstance(custom_token, bytes) else custom_token)
    except Exception as exc:
        logger.error(f"Failed to generate mock token: {exc}")
        raise RuntimeError(f"Mock login failed: {exc}")


async def mock_login(phone_number: str = "") -> dict:
    """Create a fresh custom token for a mock/test user.
    
    Tries Firebase Admin SDK first; falls back to a local mock token
    (no Firebase service account required)."""
    if is_firebase_ready():
        try:
            uid = f"mock-{phone_number.replace('+', '')}" if phone_number else f"mock-user-{__import__('uuid').uuid4().hex[:8]}"
            custom_token = admin_auth.create_custom_token(uid)
            token_str = custom_token.decode() if isinstance(custom_token, bytes) else custom_token
            return await sign_in_with_custom_token(token_str)
        except Exception as exc:
            logger.warning(f"Firebase mock login failed, using local fallback: {exc}")

    # Fallback: return a local mock token (no Firebase needed)
    import uuid
    mock_uid = f"mock-{phone_number.replace('+', '')}" if phone_number else f"mock-user-{uuid.uuid4().hex[:8]}"
    mock_token = f"mock-dev-{uuid.uuid4().hex[:16]}"
    logger.info(f"Mock login (local): uid={mock_uid}")
    return {
        "localId": mock_uid,
        "idToken": mock_token,
        "refreshToken": f"mock-refresh-{uuid.uuid4().hex[:16]}",
        "phoneNumber": phone_number or "+10000000000",
    }


# ── Google ID Token Verification ───────────────────────────────────


async def verify_google_id_token(id_token: str) -> dict | None:
    """Verify a Google-issued ID token against Google's tokeninfo endpoint.

    This does NOT require Firebase Admin SDK — it directly calls Google's
    public token verification endpoint. Returns the decoded claims on success
    (email, name, picture, sub, etc.), or None if the token is invalid.

    Works with tokens obtained from:
    - expo-auth-session PKCE flow
    - Any OAuth2 client that requests 'openid profile email' scopes
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
                timeout=10,
            )
        if resp.status_code != 200:
            logger.warning("Google token verification failed: status={}", resp.status_code)
            return None

        claims = resp.json()

        # Validate required fields
        if not claims.get("email"):
            logger.warning("Google token missing email claim")
            return None

        # Optional: verify audience matches our client ID
        # expected_aud = settings.google_client_id
        # if expected_aud and claims.get("aud") != expected_aud:
        #     logger.warning("Google token audience mismatch: {} != {}", claims.get("aud"), expected_aud)
        #     return None

        logger.info("Google token verified: email={}", claims.get("email"))
        return {
            "email": claims.get("email", ""),
            "name": claims.get("name", ""),
            "picture": claims.get("picture", ""),
            "sub": claims.get("sub", ""),  # Google's unique user ID
            "email_verified": claims.get("email_verified", "false") == "true",
        }
    except Exception as exc:
        logger.error("Google token verification error: {}", exc)
        return None
