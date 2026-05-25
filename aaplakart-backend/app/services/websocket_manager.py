"""WebSocket connection manager for real-time order updates.

Replaces polling with instant push notifications.
Broadcasts order status changes to all connected clients
(admin panel, delivery app, main app).

Usage:
    manager = ConnectionManager()
    
    # In WebSocket endpoint:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except:
        manager.disconnect(websocket)
    
    # In status update routes:
    await manager.broadcast_order_update(order_data)
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket
from loguru import logger


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.debug(f"[WS] Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a disconnected client."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.debug(f"[WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a JSON message to ALL connected clients."""
        dead = []
        payload = json.dumps(message, default=str)
        for conn in self.active_connections:
            try:
                await conn.send_text(payload)
            except Exception:
                dead.append(conn)
        # Clean up dead connections
        for conn in dead:
            self.disconnect(conn)

    async def broadcast_order_update(self, order_data: dict):
        """Broadcast an order status change to all clients.

        Message format:
        {
            "type": "order_update",
            "order": { ... order data ... },
            "timestamp": "2026-05-25T12:00:00"
        }
        """
        from datetime import datetime, timezone
        await self.broadcast({
            "type": "order_update",
            "order": order_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def broadcast_new_order(self, order_data: dict):
        """Broadcast a new order created event."""
        from datetime import datetime, timezone
        await self.broadcast({
            "type": "new_order",
            "order": order_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    @property
    def client_count(self) -> int:
        return len(self.active_connections)


# ── Singleton instance ────────────────────────────────────────────
manager = ConnectionManager()
