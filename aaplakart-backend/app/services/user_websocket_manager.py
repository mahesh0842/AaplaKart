"""User-specific WebSocket connection manager.

Maps user_uid → WebSocket connections so customers only
receive updates for their own orders (not all orders).

Admin & delivery apps still use the global /ws/orders endpoint.
Customer app connects to /ws/orders/{user_uid}.

Usage:
    user_manager = UserConnectionManager()

    # In WebSocket endpoint:
    await user_manager.connect(websocket, user_uid)
    try:
        while True:
            await websocket.receive_text()
    except:
        user_manager.disconnect(websocket)

    # In status update routes:
    await user_manager.send_order_update_to_user(user_uid, order_data)
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket
from loguru import logger


class UserConnectionManager:
    """Manages per-user WebSocket connections."""

    def __init__(self):
        # user_uid -> list[WebSocket]
        self.user_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_uid: str):
        """Accept a new WebSocket connection for a specific user."""
        await websocket.accept()
        self.user_connections.setdefault(user_uid, []).append(websocket)
        logger.debug(
            f"[WS User] {user_uid} connected. "
            f"Total users: {len(self.user_connections)}, "
            f"Total conns: {self.total_connections}"
        )

    def disconnect(self, websocket: WebSocket):
        """Remove a disconnected client from their user group."""
        for user_uid, conns in list(self.user_connections.items()):
            if websocket in conns:
                conns.remove(websocket)
                if not conns:
                    del self.user_connections[user_uid]
                logger.debug(f"[WS User] {user_uid} disconnected")
                return

    async def _send(self, user_uid: str, message: dict):
        """Internal: send a JSON message to a user's connections."""
        conns = self.user_connections.get(user_uid)
        if not conns:
            return
        payload = json.dumps(message, default=str)
        dead: list[WebSocket] = []
        for conn in conns:
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        # Cleanup dead connections
        if dead:
            for conn in dead:
                conns.remove(conn)
            if not conns:
                del self.user_connections[user_uid]

    async def send_order_update_to_user(self, user_uid: str, order_data: dict[str, Any]):
        """Send order status update to a specific user."""
        from datetime import datetime, timezone

        await self._send(user_uid, {
            "type": "order_update",
            "order": order_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def send_new_order_to_user(self, user_uid: str, order_data: dict[str, Any]):
        """Send new-order notification to a specific user."""
        from datetime import datetime, timezone

        await self._send(user_uid, {
            "type": "new_order",
            "order": order_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self.user_connections.values())

    @property
    def total_users(self) -> int:
        return len(self.user_connections)


# ── Singleton instance ────────────────────────────────────────────
user_manager = UserConnectionManager()
