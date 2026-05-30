"""Order management routes — create, list, and retrieve orders."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import Address, Order, OrderItem, User
from app.middleware.auth_middleware import get_current_user
from app.config.firebase import get_firestore_client
from app.services.redis_service import cache_recent_order, get_recent_orders

router = APIRouter(prefix="/orders", tags=["Orders"])


# ── Synchronous Firestore helper (runs outside SQLAlchemy greenlet) ──


def _sync_firestore_sync(order_data: dict) -> None:
    """Sync order to Firestore. Must be called via run_in_executor
    to avoid SQLAlchemy greenlet conflicts."""
    try:
        db = get_firestore_client()
        if db is None:
            logger.warning("Firestore not available — order not synced.")
            return
        order_id = order_data.get("id", "")
        doc_data = {
            "id": order_id,
            "user_uid": order_data.get("user_uid", ""),
            "status": order_data.get("status", "pending"),
            "subtotal": float(order_data.get("subtotal", 0)),
            "delivery_fee": float(order_data.get("delivery_fee", 0)),
            "total": float(order_data.get("total", 0)),
            "payment_method": order_data.get("payment_method", "cod"),
            "delivery_slot": order_data.get("delivery_slot", "asap"),
            "delivery_slot_label": order_data.get("delivery_slot_label", "ASAP"),
            "address_full_name": order_data.get("address_full_name", ""),
            "address_phone": order_data.get("address_phone", ""),
            "address_line1": order_data.get("address_line1", ""),
            "address_city": order_data.get("address_city", ""),
            "address_pincode": order_data.get("address_pincode", ""),
            "items": order_data.get("items", []),
            "placed_at": order_data.get("placed_at", ""),
            "estimated_delivery": order_data.get("estimated_delivery", ""),
            "razorpay_payment_id": order_data.get("razorpay_payment_id", ""),
            "razorpay_order_id": order_data.get("razorpay_order_id", ""),
        }
        db.collection("orders").document(order_id).set(doc_data)
        logger.info(f"[Firestore] Order synced: {order_id}")
    except Exception as exc:
        logger.warning(f"[Firestore] Sync error: {exc}")


# ── Schemas ────────────────────────────────────────────────────────


class OrderItemSchema(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    weight: str | None = None
    image_path: str | None = None


class CreateOrderRequest(BaseModel):
    id: str | None = None  # Optional: client-generated ID for sync
    items: list[OrderItemSchema]
    subtotal: float
    delivery_fee: float = 0
    total: float
    payment_method: str = "cod"
    delivery_slot: str = "asap"
    delivery_slot_label: str = "ASAP"

    # Address snapshot
    address_full_name: str
    address_phone: str
    address_line1: str
    address_line2: str | None = ""
    address_landmark: str | None = ""
    address_city: str
    address_pincode: str
    address_latitude: float | None = None
    address_longitude: float | None = None

    # Optional: save address to user's address book
    save_address: bool = False
    address_label: str = "Home"


class OrderResponse(BaseModel):
    id: str
    status: str
    items: list[OrderItemSchema]
    subtotal: float
    delivery_fee: float
    total: float
    payment_method: str
    delivery_slot: str
    delivery_slot_label: str
    address_full_name: str
    address_phone: str
    address_line1: str
    address_city: str
    address_pincode: str
    placed_at: str
    estimated_delivery: str | None = None

    class Config:
        from_attributes = True


def _order_to_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        status=order.status,
        items=[
            OrderItemSchema(
                product_id=item.product_id,
                name=item.name,
                price=item.price,
                quantity=item.quantity,
                weight=item.weight,
                image_path=item.image_path,
            )
            for item in (order.items or [])
        ],
        subtotal=order.subtotal,
        delivery_fee=order.delivery_fee,
        total=order.total,
        payment_method=order.payment_method,
        delivery_slot=order.delivery_slot,
        delivery_slot_label=order.delivery_slot_label,
        address_full_name=order.address_full_name or "",
        address_phone=order.address_phone or "",
        address_line1=order.address_line1 or "",
        address_city=order.address_city or "",
        address_pincode=order.address_pincode or "",
        placed_at=order.placed_at.isoformat() if order.placed_at else "",
        estimated_delivery=order.estimated_delivery.isoformat()
        if order.estimated_delivery
        else None,
    )


# ── Place Order ────────────────────────────────────────────────────


@router.post("/", response_model=OrderResponse, status_code=201)
async def create_order(
    body: CreateOrderRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")

    # Ensure the user exists in our DB (create if first-time)
    result = await db.execute(select(User).where(User.uid == uid))
    db_user = result.scalar_one_or_none()

    if db_user is None:
        db_user = User(
            uid=uid,
            phone_number=user.get("phone_number", ""),
            display_name=user.get("name", ""),
        )
        db.add(db_user)
        await db.flush()

    # Compute estimated delivery
    slot_minutes = {"asap": 60, "morning": 420, "afternoon": 720, "evening": 1020}
    add_mins = slot_minutes.get(body.delivery_slot, 60)
    estimated = datetime.now(timezone.utc).timestamp() + add_mins * 60

    # ── Geocode address if coordinates are missing ────────────────────
    address_lat = body.address_latitude
    address_lng = body.address_longitude
    if address_lat is None or address_lng is None:
        try:
            from app.services.geocode_service import geocode_address
            coords = await geocode_address(
                address_line1=body.address_line1,
                address_city=body.address_city,
                address_pincode=body.address_pincode,
            )
            if coords:
                address_lat = coords["latitude"]
                address_lng = coords["longitude"]
                logger.info(f"[Geocode] Fallback geocoded order address → {address_lat},{address_lng}")
        except Exception as geo_err:
            logger.warning(f"[Geocode] Fallback failed: {geo_err}")

    order = Order(
        id=body.id or None,  # Use client ID if provided
        user_uid=uid,
        subtotal=body.subtotal,
        delivery_fee=body.delivery_fee,
        total=body.total,
        payment_method=body.payment_method,
        delivery_slot=body.delivery_slot,
        delivery_slot_label=body.delivery_slot_label,
        estimated_delivery=datetime.fromtimestamp(estimated, tz=timezone.utc),
        address_full_name=body.address_full_name,
        address_phone=body.address_phone,
        address_line1=body.address_line1,
        address_line2=body.address_line2 or "",
        address_landmark=body.address_landmark or "",
        address_city=body.address_city,
        address_pincode=body.address_pincode,
        address_latitude=address_lat,
        address_longitude=address_lng,
    )
    db.add(order)
    await db.flush()  # get order.id

    # Build items list while session is active (avoids lazy-load greenlet errors)
    items_data = []
    for item in body.items:
        oi = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            name=item.name,
            price=item.price,
            quantity=item.quantity,
            weight=item.weight,
            image_path=item.image_path,
        )
        db.add(oi)
        items_data.append({
            "product_id": item.product_id,
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
            "weight": item.weight or "",
            "image_path": item.image_path or "",
        })

    # Save address to user's address book if requested
    if body.save_address:
        existing_addr = await db.execute(
            select(Address).where(
                Address.user_uid == uid,
                Address.line1 == body.address_line1,
                Address.city == body.address_city,
            )
        )
        if not existing_addr.scalar_one_or_none():
            db.add(
                Address(
                    user_uid=uid,
                    label=body.address_label,
                    full_name=body.address_full_name,
                    phone=body.address_phone,
                    line1=body.address_line1,
                    line2=body.address_line2 or "",
                    landmark=body.address_landmark or "",
                    city=body.address_city,
                    pincode=body.address_pincode,
                    latitude=body.address_latitude,
                    longitude=body.address_longitude,
                )
            )

    await db.commit()

    # ── Firestore: SKIP individual sync — orders stay in SQLite.
    # Only synced in batch via auto-archive when 20+ delivered accumulate.
    # This saves Firestore read/write quota (no per-order Firestore cost).

    # ── Cache in Redis (last 3 orders, FIFO) ──
    await cache_recent_order(uid, {
        "id": order.id,
        "status": order.status,
        "subtotal": order.subtotal,
        "delivery_fee": order.delivery_fee,
        "total": order.total,
        "payment_method": order.payment_method,
        "items": items_data,
        "placed_at": order.placed_at.isoformat() if order.placed_at else "",
        "estimated_delivery": order.estimated_delivery.isoformat() if order.estimated_delivery else "",
    })

    logger.info("Order {} placed by user {}", order.id, uid)

    # Broadcast new order via WebSocket
    order_data = {
        "id": order.id,
        "status": order.status,
        "total": order.total,
        "payment_method": order.payment_method,
        "placed_at": order.placed_at.isoformat() if order.placed_at else "",
        "address_city": order.address_city or "",
        "items_count": len(items_data),
    }
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_new_order(order_data)
    except Exception:
        pass
    # Also notify the specific customer who placed this order
    try:
        from app.services.user_websocket_manager import user_manager as usr_mgr
        await usr_mgr.send_new_order_to_user(uid, order_data)
    except Exception:
        pass

    # Build response using pre-built items (avoids lazy-load greenlet errors)
    return OrderResponse(
        id=order.id,
        status=order.status,
        items=[
            OrderItemSchema(**it) for it in items_data
        ],
        subtotal=order.subtotal,
        delivery_fee=order.delivery_fee,
        total=order.total,
        payment_method=order.payment_method,
        delivery_slot=order.delivery_slot,
        delivery_slot_label=order.delivery_slot_label,
        address_full_name=order.address_full_name or "",
        address_phone=order.address_phone or "",
        address_line1=order.address_line1 or "",
        address_city=order.address_city or "",
        address_pincode=order.address_pincode or "",
        placed_at=order.placed_at.isoformat() if order.placed_at else "",
        estimated_delivery=order.estimated_delivery.isoformat() if order.estimated_delivery else None,
    )


# ── List My Orders (Firestore → Redis-cached) ────────────────────


@router.get("/", response_model=list[OrderResponse])
async def list_my_orders(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")

    try:
        # SQLite only — no Firestore reads (saves quota).
        # Orders stay in SQLite until batch-archived at 20+ delivered.
        from sqlalchemy.orm import selectinload
        stmt = (
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.user_uid == uid)
            .order_by(Order.placed_at.desc())
            .limit(10)
        )
        result = await db.execute(stmt)
        orders = result.scalars().all()
        return [_order_to_response(o) for o in orders]
    except Exception as e:
        logger.error(f"[Orders] list_my_orders failed for {uid}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ── Get Single Order ───────────────────────────────────────────────


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")

    # SQLite only — no Firestore reads (saves quota)
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_uid == uid)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_response(order)
