"""Redis service — in-memory cache for payments, recent orders, and session data.

Provides a reusable async Redis client with:
- Payment amount storage (TTL-based auto-cleanup)
- Recent orders cache (FIFO, max 3 per user)
- Auto-connect/disconnect helpers
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import redis.asyncio as redis
from loguru import logger

# ── Connection ──────────────────────────────────────────────────────

_REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_client: Optional[redis.Redis] = None
_redis_failed = False  # Cache failure to avoid repeated timeouts


async def get_client() -> redis.Redis:
    """Get or create the shared Redis client (lazy connection)."""
    global _client, _redis_failed
    if _client is not None:
        return _client
    if _redis_failed:
        return None  # Don't retry if already failed
    try:
        _client = redis.from_url(_REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        await _client.ping()
        logger.info(f"[Redis] Connected → {_REDIS_URL}")
        _redis_failed = False
    except Exception as exc:
        logger.warning(f"[Redis] Connection failed ({exc}) — using fallback mode.")
        _client = None
        _redis_failed = True  # Cache failure to prevent repeated timeouts
    return _client


async def close_client() -> None:
    """Close the Redis connection (call on app shutdown)."""
    global _client
    if _client:
        await _client.aclose()
        _client = None
        logger.info("[Redis] Connection closed.")


# ── Generic helpers ─────────────────────────────────────────────────


async def _r() -> Optional[redis.Redis]:
    """Return client if available, else None (graceful fallback)."""
    try:
        return await get_client()
    except Exception:
        return None


async def set_json(key: str, value: Any, ttl: int | None = None) -> bool:
    """Store a value as JSON. Returns True if stored."""
    r = await _r()
    if r is None:
        return False
    try:
        await r.set(key, json.dumps(value), ex=ttl)
        return True
    except Exception as exc:
        logger.warning(f"[Redis] set_json({key}) failed: {exc}")
        return False


async def get_json(key: str) -> Any | None:
    """Retrieve a JSON value. Returns None if missing or error."""
    r = await _r()
    if r is None:
        return None
    try:
        data = await r.get(key)
        return json.loads(data) if data else None
    except Exception as exc:
        logger.warning(f"[Redis] get_json({key}) failed: {exc}")
        return None


async def delete_key(key: str) -> bool:
    """Delete a key. Returns True if deleted."""
    r = await _r()
    if r is None:
        return False
    try:
        await r.delete(key)
        return True
    except Exception:
        return False


async def list_push(key: str, value: Any, max_len: int = 3) -> bool:
    """Push to a list (left), trim to max_len (right). FIFO behaviour."""
    r = await _r()
    if r is None:
        return False
    try:
        pipe = r.pipeline()
        pipe.lpush(key, json.dumps(value))
        pipe.ltrim(key, 0, max_len - 1)
        await pipe.execute()
        return True
    except Exception as exc:
        logger.warning(f"[Redis] list_push({key}) failed: {exc}")
        return False


async def list_range(key: str, start: int = 0, end: int = -1) -> list:
    """Get range of items from a list."""
    r = await _r()
    if r is None:
        return []
    try:
        items = await r.lrange(key, start, end)
        return [json.loads(i) for i in items]
    except Exception as exc:
        logger.warning(f"[Redis] list_range({key}) failed: {exc}")
        return []


# ── Payment amount ──────────────────────────────────────────────────

PAYMENT_TTL = 1800  # 30 minutes

ORDER_AMOUNT_PREFIX = "payment:amount:"       # → { "expected_amount": int }


async def store_payment_amount(order_id: str, amount_paise: int) -> bool:
    """Store expected payment amount in Redis with 30-min TTL."""
    return await set_json(
        f"{ORDER_AMOUNT_PREFIX}{order_id}",
        {"expected_amount": amount_paise},
        ttl=PAYMENT_TTL,
    )


async def get_payment_amount(order_id: str) -> Optional[int]:
    """Get expected payment amount from Redis."""
    data = await get_json(f"{ORDER_AMOUNT_PREFIX}{order_id}")
    return data.get("expected_amount") if data else None


async def delete_payment_amount(order_id: str) -> bool:
    """Remove a payment record (called after successful verification)."""
    return await delete_key(f"{ORDER_AMOUNT_PREFIX}{order_id}")


# ── Recent orders cache (FIFO, max 3 per user) ────────────────────

RECENT_ORDERS_PREFIX = "orders:recent:"       # → list of order dicts


async def cache_recent_order(user_uid: str, order_data: dict) -> bool:
    """Push a new order to user's recent list. Keeps latest 3."""
    return await list_push(
        f"{RECENT_ORDERS_PREFIX}{user_uid}",
        order_data,
        max_len=3,
    )


async def get_recent_orders(user_uid: str) -> list:
    """Get last 3 cached orders for a user (newest first)."""
    return await list_range(f"{RECENT_ORDERS_PREFIX}{user_uid}", 0, 2)


async def clear_user_orders(user_uid: str) -> bool:
    """Clear cached orders for a user (called on logout / refresh)."""
    return await delete_key(f"{RECENT_ORDERS_PREFIX}{user_uid}")
