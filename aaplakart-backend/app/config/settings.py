"""Application settings loaded from environment variables.

Uses plain ``python-dotenv`` + a simple dataclass instead of
pydantic-settings to avoid the Rust build requirement for pydantic-core
on newer Python versions.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


@dataclass
class Settings:
    # ── Firebase Admin SDK (service account credentials) ──────────────
    firebase_project_id: str = field(default_factory=lambda: _env("FIREBASE_PROJECT_ID"))
    firebase_private_key_id: str = field(
        default_factory=lambda: _env("FIREBASE_PRIVATE_KEY_ID")
    )
    firebase_private_key: str = field(
        default_factory=lambda: _env("FIREBASE_PRIVATE_KEY")
    )
    firebase_client_email: str = field(
        default_factory=lambda: _env("FIREBASE_CLIENT_EMAIL")
    )
    firebase_client_id: str = field(default_factory=lambda: _env("FIREBASE_CLIENT_ID"))
    firebase_auth_uri: str = field(
        default_factory=lambda: _env(
            "FIREBASE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"
        )
    )
    firebase_token_uri: str = field(
        default_factory=lambda: _env(
            "FIREBASE_TOKEN_URI", "https://oauth2.googleapis.com/token"
        )
    )
    firebase_auth_provider_x509_cert_url: str = field(
        default_factory=lambda: _env(
            "FIREBASE_AUTH_PROVIDER_X509_CERT_URL",
            "https://www.googleapis.com/oauth2/v1/certs",
        )
    )
    firebase_client_x509_cert_url: str = field(
        default_factory=lambda: _env("FIREBASE_CLIENT_X509_CERT_URL")
    )

    # ── Firebase Web API Key (for REST API calls) ────────────────────
    firebase_api_key: str = field(default_factory=lambda: _env("FIREBASE_API_KEY"))

    # ── Test Credentials ─────────────────────────────────────────────
    test_phone_number: str = field(
        default_factory=lambda: _env("TEST_PHONE_NUMBER", "+10000000000")
    )
    test_custom_token: str = field(
        default_factory=lambda: _env("TEST_CUSTOM_TOKEN")
    )

    # ── Razorpay ──────────────────────────────────────────────────────
    razorpay_key_id: str = field(
        default_factory=lambda: _env("RAZORPAY_KEY_ID", "rzp_test_SiiU69ukaSSf2r")
    )
    razorpay_key_secret: str = field(
        default_factory=lambda: _env("RAZORPAY_KEY_SECRET", "WpcT7Yo7Nz4dSwU3G001HVYM")
    )

    # ── Geocoding (Google Maps) ──────────────────────────────────────
    google_maps_api_key: str = field(
        default_factory=lambda: _env("GOOGLE_MAPS_API_KEY")
    )

    # ── Server ───────────────────────────────────────────────────────
    host: str = field(default_factory=lambda: _env("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(_env("PORT", "8000")))
    secret_key: str = field(
        default_factory=lambda: _env("SECRET_KEY", "change-me-to-a-random-secret-key")
    )


settings = Settings()
