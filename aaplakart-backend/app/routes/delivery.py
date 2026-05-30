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
    Uses Firestore as primary source.
    """
    from app.services.firestore_service import fs_get_orders, fs_get_shops

    active_statuses = {"pending", "confirmed", "preparing", "picked_up", "out-for-delivery"}

    # Try Firestore first
    fs_orders = await fs_get_orders()
    if fs_orders is not None:
        fs_shops = await fs_get_shops(active_only=True) or []
        order_list = []
        for o in fs_orders:
            if o.get("status") not in active_statuses:
                continue

            # Calculate distance from given location if provided
            o_lat = o.get("address_latitude")
            o_lon = o.get("address_longitude")
            if lat is not None and lon is not None and o_lat and o_lon:
                dist = _haversine_km(lat, lon, float(o_lat), float(o_lon))
                if dist > radius_km:
                    continue
                o["distance_from_me"] = round(dist, 2)

            # Find nearest shop
            nearest_shop = None
            nearest_dist = float("inf")
            for shop in fs_shops:
                s_lat = shop.get("latitude")
                s_lon = shop.get("longitude")
                if o_lat and o_lon and s_lat and s_lon:
                    dist = _haversine_km(float(s_lat), float(s_lon), float(o_lat), float(o_lon))
                    radius = float(shop.get("delivery_radius_km", 6))
                    if dist <= radius and dist < nearest_dist:
                        nearest_shop = shop
                        nearest_dist = dist

            if nearest_shop:
                o["nearest_shop"] = {
                    "id": nearest_shop.get("id"),
                    "name": nearest_shop.get("name"),
                    "latitude": nearest_shop.get("latitude"),
                    "longitude": nearest_shop.get("longitude"),
                    "distance_km": round(nearest_dist, 2),
                }
                o["distanceFromShop"] = round(nearest_dist, 2)

            order_list.append(o)

        return {"success": True, "orders": order_list, "count": len(order_list)}

    # Fallback to DB
    from sqlalchemy.orm import selectinload

    active_statuses_list = list(active_statuses)
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.status.in_(active_statuses_list))
        .order_by(Order.placed_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    orders = result.scalars().all()

    shop_result = await db.execute(select(Shop).where(Shop.is_active == 1))
    shops = shop_result.scalars().all()

    order_list = []
    for order in orders:
        order_data = _order_to_dict(order)
        if lat is not None and lon is not None and order.address_latitude and order.address_longitude:
            dist = _haversine_km(lat, lon, order.address_latitude, order.address_longitude)
            if dist > radius_km:
                continue
            order_data["distance_from_me"] = round(dist, 2)

        nearest_shop = None
        nearest_dist = float("inf")
        for shop in shops:
            if order.address_latitude and order.address_longitude:
                dist = _haversine_km(shop.latitude, shop.longitude, order.address_latitude, order.address_longitude)
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
    from app.services.firestore_service import fs_update_order_status, fs_get_order

    new_status = body.get("status")
    valid_for_delivery = ["confirmed", "preparing", "picked_up", "out-for-delivery", "delivered"]

    if not new_status or new_status not in valid_for_delivery:
        raise HTTPException(status_code=400, detail=f"Delivery can set: {valid_for_delivery}")

    # Write to Firestore first
    fs_ok = await fs_update_order_status(order_id, new_status)
    if not fs_ok:
        # Fallback to SQL
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        order.status = new_status
        order.updated_at = datetime.now(timezone.utc)
        await db.commit()
    else:
        # Dual-write to SQLite
        try:
            result = await db.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()
            if order:
                order.status = new_status
                order.updated_at = datetime.now(timezone.utc)
                await db.commit()
        except Exception:
            pass

    # Broadcast to WebSocket clients
    order_update_data = {
        "id": order_id,
        "status": new_status,
        "updated_by": "delivery",
    }
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_order_update(order_update_data)
    except Exception:
        pass
    # Also notify the specific customer
    try:
        from app.services.user_websocket_manager import user_manager as usr_mgr
        from app.services.firestore_service import fs_get_order
        user_uid = None
        if order and hasattr(order, 'user_uid') and order.user_uid:
            user_uid = order.user_uid
        if not user_uid:
            fs_order = await fs_get_order(order_id)
            if fs_order:
                user_uid = fs_order.get("user_uid") or fs_order.get("uid")
        if user_uid:
            await usr_mgr.send_order_update_to_user(user_uid, order_update_data)
    except Exception:
        pass

    logger.info(f"Delivery partner updated order {order_id} → {new_status}")
    return {"success": True, "order_id": order_id, "status": new_status}


# ── Accept an order (delivery partner claims it) ──

class AcceptRejectResponse(BaseModel):
    success: bool
    order_id: str
    message: str


@router.post("/orders/{order_id}/accept", response_model=AcceptRejectResponse)
async def accept_order(
    order_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Delivery partner accepts an order. Marks it as confirmed and assigns the partner."""
    from app.services.firestore_service import fs_update_order_status, fs_get_order

    partner_uid = user.get("uid", "unknown")
    partner_name = user.get("name", partner_uid)

    # Update in Firestore first
    from app.services.firestore_service import fs_update_order
    update_data = {
        "status": "confirmed",
        "delivery_partner_uid": partner_uid,
        "delivery_partner_name": partner_name,
        "accepted_at": datetime.now(timezone.utc).isoformat(),
    }
    fs_ok = await fs_update_order_status(order_id, "confirmed")
    # Also write extra delivery partner metadata
    try:
        await fs_update_order(order_id, update_data)
    except Exception:
        pass

    # Dual-write to SQLite
    if not fs_ok:
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.status not in ("pending",):
            raise HTTPException(status_code=409, detail=f"Order already {order.status}, cannot accept")
        order.status = "confirmed"
        order.updated_at = datetime.now(timezone.utc)
        await db.commit()
    else:
        try:
            result = await db.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()
            if order:
                order.status = "confirmed"
                order.updated_at = datetime.now(timezone.utc)
                await db.commit()
        except Exception:
            pass

    # Broadcast via WebSocket
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_order_update({
            "id": order_id, "status": "confirmed",
            "type": "order_accepted",
            "delivery_partner_uid": partner_uid,
        })
    except Exception:
        pass

    logger.info(f"Delivery partner {partner_uid} accepted order {order_id}")
    return {"success": True, "order_id": order_id, "message": "Order accepted"}


@router.post("/orders/{order_id}/reject", response_model=AcceptRejectResponse)
async def reject_order(
    order_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Delivery partner rejects an order. Records rejection so it won't be shown again."""
    from app.services.firestore_service import fs_get_order, fs_update_order

    partner_uid = user.get("uid", "unknown")

    # Store rejection in Firestore (add to rejected_by list)
    try:
        fs_order = await fs_get_order(order_id)
        if fs_order:
            rejected_by = fs_order.get("rejected_by", [])
            if isinstance(rejected_by, list):
                rejected_by.append(partner_uid)
            else:
                rejected_by = [partner_uid]
            await fs_update_order(order_id, {"rejected_by": rejected_by})
    except Exception:
        pass

    logger.info(f"Delivery partner {partner_uid} rejected order {order_id}")
    return {"success": True, "order_id": order_id, "message": "Order rejected"}
