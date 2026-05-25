"""Delivery partner routes — list nearby orders, update status, find nearest shop."""

from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, pi, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import Order, OrderItem, Shop
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/delivery", tags=["Delivery"])


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = (lat2 - lat1) * pi / 180
    dlon = (lon2 - lon1) * pi / 180
    a = sin(dlat / 2) ** 2 + cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c


def _order_to_dict(order: Order) -> dict:
    items = []
    for item in (order.items or []):
        items.append({
            "product_id": item.product_id,
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
            "weight": item.weight,
            "image_path": item.image_path,
        })
    return {
        "id": order.id,
        "status": order.status,
        "subtotal": order.subtotal,
        "delivery_fee": order.delivery_fee,
        "total": order.total,
        "payment_method": order.payment_method,
        "delivery_slot": order.delivery_slot,
        "delivery_slot_label": order.delivery_slot_label,
        "address_full_name": order.address_full_name or "",
        "address_phone": order.address_phone or "",
        "address_line1": order.address_line1 or "",
        "address_line2": order.address_line2 or "",
        "address_landmark": order.address_landmark or "",
        "address_city": order.address_city or "",
        "address_pincode": order.address_pincode or "",
        "address_latitude": order.address_latitude,
        "address_longitude": order.address_longitude,
        "items": items,
        "placed_at": order.placed_at.isoformat() if order.placed_at else "",
        "estimated_delivery": order.estimated_delivery.isoformat() if order.estimated_delivery else None,
    }


# ── List active orders for delivery ──


@router.get("/orders")
async def list_delivery_orders(
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float = 10,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """List all active (non-delivered, non-cancelled) orders.
    Optionally filter by distance from a location (lat/lon).
    Optionally include nearest shop info for each order.
    """
    from sqlalchemy.orm import selectinload

    active_statuses = ["pending", "confirmed", "preparing", "picked_up", "out-for-delivery"]

    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.status.in_(active_statuses))
        .order_by(Order.placed_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    orders = result.scalars().all()

    # Fetch active shops for nearest-shop assignment
    shop_result = await db.execute(select(Shop).where(Shop.is_active == 1))
    shops = shop_result.scalars().all()

    order_list = []
    for order in orders:
        order_data = _order_to_dict(order)

        # Calculate distance from given location if provided
        if lat is not None and lon is not None and order.address_latitude and order.address_longitude:
            dist = _haversine_km(lat, lon, order.address_latitude, order.address_longitude)
            if dist > radius_km:
                continue  # skip orders outside delivery radius
            order_data["distance_from_me"] = round(dist, 2)

        # Find nearest shop
        nearest_shop = None
        nearest_dist = float("inf")
        for shop in shops:
            if order.address_latitude and order.address_longitude:
                dist = _haversine_km(
                    shop.latitude, shop.longitude,
                    order.address_latitude, order.address_longitude
                )
                if dist <= shop.delivery_radius_km and dist < nearest_dist:
                    nearest_shop = shop
                    nearest_dist = dist

        if nearest_shop:
            order_data["nearest_shop"] = {
                "id": nearest_shop.id,
                "name": nearest_shop.name,
                "latitude": nearest_shop.latitude,
                "longitude": nearest_shop.longitude,
                "distance_km": round(nearest_dist, 2),
            }
            order_data["distanceFromShop"] = round(nearest_dist, 2)

        order_list.append(order_data)

    return {"success": True, "orders": order_list, "count": len(order_list)}


# ── Update order status (delivery partner) ──


@router.patch("/orders/{order_id}/status")
async def update_delivery_status(
    order_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Update order status. Delivery partners can set all statuses except 'pending' and 'cancelled'."""
    new_status = body.get("status")
    # Delivery can set all statuses except pending (new orders) and cancelled (admin only)
    valid_for_delivery = ["confirmed", "preparing", "picked_up", "out-for-delivery", "delivered"]

    if not new_status or new_status not in valid_for_delivery:
        raise HTTPException(status_code=400, detail=f"Delivery can set: {valid_for_delivery}")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = new_status
    order.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Broadcast to WebSocket clients
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_order_update({
            "id": order_id,
            "status": new_status,
            "updated_by": "delivery",
            "user_uid": order.user_uid,
        })
    except Exception:
        pass

    logger.info(f"Delivery partner updated order {order_id} → {new_status}")
    return {"success": True, "order_id": order_id, "status": new_status}
