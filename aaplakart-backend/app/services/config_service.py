"""Config service — manages app configuration, promos, delivery slots, payment methods.

All data is stored in JSON files for easy editing via admin panel.
"""

from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from loguru import logger

PROMOS_FILE = Path(__file__).resolve().parent.parent / "data" / "promos.json"


# ── Helpers ────────────────────────────────────────────────────────


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        logger.warning(f"File not found: {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: Path, data: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ── Promos ─────────────────────────────────────────────────────────


def get_promos(
    brand: Optional[str] = None,
    position: Optional[str] = None,
    active_only: bool = True,
) -> list[dict]:
    """Return promo banners, optionally filtered."""
    promos = _load_json(PROMOS_FILE)

    if active_only:
        promos = [p for p in promos if p.get("active", False)]

    if brand and brand != "all":
        promos = [p for p in promos if p.get("brand") == brand]

    if position:
        promos = [p for p in promos if p.get("position") == position]

    # Sort by sortOrder
    promos.sort(key=lambda p: p.get("sortOrder", 999))

    return promos


def get_promo_by_id(promo_id: str) -> Optional[dict]:
    """Get a single promo by ID."""
    promos = _load_json(PROMOS_FILE)
    for p in promos:
        if p.get("id") == promo_id:
            return p
    return None


def add_promo(data: dict) -> dict:
    """Create a new promo banner."""
    promos = _load_json(PROMOS_FILE)

    # Generate ID
    base_id = data.get("id", f"promo-{data.get('brand', 'general')}-{len(promos) + 1}")

    new_promo = {
        "id": base_id,
        "title": data.get("title", ""),
        "subtitle": data.get("subtitle", ""),
        "code": data.get("code", ""),
        "image": data.get("image", ""),
        "bgColor": data.get("bgColor", "#f97316"),
        "textColor": data.get("textColor", "#ffffff"),
        "brand": data.get("brand", "kart"),
        "active": data.get("active", True),
        "position": data.get("position", "home_banner"),
        "sortOrder": data.get("sortOrder", len(promos) + 1),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    promos.append(new_promo)
    _save_json(PROMOS_FILE, promos)
    logger.info(f"Promo created: {new_promo['id']} - {new_promo['title']}")
    return new_promo


def update_promo(promo_id: str, updates: dict) -> Optional[dict]:
    """Update an existing promo."""
    promos = _load_json(PROMOS_FILE)
    for i, p in enumerate(promos):
        if p.get("id") == promo_id:
            # Don't overwrite id or createdAt
            updates.pop("id", None)
            updates.pop("createdAt", None)
            promos[i] = {**p, **updates}
            _save_json(PROMOS_FILE, promos)
            logger.info(f"Promo updated: {promo_id}")
            return promos[i]
    return None


def delete_promo(promo_id: str) -> bool:
    """Delete a promo by ID."""
    promos = _load_json(PROMOS_FILE)
    original_len = len(promos)
    promos = [p for p in promos if p.get("id") != promo_id]
    if len(promos) < original_len:
        _save_json(PROMOS_FILE, promos)
        logger.info(f"Promo deleted: {promo_id}")
        return True
    return False


def toggle_promo(promo_id: str) -> Optional[dict]:
    """Toggle a promo's active status."""
    promos = _load_json(PROMOS_FILE)
    for i, p in enumerate(promos):
        if p.get("id") == promo_id:
            promos[i]["active"] = not p.get("active", True)
            _save_json(PROMOS_FILE, promos)
            logger.info(f"Promo toggled: {promo_id} -> active={promos[i]['active']}")
            return promos[i]
    return None


# ── App Config ─────────────────────────────────────────────────────


def get_app_config() -> dict:
    """Return global app configuration values."""
    return {
        "free_delivery_threshold": 199,
        "delivery_fee": 30,
        "promo_code": "FREEDEL",
        "razorpay_key_id": "rzp_test_SiiU69ukaSSf2r",
        "currency_symbol": "₹",
        "currency_code": "INR",
        "support_phone": "+91 9876543210",
        "support_email": "support@aaplakart.com",
        "app_version": "1.0.0",
        "min_app_version": "1.0.0",
        "force_update": False,
        "maintenance_mode": False,
        "maintenance_message": "",
    }


_CONFIG_FILE = Path(__file__).resolve().parent.parent / "data" / "config.json"


def _load_config_file() -> dict:
    """Load config from JSON file, or return defaults if missing."""
    if _CONFIG_FILE.exists():
        try:
            with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_config_file(data: dict) -> None:
    """Save config to JSON file."""
    _CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def update_app_config(updates: dict) -> dict:
    """Update app configuration and persist to JSON file."""
    defaults = get_app_config()
    saved = _load_config_file()
    merged = {**defaults, **saved, **updates}
    # Remove non-config keys
    merged = {k: v for k, v in merged.items() if k in defaults}
    _save_config_file(merged)
    logger.info(f"App config updated: {list(updates.keys())}")
    return {**defaults, **merged}


def get_delivery_slots() -> list[dict]:
    """Return available delivery time slots."""
    return [
        {"id": "asap", "label": "ASAP", "description": "Within 60 minutes", "icon": "flash-outline"},
        {"id": "morning", "label": "Morning", "description": "7:00 AM – 12:00 PM", "icon": "sunny-outline"},
        {"id": "afternoon", "label": "Afternoon", "description": "12:00 PM – 5:00 PM", "icon": "partly-sunny-outline"},
        {"id": "evening", "label": "Evening", "description": "5:00 PM – 9:00 PM", "icon": "moon-outline"},
    ]


def get_payment_methods() -> list[dict]:
    """Return available payment methods."""
    return [
        {
            "id": "cod",
            "label": "Cash on Delivery",
            "description": "Pay when your order arrives",
            "icon": "cash-outline",
            "iconFamily": "Ionicons",
        },
        {
            "id": "online",
            "label": "Online Payment",
            "description": "Pay securely via Razorpay — Cards, UPI, NetBanking",
            "icon": "shield-check-outline",
            "iconFamily": "MaterialCommunityIcons",
        },
        {
            "id": "upi",
            "label": "UPI",
            "description": "Google Pay, PhonePe, Paytm & more",
            "icon": "qrcode-scan",
            "iconFamily": "MaterialCommunityIcons",
        },
    ]


def get_order_statuses() -> dict:
    """Return order statuses with labels."""
    return {
        "pending": "Order Placed",
        "confirmed": "Confirmed",
        "preparing": "Preparing",
        "out-for-delivery": "Out for Delivery",
        "delivered": "Delivered",
        "cancelled": "Cancelled",
    }
