"""Geocoding service — converts address text to lat/lng coordinates.

Uses OpenStreetMap Nominatim (free, no API key) as primary provider
with Google Maps Geocoding API as fallback when configured.

Industry standard approach: multiple fallback providers ensure
maximum geocoding success rate.
"""

from __future__ import annotations

from loguru import logger
import httpx

from app.config.settings import settings

# ── Nominatim (OpenStreetMap) — free, no API key required ──────────


async def _nominatim_geocode(address: str) -> dict | None:
    """Geocode via OpenStreetMap Nominatim (free, rate-limited).

    Returns {"latitude": float, "longitude": float} or None.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": address,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 0,
                },
                headers={
                    "User-Agent": "AaplaKart/1.0 (delivery-service)",
                    "Accept-Language": "en",
                },
            )
            data = resp.json()
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                logger.debug(f"[Geocode] Nominatim OK: {address} → {lat},{lon}")
                return {"latitude": lat, "longitude": lon}
    except Exception as exc:
        logger.debug(f"[Geocode] Nominatim failed: {exc}")
    return None


# ── Google Maps Geocoding API — requires API key ──────────────────


async def _google_geocode(address: str) -> dict | None:
    """Geocode via Google Maps Geocoding API.

    Returns {"latitude": float, "longitude": float} or None.
    """
    api_key = settings.google_maps_api_key
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": address,
                    "key": api_key,
                    "region": "in",  # Bias toward India
                },
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                logger.debug(f"[Geocode] Google OK: {address} → {loc['lat']},{loc['lng']}")
                return {"latitude": loc["lat"], "longitude": loc["lng"]}
            elif data.get("status") == "ZERO_RESULTS":
                logger.debug(f"[Geocode] Google: no results for {address}")
            else:
                logger.debug(f"[Geocode] Google status: {data.get('status')}")
    except Exception as exc:
        logger.debug(f"[Geocode] Google failed: {exc}")
    return None


# ── Public API ─────────────────────────────────────────────────────


async def geocode_address(
    address_line1: str,
    address_city: str,
    address_pincode: str = "",
) -> dict | None:
    """Geocode a full address using multiple providers (fallback chain).

    Tries providers in order:
      1. OpenStreetMap Nominatim (free, rate-limited)
      2. Google Maps Geocoding API (if API key configured)

    Args:
        address_line1: Street address / line 1
        address_city: City name
        address_pincode: PIN code (optional, improves accuracy)

    Returns:
        {"latitude": float, "longitude": float} or None if all providers fail.
    """
    # Build full address string (pincode improves accuracy significantly)
    parts = [p for p in [address_line1, address_city, address_pincode] if p]
    full_address = ", ".join(parts)
    if not full_address:
        return None

    # 1. Try Nominatim (free)
    result = await _nominatim_geocode(full_address)
    if result:
        return result

    # 2. Try Google (with API key)
    result = await _google_geocode(full_address)
    if result:
        return result

    # 3. Try Nominatim with just city + pincode (broader search)
    if address_city and address_pincode:
        broader = f"{address_city}, {address_pincode}, India"
        result = await _nominatim_geocode(broader)
        if result:
            return result

    logger.warning(f"[Geocode] All providers failed for: {full_address}")
    return None
