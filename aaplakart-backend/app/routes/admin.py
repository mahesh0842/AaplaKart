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
from app.services.config_service import get_promos
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
    from app.services.firestore_service import fs_get_orders, fs_get_all_users, fs_get_order_stats

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

    # User & Order stats from SQLite (much faster than Firestore for aggregates)
    try:
        from sqlalchemy import select, func
        from app.db.database import _async_session_factory
        from app.db.models import User, Order

        async with _async_session_factory() as session:
            user_result = await session.execute(select(func.count()).select_from(User))
            stats["total_users"] = user_result.scalar() or 0

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

            revenue_result = await session.execute(
                select(func.coalesce(func.sum(Order.total), 0)).where(
                    Order.status.in_(['delivered', 'confirmed', 'preparing', 'out-for-delivery'])
                )
            )
            stats["total_revenue"] = float(revenue_result.scalar() or 0)
    except Exception as e2:
        logger.warning(f"DB stats query failed: {e2}")
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


# ── Category CRUD — Firestore first ──────────────────────────────

@router.post("/categories/section")
async def create_section(body: dict, user: dict = Depends(require_admin)):
    """Create a new section."""
    try:
        db = get_firestore_client()
        if db:
            section_id = body.get("id", f"section-{body.get('name', 'new').lower().replace(' ', '-')}-{datetime.now(timezone.utc).timestamp():.0f}")
            new_section = {
                "id": section_id,
                "name": body["name"],
                "type": body.get("type", "kart"),
                "image": body.get("image", ""),
                "categories": body.get("categories", []),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            db.collection("sections").document(section_id).set(new_section)
            logger.info(f"Section created (Firestore): {new_section['name']}")
            return {"success": True, "section": new_section}
    except Exception:
        pass

    # Fallback
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
    return {"success": True, "section": new_section}


@router.put("/categories/section/{section_id}")
async def update_section(section_id: str, body: dict, user: dict = Depends(require_admin)):
    """Update an existing section."""
    try:
        db = get_firestore_client()
        if db:
            body["updated_at"] = datetime.now(timezone.utc).isoformat()
            db.collection("sections").document(section_id).update(body)
            return {"success": True, "section": {"id": section_id, **body}}
    except Exception:
        pass

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
    try:
        db = get_firestore_client()
        if db:
            db.collection("sections").document(section_id).delete()
            return {"success": True, "message": f"Section {section_id} deleted from Firestore"}
    except Exception:
        pass

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
    try:
        db = get_firestore_client()
        if db:
            doc = db.collection("sections").document(section_id).get()
            if doc.exists:
                section = doc.to_dict()
                categories = section.get("categories", [])
                cat_id = body.get("id", f"cat-{body.get('name', 'new').lower().replace(' ', '-')}-{datetime.now(timezone.utc).timestamp():.0f}")
                new_cat = {
                    "id": cat_id,
                    "name": body["name"],
                    "image": body.get("image", ""),
                    "subcategories": body.get("subcategories", []),
                }
                categories.append(new_cat)
                db.collection("sections").document(section_id).update({"categories": categories})
                return {"success": True, "category": new_cat}
    except Exception:
        pass

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
    try:
        db = get_firestore_client()
        if db:
            doc = db.collection("sections").document(section_id).get()
            if doc.exists:
                section = doc.to_dict()
                categories = section.get("categories", [])
                updated = False
                for i, c in enumerate(categories):
                    if c.get("id") == category_id:
                        categories[i] = {**c, **body, "id": category_id}
                        updated = True
                        break
                if updated:
                    db.collection("sections").document(section_id).update({"categories": categories})
                    return {"success": True, "category": {**categories[[i for i, c in enumerate(categories) if c.get('id') == category_id][0]]}}
    except Exception:
        pass

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
    try:
        db = get_firestore_client()
        if db:
            doc = db.collection("sections").document(section_id).get()
            if doc.exists:
                section = doc.to_dict()
                categories = [c for c in section.get("categories", []) if c.get("id") != category_id]
                db.collection("sections").document(section_id).update({"categories": categories})
                return {"success": True, "message": f"Category {category_id} deleted from Firestore"}
    except Exception:
        pass

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
    """List all orders (admin view) — SQLite first (fast), Firestore fallback only if empty."""
    from sqlalchemy import text
    from app.db.database import _async_session_factory

    cache_key = f"{status_filter or 'all'}:{page}:{page_size}"
    now = datetime.now(timezone.utc).timestamp()

    global _orders_cache, _orders_cache_time
    if _orders_cache and (now - _orders_cache_time) < 5 and cache_key in _orders_cache:
        return _orders_cache[cache_key]

    # ── SQLite FIRST (fast, source of truth) ──
    try:
        async with _async_session_factory() as session:
            where_clause = ""
            if status_filter:
                where_clause = "WHERE o.status = :status"

            count_sql = f"SELECT COUNT(*) FROM orders o {where_clause}"
            count_result = await session.execute(
                text(count_sql),
                {"status": status_filter} if status_filter else {},
            )
            total = count_result.scalar() or 0

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
                # ── Firestore fallback only when SQLite has nothing ──
                from app.services.firestore_service import fs_get_orders
                fs_orders = await fs_get_orders(status_filter=status_filter, limit=page_size)
                if fs_orders is not None and len(fs_orders) > 0:
                    start = (page - 1) * page_size
                    page_orders = fs_orders[start:start + page_size]
                    payload = {
                        "success": True,
                        "count": len(fs_orders),
                        "page": page,
                        "page_size": page_size,
                        "orders": page_orders,
                    }
                    _orders_cache[cache_key] = payload
                    _orders_cache_time = now
                    return payload

                payload = {
                    "success": True, "count": total,
                    "page": page, "page_size": page_size, "orders": [],
                }
                _orders_cache[cache_key] = payload
                _orders_cache_time = now
                return payload

            order_ids = [r["id"] for r in rows]
            items_sql = f"""
                SELECT * FROM order_items
                WHERE order_id IN ({','.join(f':oid_{i}' for i in range(len(order_ids)))})
                ORDER BY order_id
            """
            items_params = {f'oid_{i}': oid for i, oid in enumerate(order_ids)}
            items_result = await session.execute(text(items_sql), items_params)
            item_rows = items_result.mappings().all()

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
            for oid in order_ids:
                items_by_order.setdefault(oid, [])

            def _fmt(val):
                if val is None:
                    return None
                if hasattr(val, "isoformat"):
                    return val.isoformat()
                return str(val)

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
    """Update order status (admin) — SQLite first (fast), Firestore async."""
    from app.services.firestore_service import fs_update_order_status

    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")

    valid_statuses = ["pending", "confirmed", "preparing", "out-for-delivery", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    # 1. Write to SQLite FIRST (fast, local)
    sql_ok = False
    old_status = None
    try:
        from sqlalchemy import select
        from app.db.database import _async_session_factory
        from app.db.models import Order

        async with _async_session_factory() as session:
            result = await session.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")
            old_status = order.status  # capture before update
            order.status = new_status
            order.updated_at = datetime.now(timezone.utc)
            await session.commit()
            sql_ok = True
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 2. Firestore: SKIP per-status sync — saves quota.
    # Only batch-synced via auto-archive when 20+ delivered accumulate.

    # 3. Auto-archive: if UNSYNCED delivered orders reach 20, batch sync all
    if sql_ok and new_status == "delivered":
        try:
            from sqlalchemy import select, func
            from app.db.database import _async_session_factory
            from app.db.models import Order

            async with _async_session_factory() as session:
                count_result = await session.execute(
                    select(func.count(Order.id))
                    .where(Order.status == "delivered")
                    .where(Order.synced_to_firestore == 0)
                )
                unsynced_count = count_result.scalar() or 0

            if unsynced_count >= 20:
                logger.info(f"[AutoArchive] {unsynced_count} unsynced delivered orders — triggering sync+cleanup")
                import asyncio
                asyncio.create_task(_auto_archive_delivered_orders())
        except Exception as e:
            logger.warning(f"[AutoArchive] Trigger check failed: {e}")

    # If status changed FROM delivered, reset sync flag (order re-entered pipeline)
    if sql_ok and old_status == "delivered" and new_status != "delivered":
        try:
            from sqlalchemy import update as sql_update
            from app.db.database import _async_session_factory
            from app.db.models import Order

            async with _async_session_factory() as session:
                await session.execute(
                    sql_update(Order)
                    .where(Order.id == order_id)
                    .values(synced_to_firestore=0, synced_at=None)
                )
                await session.commit()
        except Exception as e:
            logger.warning(f"[AutoArchive] Reset sync flag failed for {order_id}: {e}")

    # 3. Broadcast to WebSocket clients
    order_update_data = {
        "id": order_id,
        "status": new_status,
        "updated_by": "admin",
    }
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_order_update(order_update_data)
    except Exception:
        pass
    # Also notify the specific customer
    try:
        from app.services.user_websocket_manager import user_manager as usr_mgr
        from app.db.database import _async_session_factory
        from app.db.models import Order
        from app.services.firestore_service import fs_get_order
        from sqlalchemy import select
        # Try SQLite first
        user_uid = None
        async with _async_session_factory() as session:
            result = await session.execute(select(Order.user_uid).where(Order.id == order_id))
            user_uid = result.scalar_one_or_none()
        # SQLite is the source of truth — skip Firestore fallback (avoids 429 quota)
        if not user_uid:
            logger.debug(f"User UID not found in SQLite for order {order_id}, skipping user notification")
        # If we found the user_uid, send user-specific broadcast AND include it in global data
        if user_uid:
            order_update_data["user_uid"] = user_uid
            await usr_mgr.send_order_update_to_user(user_uid, order_update_data)
    except Exception:
        pass

    logger.info(f"Order {order_id} status updated to {new_status}")
    return {"success": True, "order_id": order_id, "status": new_status}


# ── Edit Order (Admin) ──────────────────────────────────────────


@router.patch("/orders/{order_id}/edit")
async def edit_order(
    order_id: str,
    body: dict,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    """Edit order details (address, totals). Admin only — Firestore first."""
    from app.services.firestore_service import fs_update_order

    # Write to Firestore first
    fs_ok = await fs_update_order(order_id, body)
    if fs_ok:
        logger.info(f"Order {order_id} edited in Firestore by admin")
    else:
        # Fallback to SQL
        from sqlalchemy import select
        from app.db.models import Order

        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

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

    # Also update SQLite if Firestore succeeded
    if fs_ok:
        try:
            from sqlalchemy import select
            from app.db.models import Order

            result = await db.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()
            if order:
                for key in ("address_full_name", "address_phone", "address_line1", "address_city", "address_pincode", "subtotal", "delivery_fee", "total"):
                    if key in body:
                        setattr(order, key, body[key])
                order.updated_at = datetime.now(timezone.utc)
                await db.commit()
        except Exception:
            pass

    logger.info(f"Order {order_id} edited by admin")

    # Broadcast update via WebSocket
    order_update_data = {
        "id": order_id,
        "status": order.status,
        "updated_by": "admin_edit",
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
        if order and hasattr(order, 'user_uid'):
            user_uid = order.user_uid
        if not user_uid:
            fs_order = await fs_get_order(order_id)
            if fs_order:
                user_uid = fs_order.get("user_uid") or fs_order.get("uid")
        if user_uid:
            await usr_mgr.send_order_update_to_user(user_uid, order_update_data)
    except Exception:
        pass

    return {"success": True, "order_id": order_id, "message": "Order updated"}


# ── Broadcast Status Change (no Firestore write, just WebSocket) ──


@router.post("/orders/{order_id}/broadcast")
async def broadcast_order_status(
    order_id: str,
    body: dict,
    user: dict = Depends(require_admin),
):
    """Broadcast an order status change via WebSocket.
    Uses SQLite for user lookup — NO Firestore calls to avoid 429 quota."""
    new_status = body.get("status", "")
    updated_by = body.get("updated_by", "admin")

    order_update_data = {
        "id": order_id,
        "status": new_status,
        "updated_by": updated_by,
    }

    # Broadcast to global WS
    try:
        from app.services.websocket_manager import manager
        await manager.broadcast_order_update(order_update_data)
    except Exception:
        pass

    # Broadcast to user-specific WS — SQLite lookup only (no Firestore)
    try:
        from app.services.user_websocket_manager import user_manager as usr_mgr
        from sqlalchemy import select
        from app.db.database import _async_session_factory
        from app.db.models import Order

        user_uid = body.get("user_uid")
        if not user_uid:
            async with _async_session_factory() as session:
                result = await session.execute(select(Order.user_uid).where(Order.id == order_id))
                user_uid = result.scalar_one_or_none()
        if user_uid:
            order_update_data["user_uid"] = user_uid
            await usr_mgr.send_order_update_to_user(user_uid, order_update_data)
    except Exception:
        pass

    return {"success": True, "order_id": order_id, "status": new_status}


# ── Safe Firestore Sync (background, no 429 impact on response) ──

# Circuit breaker: skip Firestore for 60s after 3 consecutive failures
_fs_fail_count = 0
_fs_cooldown_until = 0

async def _safe_firestore_sync(order_id: str, new_status: str):
    """Background task: sync order status to Firestore with circuit breaker."""
    global _fs_fail_count, _fs_cooldown_until
    import time
    from app.services.firestore_service import fs_update_order_status

    now = time.time()
    if now < _fs_cooldown_until:
        return  # In cooldown — skip Firestore

    try:
        ok = await fs_update_order_status(order_id, new_status)
        if ok:
            _fs_fail_count = 0  # Reset on success
        else:
            _fs_fail_count += 1
    except Exception:
        _fs_fail_count += 1

    if _fs_fail_count >= 3:
        _fs_cooldown_until = now + 60
        logger.warning(f"[CircuitBreaker] Firestore 429 cooldown — skipping for 60s")
        _fs_fail_count = 0


# ── Auto-Archive: Sync delivered orders to Firestore (batch) + verify ──

# Track auto-archive state for admin UI monitoring
_archive_state = {
    "last_sync_at": None,
    "last_sync_count": 0,
    "last_sync_failed": 0,
    "is_syncing": False,
    "last_error": None,
}

async def _auto_archive_delivered_orders():
    """Background task: batch-sync UNSYNCED delivered orders from SQLite to Firestore.
    
    Uses Firestore batch writes (1 network call for all orders) instead of
    individual set() calls. Only syncs orders with synced_to_firestore=0.
    Does NOT delete from SQLite — admin must verify first.
    """
    global _archive_state
    import time

    if _archive_state["is_syncing"]:
        logger.info("[AutoArchive] Already running — skipping duplicate trigger")
        return

    _archive_state["is_syncing"] = True
    _archive_state["last_error"] = None

    from sqlalchemy import select, update as sql_update
    from app.db.database import _async_session_factory
    from app.db.models import Order, OrderItem

    try:
        async with _async_session_factory() as session:
            # ── 1. Fetch ONLY unsynced delivered orders (limit 50 for safety) ──
            result = await session.execute(
                select(Order)
                .where(Order.status == "delivered")
                .where(Order.synced_to_firestore == 0)
                .order_by(Order.placed_at.asc())
                .limit(50)
            )
            unsynced_orders = result.scalars().all()

            if not unsynced_orders:
                logger.debug("[AutoArchive] No unsynced delivered orders — nothing to sync")
                _archive_state["is_syncing"] = False
                return

            logger.info(f"[AutoArchive] Found {len(unsynced_orders)} unsynced delivered orders")

            # ── 2. Fetch items for all orders ──
            order_ids = [o.id for o in unsynced_orders]
            items_result = await session.execute(
                select(OrderItem).where(OrderItem.order_id.in_(order_ids))
            )
            all_items = items_result.scalars().all()

            # Group items by order_id
            items_map = {}
            for it in all_items:
                items_map.setdefault(it.order_id, []).append({
                    "product_id": it.product_id,
                    "name": it.name,
                    "price": it.price,
                    "quantity": it.quantity,
                    "weight": it.weight or "",
                    "image_path": it.image_path or "",
                })

            # ── 3. Get Firestore client ──
            firestore = get_firestore_client()
            if not firestore:
                logger.warning("[AutoArchive] Firestore unavailable — will retry next trigger")
                _archive_state["last_error"] = "Firestore client unavailable"
                _archive_state["is_syncing"] = False
                return

            # ── 4. BATCH WRITE: single Firestore network call ──
            batch = firestore.batch()
            sync_time = datetime.now(timezone.utc)
            synced_count = 0
            failed_ids = []

            for order in unsynced_orders:
                try:
                    order_items = items_map.get(order.id, [])
                    doc_data = {
                        "id": order.id,
                        "user_uid": order.user_uid,
                        "status": order.status,
                        "subtotal": float(order.subtotal or 0),
                        "delivery_fee": float(order.delivery_fee or 0),
                        "total": float(order.total or 0),
                        "payment_method": order.payment_method or "cod",
                        "delivery_slot": order.delivery_slot or "asap",
                        "delivery_slot_label": order.delivery_slot_label or "ASAP",
                        "address_full_name": order.address_full_name or "",
                        "address_phone": order.address_phone or "",
                        "address_line1": order.address_line1 or "",
                        "address_line2": order.address_line2 or "",
                        "address_landmark": order.address_landmark or "",
                        "address_city": order.address_city or "",
                        "address_pincode": order.address_pincode or "",
                        "address_latitude": order.address_latitude,
                        "address_longitude": order.address_longitude,
                        "items": order_items,
                        "placed_at": order.placed_at.isoformat() if order.placed_at else "",
                        "updated_at": order.updated_at.isoformat() if order.updated_at else "",
                        "archived_at": sync_time.isoformat(),
                    }
                    ref = firestore.collection("orders").document(order.id)
                    batch.set(ref, doc_data)
                    synced_count += 1
                except Exception as e:
                    logger.warning(f"[AutoArchive] Batch-prep failed for {order.id}: {e}")
                    failed_ids.append(order.id)

            # ── 5. Commit batch (single Firestore network call) ──
            if synced_count > 0:
                try:
                    batch.commit()
                    logger.info(f"[AutoArchive] Firestore batch committed — {synced_count} orders in 1 call")
                except Exception as e:
                    _archive_state["last_error"] = f"Firestore batch commit failed: {e}"
                    _archive_state["is_syncing"] = False
                    logger.error(f"[AutoArchive] Batch commit failed: {e}")
                    return

            # ── 6. Mark as synced in SQLite (only successfully synced ones) ──
            synced_ids = [o.id for o in unsynced_orders if o.id not in failed_ids]
            if synced_ids:
                await session.execute(
                    sql_update(Order)
                    .where(Order.id.in_(synced_ids))
                    .values(synced_to_firestore=1, synced_at=sync_time)
                )
                await session.commit()

            # ── 7. Update archive state for admin UI ──
            _archive_state.update({
                "last_sync_at": sync_time.isoformat(),
                "last_sync_count": synced_count,
                "last_sync_failed": len(failed_ids),
                "is_syncing": False,
                "last_error": None,
            })

            logger.info(
                f"[AutoArchive] ✅ Complete — synced: {synced_count}, "
                f"batch: 1 Firestore call, failed: {len(failed_ids)}, "
                f"pending delete (needs verify): {synced_count}"
            )

            # ── 8. Broadcast sync complete via WebSocket ──
            try:
                from app.services.websocket_manager import manager
                await manager.broadcast("archive_sync_complete", {
                    "synced_count": synced_count,
                    "failed_count": len(failed_ids),
                    "synced_at": sync_time.isoformat(),
                })
            except Exception:
                pass

    except Exception as e:
        logger.error(f"[AutoArchive] Fatal error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        _archive_state["last_error"] = str(e)
    finally:
        _archive_state["is_syncing"] = False


# ── Pending Sync Count (for admin UI badge) ──────────────────────

@router.get("/orders/pending-sync-count")
async def get_pending_sync_count(user: dict = Depends(require_admin)):
    """Return count of delivered orders not yet synced to Firestore."""
    global _archive_state
    try:
        from sqlalchemy import select, func
        from app.db.database import _async_session_factory
        from app.db.models import Order

        async with _async_session_factory() as session:
            # Unsynced delivered
            result = await session.execute(
                select(func.count(Order.id))
                .where(Order.status == "delivered")
                .where(Order.synced_to_firestore == 0)
            )
            pending_sync = result.scalar() or 0

            # Synced but not yet cleaned (deleted) from SQLite
            result2 = await session.execute(
                select(func.count(Order.id))
                .where(Order.synced_to_firestore == 1)
                .where(Order.status == "delivered")
            )
            synced_pending_clean = result2.scalar() or 0

        return {
            "success": True,
            "pending_sync_count": pending_sync,
            "synced_pending_clean_count": synced_pending_clean,
            "ready_for_batch": pending_sync >= 20,
            "last_sync_at": _archive_state["last_sync_at"],
            "last_sync_count": _archive_state["last_sync_count"],
            "last_sync_failed": _archive_state["last_sync_failed"],
            "is_syncing": _archive_state["is_syncing"],
            "last_error": _archive_state["last_error"],
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Manual Batch Sync (admin trigger) ────────────────────────────

@router.post("/orders/batch-sync")
async def manual_batch_sync(user: dict = Depends(require_admin)):
    """Manually trigger batch sync of delivered orders to Firestore."""
    global _archive_state

    if _archive_state["is_syncing"]:
        return {
            "success": False,
            "message": "Sync already in progress — please wait",
            "status": "syncing",
        }

    # Run in background so admin UI doesn't block
    import asyncio
    asyncio.create_task(_auto_archive_delivered_orders())

    return {
        "success": True,
        "message": "Batch sync started in background",
    }


# ── Verify & Clean: Delete synced orders from SQLite ─────────────

@router.post("/orders/verify-and-clean")
async def verify_and_clean_synced_orders(
    body: dict | None = None,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    """Verify synced orders exist in Firestore, then delete from SQLite.
    
    Optional body: { "order_ids": ["id1","id2",...] } — clean specific orders.
    If no order_ids provided, cleans ALL synced delivered orders (max 50).
    """
    from sqlalchemy import select
    from app.db.models import Order, OrderItem

    order_ids = (body or {}).get("order_ids", [])

    # ── 1. Find synced orders in SQLite ──
    if order_ids:
        result = await db.execute(
            select(Order).where(Order.id.in_(order_ids))
        )
    else:
        result = await db.execute(
            select(Order)
            .where(Order.synced_to_firestore == 1)
            .where(Order.status == "delivered")
            .limit(50)
        )
    synced_orders = result.scalars().all()

    if not synced_orders:
        return {"success": True, "message": "No synced orders to clean", "deleted_count": 0}

    # ── 2. Verify each order exists in Firestore ──
    firestore = get_firestore_client()
    verified_ids = []
    not_found_ids = []

    for order in synced_orders:
        if firestore:
            try:
                doc = firestore.collection("orders").document(order.id).get()
                if doc.exists:
                    verified_ids.append(order.id)
                else:
                    not_found_ids.append(order.id)
                    logger.warning(f"[Verify&Clean] Order {order.id} NOT found in Firestore — skipping delete")
            except Exception as e:
                logger.warning(f"[Verify&Clean] Firestore verify failed for {order.id}: {e}")
                not_found_ids.append(order.id)
        else:
            # No Firestore — skip verification, trust the flag
            verified_ids.append(order.id)

    # ── 3. Delete verified orders from SQLite ──
    deleted_count = 0
    for oid in verified_ids:
        try:
            order_result = await db.execute(select(Order).where(Order.id == oid))
            order_obj = order_result.scalar_one_or_none()
            if order_obj:
                # Cascade delete handles OrderItems
                await db.delete(order_obj)
                deleted_count += 1
        except Exception as e:
            logger.warning(f"[Verify&Clean] Delete failed for {oid}: {e}")

    await db.commit()

    logger.info(
        f"[Verify&Clean] ✅ Deleted: {deleted_count}, "
        f"Verified in Firestore: {len(verified_ids)}, "
        f"Not found in Firestore: {len(not_found_ids)}"
    )

    return {
        "success": True,
        "deleted_count": deleted_count,
        "verified_count": len(verified_ids),
        "not_found_count": len(not_found_ids),
        "not_found_ids": not_found_ids if not_found_ids else None,
    }


# ── Archive Status (for admin UI dashboard) ──────────────────────

@router.get("/orders/archive-status")
async def get_archive_status(user: dict = Depends(require_admin)):
    """Get full archive/sync status for admin UI."""
    global _archive_state
    try:
        from sqlalchemy import select, func
        from app.db.database import _async_session_factory
        from app.db.models import Order

        async with _async_session_factory() as session:
            # Total delivered
            total_result = await session.execute(
                select(func.count(Order.id)).where(Order.status == "delivered")
            )
            total_delivered = total_result.scalar() or 0

            # Unsynced
            unsynced_result = await session.execute(
                select(func.count(Order.id))
                .where(Order.status == "delivered")
                .where(Order.synced_to_firestore == 0)
            )
            unsynced = unsynced_result.scalar() or 0

            # Synced pending clean
            synced_result = await session.execute(
                select(func.count(Order.id))
                .where(Order.synced_to_firestore == 1)
            )
            synced = synced_result.scalar() or 0

        return {
            "success": True,
            "total_delivered": total_delivered,
            "unsynced": unsynced,
            "synced_pending_clean": synced,
            "ready_for_batch": unsynced >= 20,
            "batch_threshold": 20,
            **{k: v for k, v in _archive_state.items() if k != "is_syncing"},
            "is_syncing": _archive_state["is_syncing"],
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


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

    # Fetch order items with weight for each order
    items_sql = "SELECT order_id, product_id, name, price, quantity, weight FROM order_items WHERE order_id = :oid"
    items_by_order = {}
    for row in rows:
        items_result = await db.execute(text(items_sql), {"oid": row.id})
        items_by_order[row.id] = items_result.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order ID", "Status", "Subtotal", "Delivery Fee", "Total",
        "Payment Method", "Customer Name", "Customer Phone",
        "Address", "City", "Pincode", "Latitude", "Longitude",
        "Placed At", "Updated At", "User UID",
        "Items (name | weight | price | qty)"
    ])
    for row in rows:
        order_items = items_by_order.get(row.id, [])
        items_str = "; ".join([
            f"{it.name} | {it.weight or '-'} | ₹{it.price} x{it.quantity}"
            for it in order_items
        ])
        writer.writerow([
            row.id, row.status, row.subtotal, row.delivery_fee, row.total,
            row.payment_method, row.address_full_name, row.address_phone,
            row.address_line1, row.address_city, row.address_pincode,
            row.address_latitude, row.address_longitude,
            row.placed_at, row.updated_at, row.user_uid,
            items_str,
        ])

    from fastapi.responses import StreamingResponse
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=orders_export_{timestamp}.csv"},
    )


# ── Promo Management (Admin) — Firestore first ────────────────────


@router.get("/promos")
async def list_promos_admin(
    brand: str | None = None,
    position: str | None = None,
    user: dict = Depends(require_admin),
):
    """List all promos (including inactive) for admin management. Local JSON only."""
    promos = get_promos(brand=brand, position=position, active_only=False)
    return {"success": True, "count": len(promos), "promos": promos}


@router.post("/promos")
async def create_promo(body: dict, user: dict = Depends(require_admin)):
    """Create a new promo banner."""
    try:
        db = get_firestore_client()
        if db:
            import uuid
            promo_id = body.get("id") or f"promo-{uuid.uuid4().hex[:8]}"
            body["id"] = promo_id
            body["created_at"] = datetime.now(timezone.utc).isoformat()
            db.collection("promos").document(promo_id).set(body)
            return {"success": True, "promo": body}
    except Exception:
        pass

    from app.services.config_service import add_promo
    promo = add_promo(body)
    return {"success": True, "promo": promo}


@router.put("/promos/{promo_id}")
async def update_promo_admin(promo_id: str, body: dict, user: dict = Depends(require_admin)):
    """Update an existing promo."""
    try:
        db = get_firestore_client()
        if db:
            body["updated_at"] = datetime.now(timezone.utc).isoformat()
            db.collection("promos").document(promo_id).update(body)
            return {"success": True, "promo": {"id": promo_id, **body}}
    except Exception:
        pass

    from app.services.config_service import update_promo
    promo = update_promo(promo_id, body)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True, "promo": promo}


@router.delete("/promos/{promo_id}")
async def delete_promo_admin(promo_id: str, user: dict = Depends(require_admin)):
    """Delete a promo banner."""
    try:
        db = get_firestore_client()
        if db:
            db.collection("promos").document(promo_id).delete()
            return {"success": True, "message": f"Promo {promo_id} deleted"}
    except Exception:
        pass

    from app.services.config_service import delete_promo
    if not delete_promo(promo_id):
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True, "message": f"Promo {promo_id} deleted"}


@router.patch("/promos/{promo_id}/toggle")
async def toggle_promo_admin(promo_id: str, user: dict = Depends(require_admin)):
    """Toggle a promo's active status."""
    try:
        db = get_firestore_client()
        if db:
            doc = db.collection("promos").document(promo_id).get()
            if not doc.exists:
                raise HTTPException(status_code=404, detail="Promo not found")
            current = doc.to_dict().get("active", False)
            db.collection("promos").document(promo_id).update({"active": not current})
            return {"success": True, "promo": {"id": promo_id, "active": not current}}
    except HTTPException:
        raise
    except Exception:
        pass

    from app.services.config_service import toggle_promo
    promo = toggle_promo(promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True, "promo": promo}


# ── Config Management (Admin) — Firestore first ───────────────────


@router.get("/config")
async def get_config_admin(user: dict = Depends(require_admin)):
    """Get app configuration (admin view)."""
    try:
        db = get_firestore_client()
        if db:
            doc = db.collection("config").document("app_config").get()
            config = doc.to_dict() if doc.exists else {}
            return {
                "success": True,
                "config": config,
                "delivery_slots": [{"id": "asap", "label": "ASAP", "description": "Delivery within 60 min"},
                                   {"id": "morning", "label": "Morning", "description": "7 AM - 12 PM"},
                                   {"id": "afternoon", "label": "Afternoon", "description": "12 PM - 5 PM"},
                                   {"id": "evening", "label": "Evening", "description": "5 PM - 10 PM"}],
                "payment_methods": [{"id": "cod", "label": "Cash on Delivery"}, {"id": "online", "label": "Pay Online"}],
                "order_statuses": [{"id": "pending", "label": "Pending"}, {"id": "confirmed", "label": "Confirmed"},
                                   {"id": "preparing", "label": "Preparing"}, {"id": "out-for-delivery", "label": "Out for Delivery"},
                                   {"id": "delivered", "label": "Delivered"}, {"id": "cancelled", "label": "Cancelled"}],
            }
    except Exception:
        pass

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
    try:
        db = get_firestore_client()
        if db:
            body["updated_at"] = datetime.now(timezone.utc).isoformat()
            db.collection("config").document("app_config").set(body, merge=True)
            return {"success": True, "message": "Config updated", "config": body}
    except Exception:
        pass

    from app.services.config_service import update_app_config
    updated = update_app_config(body)
    return {"success": True, "message": "Config updated", "config": updated}


# ── User Management (Admin) ────────────────────────────────────────


@router.get("/users")
async def list_users_admin(user: dict = Depends(require_admin)):
    """List all registered users (admin view) — Firestore first."""
    from app.services.firestore_service import fs_get_all_users

    try:
        fs_users = await fs_get_all_users()
        if fs_users is not None:
            return {
                "success": True,
                "count": len(fs_users),
                "users": fs_users,
            }

        # Fallback to DB
        from sqlalchemy import select
        from app.db.database import _async_session_factory
        from app.db.models import User

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
