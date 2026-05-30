"""Product service — reads/writes JSON catalog with in-memory cache.
Uses cache_service for instant reads. No Firestore dependency for reads.
CRUD operations persist to JSON file and update memory cache.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Optional

from loguru import logger

from app.services.cache_service import load_json_data, save_json_data, cache_invalidate

DATA_NAME = "products"


def _load_products() -> list[dict]:
    """Load products from memory cache or JSON file. ~0.001s with cache."""
    return load_json_data(DATA_NAME)


def _save_products(products: list[dict]) -> None:
    """Save products to JSON and update memory cache."""
    save_json_data(DATA_NAME, products)


def get_products(
    type_filter: Optional[str] = None,
    brand: Optional[str] = None,
    category: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """Return products filtered by optional params."""
    products = _load_products()
    if type_filter:
        products = [p for p in products if p.get("type") == type_filter]
    if brand and brand != "all":
        if brand == "kart":
            products = [p for p in products if p.get("brand") != "waffle"]
        elif brand == "waffle":
            products = [p for p in products if p.get("brand") == "waffle"]
    if category and category != "All":
        products = [p for p in products if p.get("category") == category]
    if category_id:
        products = [p for p in products if p.get("categoryId") == category_id]
    if subcategory:
        products = [p for p in products if p.get("subcategory") == subcategory]
    if subcategory_id:
        products = [p for p in products if p.get("subcategoryId") == subcategory_id]
    if search:
        term = search.lower()
        products = [p for p in products if term in p.get("name", "").lower() or term in p.get("category", "").lower()]
    return products


def get_product_by_id(product_id: str) -> Optional[dict]:
    products = _load_products()
    for p in products:
        if p.get("id") == product_id:
            return p
    return None


def add_product(product: dict) -> dict:
    products = _load_products()
    if "id" not in product or not product["id"]:
        base = product.get("name", "product").lower().replace(" ", "-")
        existing = [p for p in products if p.get("id", "").startswith(base)]
        product["id"] = f"{base}-{len(existing) + 1}"
    product.setdefault("stock", 0)
    product.setdefault("rating", 0)
    product.setdefault("deliveryTime", "20 min")
    product.setdefault("image", "")
    product.setdefault("subcategory", "")
    product.setdefault("subcategoryId", "")
    product.setdefault("categoryId", "")
    product.setdefault("type", "kart")
    product.setdefault("weight", "")
    products.append(product)
    _save_products(products)
    logger.info("Product added: {} ({})", product.get("name"), product.get("id"))
    return product


def update_product(product_id: str, updates: dict) -> Optional[dict]:
    products = _load_products()
    for i, p in enumerate(products):
        if p.get("id") == product_id:
            updated = {**p, **updates, "id": product_id}
            products[i] = updated
            _save_products(products)
            logger.info("Product updated: {}", product_id)
            return updated
    return None


def delete_product(product_id: str) -> bool:
    products = _load_products()
    original_len = len(products)
    products = [p for p in products if p.get("id") != product_id]
    if len(products) < original_len:
        _save_products(products)
        logger.info("Product deleted: {}", product_id)
        return True
    return False


def get_categories(type_filter: Optional[str] = None) -> list[str]:
    products = get_products(type_filter=type_filter)
    return sorted(set(p.get("category", "") for p in products if p.get("category")))


def get_products(
    type_filter: Optional[str] = None,
    brand: Optional[str] = None,
    category: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict]:
    """Return products filtered by optional params. Pagination handled by route."""
    products = _load_products()

    if type_filter:
        products = [p for p in products if p.get("type") == type_filter]

    if brand and brand != "all":
        if brand == "kart":
            products = [p for p in products if p.get("brand") != "waffle"]
        elif brand == "waffle":
            products = [p for p in products if p.get("brand") == "waffle"]

    if category and category != "All":
        products = [p for p in products if p.get("category") == category]

    if category_id:
        products = [p for p in products if p.get("categoryId") == category_id]

    if subcategory:
        products = [p for p in products if p.get("subcategory") == subcategory]

    if subcategory_id:
        products = [p for p in products if p.get("subcategoryId") == subcategory_id]

    if search:
        term = search.lower()
        products = [
            p for p in products
            if term in p.get("name", "").lower()
            or term in p.get("category", "").lower()
        ]

    return products


def get_product_by_id(product_id: str) -> Optional[dict]:
    """Get a single product by its ID."""
    products = _load_products()
    for p in products:
        if p.get("id") == product_id:
            return p
    return None


def add_product(product: dict) -> dict:
    """Add a new product. Auto-generates ID if missing."""
    products = _load_products()

    if "id" not in product or not product["id"]:
        # Auto-generate an ID based on name and count
        base = product.get("name", "product").lower().replace(" ", "-")
        existing = [p for p in products if p.get("id", "").startswith(base)]
        product["id"] = f"{base}-{len(existing) + 1}"

    # Ensure required fields
    product.setdefault("stock", 0)
    product.setdefault("rating", 0)
    product.setdefault("deliveryTime", "20 min")
    product.setdefault("image", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400")
    product.setdefault("subcategory", "")
    product.setdefault("subcategoryId", "")
    product.setdefault("categoryId", "")
    product.setdefault("type", "kart")
    product.setdefault("weight", "")

    products.append(product)
    _save_products(products)
    logger.info("Product added: {} ({})", product.get("name"), product.get("id"))
    return product


def update_product(product_id: str, updates: dict) -> Optional[dict]:
    """Update an existing product by ID. Returns updated product or None."""
    products = _load_products()
    for i, p in enumerate(products):
        if p.get("id") == product_id:
            updated = {**p, **updates, "id": product_id}
            products[i] = updated
            _save_products(products)
            logger.info("Product updated: {}", product_id)
            return updated
    return None


def delete_product(product_id: str) -> bool:
    """Delete a product by ID. Returns True if found and deleted."""
    products = _load_products()
    original_len = len(products)
    products = [p for p in products if p.get("id") != product_id]
    if len(products) < original_len:
        _save_products(products)
        logger.info("Product deleted: {}", product_id)
        return True
    return False


def get_categories(type_filter: Optional[str] = None) -> list[str]:
    """Get list of unique categories, optionally filtered by type or brand."""
    products = get_products(type_filter=type_filter)
    cats = sorted(set(p.get("category", "") for p in products if p.get("category")))
    return cats
