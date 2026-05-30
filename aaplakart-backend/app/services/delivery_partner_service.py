"""
Delivery Partners Service — manages delivery partners data in JSON.
Similar to orders/products system. Partners can login, go online/offline,
track earnings, and get assigned orders.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from loguru import logger

from app.services.cache_service import load_json_data, save_json_data

DATA_NAME = "delivery_partners"

PARTNERS_FILE = Path(__file__).resolve().parent.parent / "data" / "delivery_partners.json"


def _load() -> list[dict]:
    return load_json_data(DATA_NAME)


def _save(partners: list[dict]):
    save_json_data(DATA_NAME, partners)


def _now():
    return datetime.now(timezone.utc).isoformat()


def get_partner_by_phone(phone: str) -> Optional[dict]:
    """Find partner by phone number."""
    for p in _load():
        if p.get("phone") == phone:
            return p
    return None


def get_partner_by_uid(uid: str) -> Optional[dict]:
    for p in _load():
        if p.get("uid") == uid:
            return p
    return None


def get_all_partners(online_only: bool = False) -> list[dict]:
    partners = _load()
    if online_only:
        partners = [p for p in partners if p.get("status") == "online"]
    return partners


def register_or_login(phone: str, name: str = "", vehicle: str = "") -> dict:
    """Register new or login existing delivery partner."""
    partners = _load()
    existing = None
    for p in partners:
        if p.get("phone") == phone:
            existing = p
            break

    if existing:
        existing["status"] = "online"
        existing["lastLogin"] = _now()
        _save(partners)
        logger.info(f"Partner login: {phone}")
        return existing

    # New partner
    import uuid
    new_partner = {
        "uid": f"dp-{uuid.uuid4().hex[:10]}",
        "phone": phone,
        "name": name or f"Partner {phone[-4:]}",
        "vehicle": vehicle or "Bike",
        "status": "online",
        "totalDeliveries": 0,
        "totalEarnings": 0.0,
        "todayDeliveries": 0,
        "todayEarnings": 0.0,
        "rating": 5.0,
        "ratingCount": 0,
        "joinedAt": _now(),
        "lastLogin": _now(),
        "currentOrderId": None,
    }
    partners.append(new_partner)
    _save(partners)
    logger.info(f"New partner registered: {phone}")
    return new_partner


def update_partner(uid: str, updates: dict) -> Optional[dict]:
    partners = _load()
    for p in partners:
        if p["uid"] == uid:
            p.update(updates)
            p["updatedAt"] = _now()
            _save(partners)
            return p
    return None


def set_online_status(uid: str, online: bool) -> Optional[dict]:
    return update_partner(uid, {"status": "online" if online else "offline"})


def record_delivery(uid: str, order_total: float) -> Optional[dict]:
    """Record a completed delivery — updates earnings."""
    partners = _load()
    for p in partners:
        if p["uid"] == uid:
            p["totalDeliveries"] = p.get("totalDeliveries", 0) + 1
            p["totalEarnings"] = round(p.get("totalEarnings", 0) + order_total * 0.1, 2)
            p["todayDeliveries"] = p.get("todayDeliveries", 0) + 1
            p["todayEarnings"] = round(p.get("todayEarnings", 0) + order_total * 0.1, 2)
            p["currentOrderId"] = None
            p["updatedAt"] = _now()
            _save(partners)
            logger.info(f"Delivery recorded for {uid}: +₹{order_total * 0.1:.2f}")
            return p
    return None
