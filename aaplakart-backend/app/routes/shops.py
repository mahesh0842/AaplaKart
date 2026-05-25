"""Shop / Delivery Hub management — CRUD + nearest-shop assignment."""

from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, pi, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import Shop, Order
from app.middleware.auth_middleware import require_admin

router = APIRouter(prefix="/admin/shops", tags=["Admin Shops"])


# ── Schemas ────────────────────────────────────────────────────────


class ShopCreate(BaseModel):
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    delivery_radius_km: float = 6.0
    phone: str | None = None


class ShopUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    delivery_radius_km: float | None = None
    phone: str | None = None
    is_active: int | None = None


# ── Haversine distance (km) ───────────────────────────────────────


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = (lat2 - lat1) * pi / 180
    dlon = (lon2 - lon1) * pi / 180
    a = sin(dlat / 2) ** 2 + cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c


# ── List all shops ─────────────────────────────────────────────────


@router.get("/")
async def list_shops(
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Shop).order_by(Shop.name))
    shops = result.scalars().all()
    return {
        "success": True,
        "shops": [
            {
                "id": s.id,
                "name": s.name,
                "address": s.address,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "delivery_radius_km": s.delivery_radius_km,
                "phone": s.phone,
                "is_active": bool(s.is_active),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in shops
        ],
    }


# ── Create shop ────────────────────────────────────────────────────


@router.post("/", status_code=201)
async def create_shop(
    body: ShopCreate,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    shop = Shop(
        name=body.name,
        address=body.address,
        latitude=body.latitude,
        longitude=body.longitude,
        delivery_radius_km=body.delivery_radius_km,
        phone=body.phone,
    )
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    logger.info(f"Shop created: {shop.name} ({shop.id})")
    return {
        "success": True,
        "shop": {
            "id": shop.id,
            "name": shop.name,
            "address": shop.address,
            "latitude": shop.latitude,
            "longitude": shop.longitude,
            "delivery_radius_km": shop.delivery_radius_km,
            "phone": shop.phone,
            "is_active": bool(shop.is_active),
        },
    }


# ── Update shop ────────────────────────────────────────────────────


@router.put("/{shop_id}")
async def update_shop(
    shop_id: str,
    body: ShopUpdate,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    if body.name is not None:
        shop.name = body.name
    if body.address is not None:
        shop.address = body.address
    if body.latitude is not None:
        shop.latitude = body.latitude
    if body.longitude is not None:
        shop.longitude = body.longitude
    if body.delivery_radius_km is not None:
        shop.delivery_radius_km = body.delivery_radius_km
    if body.phone is not None:
        shop.phone = body.phone
    if body.is_active is not None:
        shop.is_active = body.is_active

    shop.updated_at = datetime.now()
    await db.commit()
    await db.refresh(shop)
    logger.info(f"Shop updated: {shop.name}")
    return {
        "success": True,
        "shop": {
            "id": shop.id,
            "name": shop.name,
            "address": shop.address,
            "latitude": shop.latitude,
            "longitude": shop.longitude,
            "delivery_radius_km": shop.delivery_radius_km,
            "phone": shop.phone,
            "is_active": bool(shop.is_active),
        },
    }


# ── Delete shop ────────────────────────────────────────────────────


@router.delete("/{shop_id}")
async def delete_shop(
    shop_id: str,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    await db.delete(shop)
    await db.commit()
    logger.info(f"Shop deleted: {shop_id}")
    return {"success": True, "message": "Shop deleted"}


# ── Find nearest shop to a location ────────────────────────────────


@router.get("/nearest")
async def find_nearest_shop(
    lat: float,
    lon: float,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    """Find the nearest active shop to given coordinates within its radius."""
    result = await db.execute(select(Shop).where(Shop.is_active == 1))
    shops = result.scalars().all()

    if not shops:
        raise HTTPException(status_code=404, detail="No active shops found")

    nearest = None
    nearest_dist = float("inf")

    for shop in shops:
        dist = _haversine_km(lat, lon, shop.latitude, shop.longitude)
        if dist <= shop.delivery_radius_km and dist < nearest_dist:
            nearest = shop
            nearest_dist = dist

    if not nearest:
        raise HTTPException(
            status_code=404,
            detail=f"No shop within delivery radius. Closest shop is {nearest_dist:.1f} km away.",
        )

    return {
        "success": True,
        "shop": {
            "id": nearest.id,
            "name": nearest.name,
            "address": nearest.address,
            "latitude": nearest.latitude,
            "longitude": nearest.longitude,
            "delivery_radius_km": nearest.delivery_radius_km,
            "distance_km": round(nearest_dist, 2),
        },
    }
