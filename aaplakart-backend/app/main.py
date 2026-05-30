"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.config.firebase import init_firebase
from app.db.database import init_db, close_db
from app.services.redis_service import get_client, close_client
from app.routes.auth import router as auth_router
from app.routes.orders import router as orders_router
from app.routes.addresses import router as addresses_router
from app.routes.products import router as products_router
from app.routes.categories import router as categories_router
from app.routes.payments import router as payments_router
from app.routes.admin import router as admin_router
from app.routes.shops import router as shops_router
from app.routes.shops_public import router as shops_public_router
from app.routes.delivery import router as delivery_router
from app.routes.config import router as config_router
from app.routes.admin_catalog import router as admin_catalog_router
from app.services.websocket_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting AaplaKart Backend ...")
    await init_db()
    init_firebase()
    await get_client()  # warm Redis connection
    yield
    await close_db()
    await close_client()
    logger.info("Shutting down ...")


app = FastAPI(
    title="AaplaKart Backend",
    description=(
        "Decoupled backend for AaplaKart / The Waffle Guy. "
        "Handles Firebase phone-auth, user management, "
        "orders, and address book with Cloud SQL."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS — allow the frontend (Expo / React Native) ──────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files — serve uploaded product images ─────────────────
import os
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "images").mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── Routes ─────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(addresses_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(shops_router, prefix="/api")
app.include_router(shops_public_router, prefix="/api")
app.include_router(delivery_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(admin_catalog_router, prefix="/api")

# ── WebSocket endpoints for real-time order updates ─────────────
from fastapi import WebSocket, WebSocketDisconnect


@app.websocket("/ws/orders")
async def websocket_orders(websocket: WebSocket):
    """Global WebSocket — broadcasts ALL order updates.
    Used by admin panel & delivery app."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@app.websocket("/ws/orders/{user_uid}")
async def websocket_user_orders(websocket: WebSocket, user_uid: str):
    """User-specific WebSocket — only sends updates for this user's orders.
    Used by the customer app so each customer only gets relevant updates."""
    from app.services.user_websocket_manager import user_manager as usr_mgr

    await usr_mgr.connect(websocket, user_uid)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        usr_mgr.disconnect(websocket)
    except Exception:
        usr_mgr.disconnect(websocket)


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "aaplakart-backend"}
