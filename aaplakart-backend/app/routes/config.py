"""Configuration & promo routes — public endpoints for app config, promos, etc."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.services.config_service import (
    add_promo,
    delete_promo,
    get_app_config,
    get_delivery_slots,
    get_order_statuses,
    get_payment_methods,
    get_promo_by_id,
    get_promos,
    toggle_promo,
    update_promo,
)

router = APIRouter(prefix="/config", tags=["Configuration"])


# ── App Config ─────────────────────────────────────────────────────


@router.get("")
async def app_config():
    """Get global app configuration (delivery fee, thresholds, etc.)."""
    return {
        "success": True,
        "config": get_app_config(),
    }


@router.get("/delivery-slots")
async def delivery_slots():
    """Get available delivery time slots."""
    return {
        "success": True,
        "slots": get_delivery_slots(),
    }


@router.get("/payment-methods")
async def payment_methods():
    """Get available payment methods."""
    return {
        "success": True,
        "methods": get_payment_methods(),
    }


@router.get("/order-statuses")
async def order_statuses():
    """Get order status labels."""
    return {
        "success": True,
        "statuses": get_order_statuses(),
    }


# ── Promos / Banners ──────────────────────────────────────────────


@router.get("/promos")
async def list_promos(
    brand: str | None = Query(None, description="Filter by brand: kart, waffle, or all"),
    position: str | None = Query(None, description="Filter by position: home_banner, waffle_offer"),
    active_only: bool = Query(True, description="Only return active promos"),
):
    """Get promo banners/slides."""
    promos = get_promos(
        brand=brand if brand and brand != "all" else None,
        position=position,
        active_only=active_only,
    )
    return {
        "success": True,
        "count": len(promos),
        "promos": promos,
    }


@router.get("/promos/{promo_id}")
async def get_promo(promo_id: str):
    """Get a single promo by ID."""
    promo = get_promo_by_id(promo_id)
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo not found")
    return {"success": True, "promo": promo}
