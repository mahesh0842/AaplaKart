"""Public shop endpoints — no auth required. Used by delivery app to get shop location."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import Shop

router = APIRouter(prefix="/shops", tags=["Shops (Public)"])


@router.get("/active")
async def get_active_shop(db: AsyncSession = Depends(get_session)):
    """Return the first active shop (for delivery app). No auth required."""
    result = await db.execute(select(Shop).where(Shop.is_active == 1).limit(1))
    shop = result.scalar_one_or_none()

    if shop is None:
        return {"success": False, "shop": None, "message": "No active shop found"}

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
