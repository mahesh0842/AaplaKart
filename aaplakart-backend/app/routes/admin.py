"""Admin routes — system health, dashboard stats, bulk operations."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import User, Order, Address
from app.middleware.auth_middleware import require_admin
from app.services.product_service import _load_products, _save_products
from app.services.category_service import (
    _load_sections,
    _save_sections,
    get_sections,
    get_categories,
    get_subcategories,
)
from app.services.redis_service import get_client
from app.config.firebase import is_firebase_ready, get_firestore_client
from app.config.settings import settings

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── System Health ─────────────────────────────────────────────────

# Cache health check results for 30 seconds
_health_cache = None
_health_cache_time = 0

@router.get("/health")
async def system_health(user: dict = Depends(require_admin)):
    """Check health of all system components."""
    global _health_cache, _health_cache_time
    now = datetime.now(timezone.utc).timestamp()
    
    # Return cached result if less than 30 seconds old
    if _health_cache and (now - _health_cache_time) < 30:
        return _health_cache
    
    checks = {}

    # 1. Database
    try:
        from sqlalchemy import text
        from app.db.database import _async_session_factory
        async with _async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok", "type": "SQLite/CloudSQL"}
    except Exception as e:
        checks["database"] = {"status": "error", "message": str(e)}

    # 2. Firebase Admin SDK
    fb_ready = is_firebase_ready()
    checks["firebase_admin"] = {
        "status": "ok" if fb_ready else "degraded",
        "message": "REST API fallback active" if not fb_ready and settings.firebase_api_key else "No API key configured",
        "project_id": settings.firebase_project_id,
    }

    # 3. Firestore
    try:
        fs = get_firestore_client()
        if fs:
            checks["firestore"] = {"status": "ok"}
        else:
            checks["firestore"] = {
                "status": "unavailable",
                "message": "Requires Firebase Admin service account key",
            }
    except Exception as e:
        checks["firestore"] = {"status": "error", "message": str(e)}

    # 4. Redis
    try:
        redis = await get_client()
        if redis is None:
            checks["redis"] = {"status": "unavailable", "message": "Redis server not running"}
        else:
            await redis.ping()
            checks["redis"] = {"status": "ok"}
    except Exception as e:
        checks["redis"] = {"status": "unavailable", "message": str(e)}

    # 5. Product Catalog
    try:
        products = _load_products()
        checks["product_catalog"] = {"status": "ok", "product_count": len(products)}
    except Exception as e:
        checks["product_catalog"] = {"status": "error", "message": str(e)}

    # 6. Category Data
    try:
        sections = _load_sections()
        checks["category_data"] = {"status": "ok", "section_count": len(sections)}
    except Exception as e:
        checks["category_data"] = {"status": "error", "message": str(e)}

    # 7. Razorpay
    checks["razorpay"] = {
        "status": "configured" if settings.razorpay_key_id else "unconfigured",
        "key_id_set": bool(settings.razorpay_key_id),
    }

    all_ok = all(
        c.get("status") in ("ok", "configured")
        for c in checks.values()
    )

    result = {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "healthy" if all_ok else "degraded",
        "checks": checks,
    }
    
    # Cache for 30 seconds
    _health_cache = result
    _health_cache_time = datetime.now(timezone.utc).timestamp()
    
    return result


# ── Dashboard Stats ───────────────────────────────────────────────

@router.get("/stats")
async def dashboard_stats(user: dict = Depends(require_admin)):
    """Get aggregate stats for the admin dashboard."""
    from sqlalchemy import select, func
    from app.db.database import get_session, _async_session_factory
    from app.db.models import User, Order

    stats = {}

    # Product counts by type (JSON file)
    products = _load_products()
    stats["total_products"] = len(products)
    stats["kart_products"] = len([p for p in products if p.get("type") == "kart"])
    stats["waffle_products"] = len([p for p in products if p.get("type") == "app"])
    stats["out_of_stock"] = len([p for p in products if p.get("stock", 0) == 0])

    # Category counts (JSON file)
    sections = _load_sections()
    all_cats = get_categories()
    all_subs = get_subcategories()
    stats["total_sections"] = len(sections)
    stats["total_categories"] = len(all_cats)
    stats["total_subcategories"] = len(all_subs)

    # User & Order stats from DB (via async session)
    try:
        async with _async_session_factory() as session:
            # User count
            user_result = await session.execute(select(func.count()).select_from(User))
            stats["total_users"] = user_result.scalar() or 0

            # Order counts by status
            status_result = await session.execute(
                select(Order.status, func.count()).group_by(Order.status)
            )
            order_statuses = {}
            total_orders = 0
            for status_val, cnt in status_result:
                order_statuses[status_val] = cnt
                total_orders += cnt
            stats["total_orders"] = total_orders
            stats["orders_by_status"] = order_statuses

            # Revenue
            revenue_result = await session.execute(
                select(func.coalesce(func.sum(Order.total), 0)).where(
                    Order.status.in_(['delivered', 'confirmed', 'preparing', 'out-for-delivery'])
                )
            )
            stats["total_revenue"] = float(revenue_result.scalar() or 0)
    except Exception as e:
        logger.warning(f"DB stats query failed: {e}")
        stats["total_users"] = "N/A"
        stats["total_orders"] = "N/A"
        stats["orders_by_status"] = {}
        stats["total_revenue"] = "N/A"

    return {"success": True, "stats": stats}


# ── Bulk Product Operations ───────────────────────────────────────

@router.post("/products/bulk-status")
async def bulk_toggle_products(body: dict, user: dict = Depends(require_admin)):
    """Bulk enable/disable products by IDs or type."""
    product_ids = body.get("product_ids", [])
    product_type = body.get("type")
    stock_value = body.get("stock", 0)

    products = _load_products()
    updated = 0

    for p in products:
        if product_ids and p.get("id") not in product_ids:
            continue
        if product_type and p.get("type") != product_type:
            continue
        p["stock"] = stock_value
        updated += 1

    _save_products(products)
    logger.info(f"Bulk status update: {updated} products set to stock={stock_value}")

    return {"success": True, "updated_count": updated}


# ── Category CRUD ─────────────────────────────────────────────────

@router.post("/categories/section")
async def create_section(body: dict, user: dict = Depends(require_admin)):
    """Create a new section."""
    sections = _load_sections()
    new_section = {
        "id": body.get("id", f"section-{body.get('name', 'new').lower().replace(' ', '-')}"),
        "name": body["name"],
        "type": body.get("type", "kart"),
        "image": body.get("image", ""),
        "categories": body.get("categories", []),
    }
    sections.append(new_section)
    _save_sections(sections)
    logger.info(f"Section created: {new_section['name']}")
    return {"success": True, "section": new_section}


@router.put("/categories/section/{section_id}")
async def update_section(section_id: str, body: dict, user: dict = Depends(require_admin)):
    """Update an existing section."""
    sections = _load_sections()
    for i, s in enumerate(sections):
        if s.get("id") == section_id:
            sections[i] = {**s, **body, "id": section_id}
            _save_sections(sections)
            return {"success": True, "section": sections[i]}
    raise HTTPException(status_code=404, detail="Section not found")


@router.delete("/categories/section/{section_id}")
async def delete_section(section_id: str, user: dict = Depends(require_admin)):
    """Delete a section and all its categories."""
    sections = _load_sections()
    original_len = len(sections)
    sections = [s for s in sections if s.get("id") != section_id]
    if len(sections) == original_len:
        raise HTTPException(status_code=404, detail="Section not found")
    _save_sections(sections)
    return {"success": True, "message": f"Section {section_id} deleted"}


@router.post("/categories/{section_id}/category")
async def create_category(section_id: str, body: dict, user: dict = Depends(require_admin)):
    """Add a category to a section."""
    sections = _load_sections()
    for s in sections:
        if s.get("id") == section_id:
            new_cat = {
                "id": body.get("id", f"cat-{body.get('name', 'new').lower().replace(' ', '-')}"),
                "name": body["name"],
                "image": body.get("image", ""),
                "subcategories": body.get("subcategories", []),
            }
            s.setdefault("categories", []).append(new_cat)
            _save_sections(sections)
            return {"success": True, "category": new_cat}
    raise HTTPException(status_code=404, detail="Section not found")


@router.put("/categories/{section_id}/category/{category_id}")
async def update_category(section_id: str, category_id: str, body: dict, user: dict = Depends(require_admin)):
    """Update a category within a section."""
    sections = _load_sections()
    for s in sections:
        if s.get("id") == section_id:
            for i, c in enumerate(s.get("categories", [])):
                if c.get("id") == category_id:
                    s["categories"][i] = {**c, **body, "id": category_id}
                    _save_sections(sections)
                    return {"success": True, "category": s["categories"][i]}
    raise HTTPException(status_code=404, detail="Category not found")


@router.delete("/categories/{section_id}/category/{category_id}")
async def delete_category(section_id: str, category_id: str, user: dict = Depends(require_admin)):
    """Delete a category from a section."""
    sections = _load_sections()
    for s in sections:
        if s.get("id") == section_id:
            original_len = len(s.get("categories", []))
            s["categories"] = [c for c in s.get("categories", []) if c.get("id") != category_id]
            if len(s["categories"]) < original_len:
                _save_sections(sections)
                return {"success": True, "message": f"Category {category_id} deleted"}
    raise HTTPException(status_code=404, detail="Category not found")


# ── Order Management (Admin) ──────────────────────────────────────

# Cache for orders list (5 second TTL)
_orders_cache: dict = {}
_orders_cache_time: float = 0

@router.get("/orders")
async def list_all_orders(
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 50,
    user: dict = Depends(require_admin),
):
    """List all orders (admin view) — Core-level SQL, no ORM overhead."""
    from sqlalchemy import text
    from app.db.database import _async_session_factory

    cache_key = f"{status_filter or 'all'}:{page}:{page_size}"
    now = datetime.now(timezone.utc).timestamp()

    global _orders_cache, _orders_cache_time
    if _orders_cache and (now - _orders_cache_time) < 5 and cache_key in _orders_cache:
        return _orders_cache[cache_key]

    try:
        async with _async_session_factory() as session:
            where_clause = ""
            if status_filter:
                where_clause = f"WHERE o.status = :status"

            # Count
            count_sql = f"SELECT COUNT(*) FROM orders o {where_clause}"
            count_result = await session.execute(
                text(count_sql),
                {"status": status_filter} if status_filter else {},
            )
            total = count_result.scalar() or 0

            # Paginated orders — raw SQL, no ORM objects
            offset = (page - 1) * page_size
            orders_sql = f"""
                SELECT o.* FROM orders o
                {where_clause}
                ORDER BY o.placed_at DESC
                LIMIT :limit OFFSET :offset
            """
            params = {"limit": page_size, "offset": offset}
            if status_filter:
                params["status"] = status_filter

            result = await session.execute(text(orders_sql), params)
            rows = result.mappings().all()

            if not rows:
                payload = {
                    "success": True, "count": total,
                    "page": page, "page_size": page_size, "orders": [],
                }
                _orders_cache[cache_key] = payload
                _orders_cache_time = now
                return payload

            # Fetch items for these orders (single batch query)
            order_ids = [r["id"] for r in rows]
            items_sql = f"""
                SELECT * FROM order_items
                WHERE order_id IN ({','.join(f':oid_{i}' for i in range(len(order_ids)))})
                ORDER BY order_id
            """
            items_params = {f'oid_{i}': oid for i, oid in enumerate(order_ids)}
            items_result = await session.execute(text(items_sql), items_params)
            item_rows = items_result.mappings().all()

            # Group items by order_id
            items_by_order: dict[str, list] = {}
            for item in item_rows:
                oid = item["order_id"]
                items_by_order.setdefault(oid, []).append({
                    "product_id": item["product_id"],
                    "name": item["name"],
                    "price": item["price"],
                    "quantity": item["quantity"],
                    "weight": item["weight"],
                    "image_path": item["image_path"],
                })
            # Ensure every order has an items list
            for oid in order_ids:
                items_by_order.setdefault(oid, [])

            # Serialize directly from row mappings
            def _fmt(val):
                """Convert datetime to ISO string — handles both datetime objects and ISO strings."""
                if val is None:
                    return None
                if hasattr(val, "isoformat"):
                    return val.isoformat()
                return str(val)  # already a string (SQLite stores datetimes as text)

            orders_data = []
            for r in rows:
                orders_data.append({
                    "id": r["id"],
                    "user_uid": r["user_uid"],
                    "status": r["status"],
                    "subtotal": r["subtotal"],
                    "delivery_fee": r["delivery_fee"],
                    "total": r["total"],
                    "payment_method": r["payment_method"],
                    "delivery_slot": r["delivery_slot"],
                    "delivery_slot_label": r["delivery_slot_label"],
                    "estimated_delivery": _fmt(r["estimated_delivery"]),
                    "address_full_name": r["address_full_name"],
                    "address_phone": r["address_phone"],
                    "address_line1": r["address_line1"],
                    "address_line2": r["address_line2"],
                    "address_landmark": r["address_landmark"],
                    "address_city": r["address_city"],
                    "address_pincode": r["address_pincode"],
                    "placed_at": _fmt(r["placed_at"]),
                    "updated_at": _fmt(r["updated_at"]),
                    "items": items_by_order.get(r["id"], []),
                })

            payload = {
                "success": True, "count": total,
                "page": page, "page_size": page_size,
                "orders": orders_data,
            }

            _orders_cache[cache_key] = payload
            _orders_cache_time = now
            return payload
    except Exception as e:
        logger.error(f"Admin orders query failed: {e}")
        return {"success": False, "message": str(e), "orders": []}


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: dict, user: dict = Depends(require_admin)):
    """Update order status (admin)."""
    from sqlalchemy import select
    from app.db.database import _async_session_factory
    from app.db.models import Order

    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")

    valid_statuses = ["pending", "confirmed", "preparing", "out-for-delivery", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    try:
        async with _async_session_factory() as session:
            result = await session.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            order.status = new_status
            order.updated_at = datetime.now(timezone.utc)
            await session.commit()

        # Sync to Firestore
        try:
            fs = get_firestore_client()
            if fs:
                fs.collection("orders").document(order_id).update({"status": new_status})
        except Exception:
            pass

        # Broadcast to WebSocket clients
        try:
            from app.services.websocket_manager import manager
            await manager.broadcast_order_update({
                "id": order_id,
                "status": new_status,
                "updated_by": "admin",
            })
        except Exception:
            pass

        logger.info(f"Order {order_id} status updated to {new_status}")
        return {"success": True, "order_id": order_id, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        async with engine.connect() as conn:
            result = await conn.execute(
                text("UPDATE orders SET status = :status, updated_at = :now WHERE id = :oid"),
                {"status": new_status, "now": datetime.now(timezone.utc).isoformat(), "oid": order_id},
            )
            await conn.commit()
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Order not found")

        # Sync to Firestore
        try:
            fs = get_firestore_client()
            if fs:
                fs.collection("orders").document(order_id).update({"status": new_status})
        except Exception:
            pass

        logger.info(f"Order {order_id} status updated to {new_status}")
        return {"success": True, "order_id": order_id, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Edit Order (Admin) ──────────────────────────────────────────


@router.patch("/orders/{order_id}/edit")
async def edit_order(
    order_id: str,
    body: dict,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    """Edit order details (address, totals). Admin only."""
    from sqlalchemy import select
    from app.db.models import Order

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update address fields if provided
    if "address_full_name" in body:
        order.address_full_name = body["address_full_name"]
    if "address_phone" in body:
        order.address_phone = body["address_phone"]
    if "address_line1" in body:
        order.address_line1 = body["address_line1"]
    if "address_city" in body:
        order.address_city = body["address_city"]
    if "address_pincode" in body:
        order.address_pincode = body["address_pincode"]
    if "subtotal" in body:
        order.subtotal = body["subtotal"]
    if "delivery_fee" in body:
        order.delivery_fee = body["delivery_fee"]
    if "total" in body:
        order.total = body["total"]

    order.updated_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info(f"Order {order_id} edited by admin")

    # Broadcast update via WebSocket
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_order_update({
            "id": order_id,
            "status": order.status,
            "updated_by": "admin_edit",
        })
    except Exception:
        pass

    return {"success": True, "order_id": order_id, "message": "Order updated"}


# ── CSV Export (Admin) ────────────────────────────────────────────


@router.get("/orders/export")
async def export_orders_csv(
    status_filter: str | None = None,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    """Export orders as CSV file."""
    from datetime import datetime
    import csv
    import io

    # Build query
    from sqlalchemy import text
    where_clause = ""
    params = {}
    if status_filter:
        where_clause = "WHERE o.status = :status"
        params["status"] = status_filter

    sql = f"""
        SELECT o.id, o.status, o.subtotal, o.delivery_fee, o.total,
               o.payment_method, o.address_full_name, o.address_phone,
               o.address_line1, o.address_city, o.address_pincode,
               o.address_latitude, o.address_longitude,
               o.placed_at, o.updated_at, o.user_uid
        FROM orders o
        {where_clause}
        ORDER BY o.placed_at DESC
    """
    result = await db.execute(text(sql), params)
    rows = result.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order ID", "Status", "Subtotal", "Delivery Fee", "Total",
        "Payment Method", "Customer Name", "Customer Phone",
        "Address", "City", "Pincode", "Latitude", "Longitude",
        "Placed At", "Updated At", "User UID"
    ])
    for row in rows:
        writer.writerow([
            row.id, row.status, row.subtotal, row.delivery_fee, row.total,
            row.payment_method, row.address_full_name, row.address_phone,
            row.address_line1, row.address_city, row.address_pincode,
            row.address_latitude, row.address_longitude,
            row.placed_at, row.updated_at, row.user_uid,
        ])

    from fastapi.responses import StreamingResponse
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=orders_export_{timestamp}.csv"},
    )


# ── Promo Management (Admin) ──────────────────────────────────────


@router.get("/promos")
async def list_promos_admin(
    brand: str | None = None,
    position: str | None = None,
    user: dict = Depends(require_admin),
):
    """List all promos (including inactive) for admin management."""
    from app.services.config_service import get_promos
    promos = get_promos(brand=brand, position=position, active_only=False)
    return {"success": True, "count": len(promos), "promos": promos}


@router.post("/promos")
async def create_promo(body: dict, user: dict = Depends(require_admin)):
    """Create a new promo banner."""
    from app.services.config_service import add_promo
    promo = add_promo(body)
    return {"success": True, "promo": promo}


@router.put("/promos/{promo_id}")
async def update_promo_admin(promo_id: str, body: dict, user: dict = Depends(require_admin)):
    """Update an existing promo."""
    from app.services.config_service import update_promo
    promo = update_promo(promo_id, body)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True, "promo": promo}


@router.delete("/promos/{promo_id}")
async def delete_promo_admin(promo_id: str, user: dict = Depends(require_admin)):
    """Delete a promo banner."""
    from app.services.config_service import delete_promo
    if not delete_promo(promo_id):
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True, "message": f"Promo {promo_id} deleted"}


@router.patch("/promos/{promo_id}/toggle")
async def toggle_promo_admin(promo_id: str, user: dict = Depends(require_admin)):
    """Toggle a promo's active status."""
    from app.services.config_service import toggle_promo
    promo = toggle_promo(promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True, "promo": promo}


# ── Config Management (Admin) ─────────────────────────────────────


@router.get("/config")
async def get_config_admin(user: dict = Depends(require_admin)):
    """Get app configuration (admin view)."""
    from app.services.config_service import (
        get_app_config,
        get_delivery_slots,
        get_payment_methods,
        get_order_statuses,
    )
    return {
        "success": True,
        "config": get_app_config(),
        "delivery_slots": get_delivery_slots(),
        "payment_methods": get_payment_methods(),
        "order_statuses": get_order_statuses(),
    }


@router.put("/config")
async def update_config_admin(body: dict, user: dict = Depends(require_admin)):
    """Update app configuration (admin)."""
    from app.services.config_service import update_app_config
    updated = update_app_config(body)
    return {"success": True, "message": "Config updated", "config": updated}


# ── User Management (Admin) ────────────────────────────────────────


@router.get("/users")
async def list_users_admin(user: dict = Depends(require_admin)):
    """List all registered users (admin view)."""
    from sqlalchemy import select
    from app.db.database import _async_session_factory
    from app.db.models import User

    try:
        async with _async_session_factory() as session:
            result = await session.execute(select(User).order_by(User.created_at.desc()))
            users = result.scalars().all()
            return {
                "success": True,
                "count": len(users),
                "users": [
                    {
                        "uid": u.uid,
                        "phone_number": u.phone_number,
                        "email": u.email,
                        "display_name": u.display_name,
                        "photo_url": u.photo_url,
                        "role": u.role,
                        "is_test_user": u.is_test_user,
                        "created_at": u.created_at.isoformat() if u.created_at else None,
                    }
                    for u in users
                ],
            }
    except Exception as e:
        return {"success": False, "message": str(e), "users": []}
