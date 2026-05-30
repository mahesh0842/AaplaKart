"""Firebase Admin SDK initialisation.

To use Firebase Admin features (verify ID tokens, manage users, Firestore, etc.),
you need to provide a service-account credentials via the environment variables
listed in .env.example.

If credentials are missing the app still starts, but Admin-dependent routes will
return 503 with a descriptive error.
"""

from __future__ import annotations

import json

import firebase_admin
from firebase_admin import auth as admin_auth, credentials, firestore
from loguru import logger

from app.config.settings import settings


def _build_service_account_dict() -> dict:
    """Build a service-account dict from individual env vars."""
    required = [
        settings.firebase_project_id,
        settings.firebase_private_key_id,
        settings.firebase_private_key,
        settings.firebase_client_email,
        settings.firebase_client_id,
    ]
    if not all(required):
        return {}

    # Pydantic preserves escaped newlines from .env; unescape them
    private_key = settings.firebase_private_key.replace("\\n", "\n")

    return {
        "type": "service_account",
        "project_id": settings.firebase_project_id,
        "private_key_id": settings.firebase_private_key_id,
        "private_key": private_key,
        "client_email": settings.firebase_client_email,
        "client_id": settings.firebase_client_id,
        "auth_uri": settings.firebase_auth_uri,
        "token_uri": settings.firebase_token_uri,
        "auth_provider_x509_cert_url": settings.firebase_auth_provider_x509_cert_url,
        "client_x509_cert_url": settings.firebase_client_x509_cert_url,
    }


# ── Lazy initialisation ───────────────────────────────────────────
_app = None
_firestore_client = None


def init_firebase() -> None:
    """Initialise the Firebase Admin app if credentials are available."""
    global _app, _firestore_client

    if _app is not None:
        return

    cred_dict = _build_service_account_dict()
    if not cred_dict:
        logger.warning(
            "Firebase Admin credentials not configured. "
            "Admin features will be unavailable. "
            "Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, "
            "FIREBASE_CLIENT_EMAIL, etc. in your .env file."
        )
        _app = None
        return

    try:
        import os
        os.environ["GOOGLE_CLOUD_PROJECT"] = settings.firebase_project_id
        cred = credentials.Certificate(cred_dict)
        _app = firebase_admin.initialize_app(cred)
        _firestore_client = firestore.client()
        logger.info("Firebase Admin SDK initialised.")
    except Exception as exc:
        logger.error("Failed to initialise Firebase Admin SDK: {}", exc)
        _app = None


def get_firebase_app():
    return _app


def get_firestore_client():
    return _firestore_client


def is_firebase_ready() -> bool:
    """Return True when the Admin SDK is ready to use."""
    return _app is not None


# ── Convenience helpers ────────────────────────────────────────────


def verify_id_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return its decoded claims.

    Raises ``firebase_admin.auth.InvalidIdTokenError`` or
    ``firebase_admin.auth.ExpiredIdTokenError`` on failure.
    """
    return admin_auth.verify_id_token(id_token, app=_app)


def get_user_by_phone(phone: str):
    """Lookup a Firebase user by phone number."""
    return admin_auth.get_user_by_phone_number(phone, app=_app)


def create_user(uid: str | None = None, phone: str = "", email: str = ""):
    """Create a new Firebase Authentication user."""
    kwargs = {}
    if uid:
        kwargs["uid"] = uid
    if phone:
        kwargs["phone_number"] = phone
    if email:
        kwargs["email"] = email
    return admin_auth.create_user(**kwargs, app=_app)
