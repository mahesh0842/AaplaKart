"""Firestore data access layer — primary data source for all routes.

Every function tries Firestore first and falls back to SQLAlchemy/JSON
for backward compatibility during migration.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.config.firebase import get_firestore_client


# ── Helpers ────────────────────────────────────────────────────────


def _fs() -> Any:
    """Get Firestore client or None."""
    return get_firestore_client()


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════ ORDERS ═══════════════════════════════


async def fs_get_orders(status_filter: str | None = None, limit: int = 200) -> list[dict] | None:
    """Get orders from Firestore. Returns None if Firestore unavailable."""
    try:
        db = _fs()
        if db is None:
            return None
        q = db.collection("orders").order_by("placed_at", direction="DESCENDING").limit(limit)
        if status_filter:
            q = q.where("status", "==", status_filter)
        docs = q.stream()
        return [_doc_to_dict(d) for d in docs]
    except Exception as e:
        err = str(e)
        if '429' in err:
            logger.debug(f"[Firestore] get_orders rate-limited (429)")
        else:
            logger.warning(f"[Firestore] get_orders failed: {e}")
        return None


def _doc_to_dict(doc) -> dict:
    """Convert a Firestore document to a dict with id."""
    data = doc.to_dict() or {}
    data["id"] = data.get("id") or doc.id
    return data


async def fs_get_order(order_id: str) -> dict | None:
    """Get a single order from Firestore."""
    try:
        db = _fs()
        if db is None:
            return None
        doc = db.collection("orders").document(order_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)
    except Exception as e:
        err = str(e)
        if '429' in err:
            logger.debug(f"[Firestore] get_order({order_id}) rate-limited (429)")
        else:
            logger.warning(f"[Firestore] get_order({order_id}) failed: {e}")
        return None


async def fs_update_order_status(order_id: str, status: str) -> bool:
    """Update order status in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        db.collection("orders").document(order_id).update({
            "status": status,
            "updated_at": _ts(),
        })
        return True
    except Exception as e:
        err = str(e)
        if '429' in err:
            logger.debug(f"[Firestore] update_order_status({order_id}) rate-limited (429)")
        else:
            logger.warning(f"[Firestore] update_order_status({order_id}) failed: {e}")
        return False


async def fs_update_order(order_id: str, data: dict) -> bool:
    """Update order fields in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        data["updated_at"] = _ts()
        db.collection("orders").document(order_id).update(data)
        return True
    except Exception as e:
        logger.warning(f"[Firestore] update_order({order_id}) failed: {e}")
        return False


async def fs_create_order(order_id: str, data: dict) -> bool:
    """Create an order in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        data["placed_at"] = data.get("placed_at", _ts())
        data["updated_at"] = _ts()
        db.collection("orders").document(order_id).set(data)
        return True
    except Exception as e:
        logger.warning(f"[Firestore] create_order({order_id}) failed: {e}")
        return False


# ═══════════════════════════ USERS ═══════════════════════════════


async def fs_get_user(uid: str) -> dict | None:
    """Get a user from Firestore."""
    try:
        db = _fs()
        if db is None:
            return None
        doc = db.collection("users").document(uid).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)
    except Exception as e:
        logger.warning(f"[Firestore] get_user({uid}) failed: {e}")
        return None


async def fs_get_all_users(limit: int = 500) -> list[dict] | None:
    """Get all users from Firestore."""
    try:
        db = _fs()
        if db is None:
            return None
        docs = db.collection("users").order_by("created_at", direction="DESCENDING").limit(limit).stream()
        return [_doc_to_dict(d) for d in docs]
    except Exception as e:
        logger.warning(f"[Firestore] get_all_users failed: {e}")
        return None


async def fs_create_user(uid: str, data: dict) -> bool:
    """Create or update a user in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        data["created_at"] = data.get("created_at", _ts())
        data["updated_at"] = _ts()
        db.collection("users").document(uid).set(data, merge=True)
        return True
    except Exception as e:
        logger.warning(f"[Firestore] create_user({uid}) failed: {e}")
        return False


# ═══════════════════════════ ADDRESSES ═══════════════════════════


async def fs_get_addresses(user_uid: str) -> list[dict] | None:
    """Get addresses for a user from Firestore."""
    try:
        db = _fs()
        if db is None:
            return None
        docs = (
            db.collection("addresses")
            .where("user_uid", "==", user_uid)
            .order_by("created_at", direction="DESCENDING")
            .limit(20)
            .stream()
        )
        return [_doc_to_dict(d) for d in docs]
    except Exception as e:
        logger.warning(f"[Firestore] get_addresses({user_uid}) failed: {e}")
        return None


async def fs_create_address(address_id: str, data: dict) -> bool:
    """Create an address in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        data["created_at"] = _ts()
        data["updated_at"] = _ts()
        db.collection("addresses").document(address_id).set(data)
        return True
    except Exception as e:
        logger.warning(f"[Firestore] create_address failed: {e}")
        return False


async def fs_delete_address(address_id: str) -> bool:
    """Delete an address from Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        db.collection("addresses").document(address_id).delete()
        return True
    except Exception as e:
        logger.warning(f"[Firestore] delete_address({address_id}) failed: {e}")
        return False


# ═══════════════════════════ SHOPS ═══════════════════════════════


async def fs_get_shops(active_only: bool = False) -> list[dict] | None:
    """Get shops from Firestore."""
    try:
        db = _fs()
        if db is None:
            return None
        q = db.collection("shops").order_by("name")
        if active_only:
            q = q.where("is_active", "==", True)
        docs = q.stream()
        return [_doc_to_dict(d) for d in docs]
    except Exception as e:
        logger.warning(f"[Firestore] get_shops failed: {e}")
        return None


async def fs_get_shop(shop_id: str) -> dict | None:
    """Get a single shop from Firestore."""
    try:
        db = _fs()
        if db is None:
            return None
        doc = db.collection("shops").document(shop_id).get()
        if not doc.exists:
            return None
        return _doc_to_dict(doc)
    except Exception as e:
        logger.warning(f"[Firestore] get_shop({shop_id}) failed: {e}")
        return None


async def fs_create_shop(shop_id: str, data: dict) -> bool:
    """Create a shop in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        data["created_at"] = _ts()
        data["updated_at"] = _ts()
        db.collection("shops").document(shop_id).set(data)
        return True
    except Exception as e:
        logger.warning(f"[Firestore] create_shop failed: {e}")
        return False


async def fs_update_shop(shop_id: str, data: dict) -> bool:
    """Update a shop in Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        data["updated_at"] = _ts()
        db.collection("shops").document(shop_id).update(data)
        return True
    except Exception as e:
        logger.warning(f"[Firestore] update_shop({shop_id}) failed: {e}")
        return False


async def fs_delete_shop(shop_id: str) -> bool:
    """Delete a shop from Firestore."""
    try:
        db = _fs()
        if db is None:
            return False
        db.collection("shops").document(shop_id).delete()
        return True
    except Exception as e:
        logger.warning(f"[Firestore] delete_shop({shop_id}) failed: {e}")
        return False


# ═══════════════════════════ ORDERS STATS ════════════════════════


async def fs_get_all(collection: str, order_by_field: str | None = None, limit: int = 500) -> list[dict] | None:
    """Get all documents from a Firestore collection."""
    try:
        db = _fs()
        if db is None:
            return None
        q = db.collection(collection)
        if order_by_field:
            q = q.order_by(order_by_field)
        if limit:
            q = q.limit(limit)
        docs = q.stream()
        return [_doc_to_dict(d) for d in docs]
    except Exception as e:
        logger.warning(f"[Firestore] get_all({collection}) failed: {e}")
        return None


async def fs_get_order_stats() -> dict | None:
    """Compute order statistics from Firestore (limited to last 500 for cost control)."""
    try:
        db = _fs()
        if db is None:
            return None
        docs = db.collection("orders").order_by("placed_at", direction="DESCENDING").limit(500).stream()
        total = 0
        by_status = {}
        revenue = 0.0
        for d in docs:
            data = _doc_to_dict(d)
            total += 1
            s = data.get("status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
            if s in ("delivered", "confirmed", "preparing", "out-for-delivery"):
                revenue += float(data.get("total", 0))
        return {"total_orders": total, "orders_by_status": by_status, "total_revenue": revenue}
    except Exception as e:
        logger.warning(f"[Firestore] get_order_stats failed: {e}")
        return None
