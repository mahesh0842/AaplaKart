"""
Admin Catalog Routes — Category, Subcategory & Product CRUD.
Supports variant-based products (200g, 500g, 1kg), dynamic pricing, order limits.
All data stored in JSON files with in-memory cache.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from pydantic import BaseModel, Field

from app.middleware.auth_middleware import require_admin
from app.services.cache_service import load_json_data, save_json_data
from app.services.category_service import _load_sections, _save_sections

router = APIRouter(prefix="/admin/catalog", tags=["Admin Catalog"])


# ═══════════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════════

class SubcategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category_id: str = Field(..., min_length=1)
    section_type: str = Field(default="kart")

class SubcategoryUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    section_id: str = Field(..., min_length=1)
    image: str = ""
    subcategories: list[dict] = []

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    image: Optional[str] = None
    section_id: Optional[str] = None

class SectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="kart", description="kart or app")
    image: str = ""

class SectionUpdate(BaseModel):
    name: Optional[str] = None
    image: Optional[str] = None

class ProductOption(BaseModel):
    weight: str = Field(..., description="e.g. 200g, 500g, 1kg, 1pc, 500ml")
    price: float = Field(..., gt=0)
    stock: int = Field(default=0, ge=0)
    mrp: Optional[float] = Field(default=None, description="Strikethrough price")

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1)
    category_id: str = Field(..., min_length=1)
    subcategory: str = ""
    subcategory_id: str = ""
    type: str = Field(default="kart")
    brand: str = Field(default="kart")
    image: str = ""
    unit: str = Field(default="", description="g, kg, pcs, L, ml, packet")
    options: list[ProductOption] = []
    base_price: float = Field(default=0, gt=-1)
    stock: int = Field(default=0, ge=0)
    max_quantity: int = Field(default=10, ge=1, description="Max units per order")
    delivery_time: str = Field(default="20 min")
    rating: float = Field(default=4.5, ge=0, le=5)
    is_available: bool = True
    show_variants: bool = Field(default=False, description="Show variant selector in app")
    description: str = ""
    highlights: list[str] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[str] = None
    subcategory: Optional[str] = None
    subcategory_id: Optional[str] = None
    image: Optional[str] = None
    unit: Optional[str] = None
    options: Optional[list[ProductOption]] = None
    base_price: Optional[float] = None
    stock: Optional[int] = None
    max_quantity: Optional[int] = None
    delivery_time: Optional[str] = None
    rating: Optional[float] = None
    is_available: Optional[bool] = None
    show_variants: Optional[bool] = None
    description: Optional[str] = None
    highlights: Optional[list[str]] = None

class PriceUpdate(BaseModel):
    base_price: Optional[float] = None
    options: Optional[list[ProductOption]] = None

class StockUpdate(BaseModel):
    stock: Optional[int] = None
    options: Optional[list[dict]] = None  # [{ "weight": "200g", "stock": 10 }]


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

def _now():
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════════════════════════════════════
# SECTION CRUD
# ═══════════════════════════════════════════════════════════════════

@router.get("/sections")
async def list_sections_admin(user: dict = Depends(require_admin)):
    """List all sections."""
    sections = _load_sections()
    return {"success": True, "count": len(sections), "sections": [
        {"id": s["id"], "name": s["name"], "type": s.get("type","kart"), "image": s.get("image","")}
        for s in sections
    ]}

@router.post("/sections", status_code=status.HTTP_201_CREATED)
async def create_section(body: SectionCreate, user: dict = Depends(require_admin)):
    """Create a new section."""
    sections = _load_sections()
    sec_id = f"section-{body.name.lower().replace(' ', '-').replace('&', 'and')}"
    new_sec = {
        "id": sec_id,
        "name": body.name,
        "type": body.type,
        "image": body.image,
        "categories": [],
    }
    sections.append(new_sec)
    _save_sections(sections)
    return {"success": True, "section": new_sec}

@router.put("/sections/{section_id}")
async def update_section(section_id: str, body: SectionUpdate, user: dict = Depends(require_admin)):
    """Update section name/image."""
    sections = _load_sections()
    for sec in sections:
        if sec["id"] == section_id:
            if body.name: sec["name"] = body.name
            if body.image is not None: sec["image"] = body.image
            _save_sections(sections)
            return {"success": True, "section": sec}
    raise HTTPException(404, f"Section '{section_id}' not found")

@router.delete("/sections/{section_id}")
async def delete_section(section_id: str, user: dict = Depends(require_admin)):
    """Delete a section and all its categories."""
    sections = _load_sections()
    sections = [s for s in sections if s["id"] != section_id]
    _save_sections(sections)
    return {"success": True, "message": "Section deleted"}

# ═══════════════════════════════════════════════════════════════════
# CATEGORY CRUD
# ═══════════════════════════════════════════════════════════════════

@router.get("/categories")
async def list_categories_admin(
    section_id: Optional[str] = None,
    type_filter: Optional[str] = Query(None, alias="type"),
    user: dict = Depends(require_admin),
):
    """List all categories with subcategories (admin view)."""
    sections = _load_sections()
    result = []
    for sec in sections:
        if type_filter and sec.get("type") != type_filter:
            continue
        if section_id and sec.get("id") != section_id:
            continue
        for cat in sec.get("categories", []):
            result.append({
                "id": cat["id"],
                "name": cat["name"],
                "image": cat.get("image", ""),
                "section_id": sec["id"],
                "section_name": sec["name"],
                "section_type": sec["type"],
                "subcategories": cat.get("subcategories", []),
            })
    return {"success": True, "count": len(result), "categories": result}


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, user: dict = Depends(require_admin)):
    """Create a new category with optional subcategories."""
    sections = _load_sections()
    target_section = None
    for sec in sections:
        if sec["id"] == body.section_id:
            target_section = sec
            break
    if not target_section:
        raise HTTPException(404, f"Section '{body.section_id}' not found")

    cat_id = f"cat-{body.name.lower().replace(' ', '-').replace('&', 'and')}"
    new_cat = {
        "id": cat_id,
        "name": body.name,
        "image": body.image,
        "subcategories": body.subcategories or [],
    }
    target_section.setdefault("categories", []).append(new_cat)
    _save_sections(sections)
    logger.info(f"Category created: {cat_id} in section {body.section_id}")
    return {"success": True, "category": new_cat}


@router.put("/categories/{category_id}")
async def update_category(category_id: str, body: CategoryUpdate, user: dict = Depends(require_admin)):
    """Update category name, image, or move to different section."""
    sections = _load_sections()
    found = False
    for sec in sections:
        for i, cat in enumerate(sec.get("categories", [])):
            if cat["id"] == category_id:
                if body.name:
                    cat["name"] = body.name
                if body.image is not None:
                    cat["image"] = body.image
                found = True
                # Move to different section if requested
                if body.section_id and body.section_id != sec["id"]:
                    moved_cat = sec["categories"].pop(i)
                    for tsec in sections:
                        if tsec["id"] == body.section_id:
                            tsec.setdefault("categories", []).append(moved_cat)
                            break
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Category '{category_id}' not found")
    _save_sections(sections)
    return {"success": True, "message": f"Category '{category_id}' updated"}


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(require_admin)):
    """Delete a category."""
    sections = _load_sections()
    found = False
    for sec in sections:
        cats = sec.get("categories", [])
        for i, cat in enumerate(cats):
            if cat["id"] == category_id:
                cats.pop(i)
                found = True
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Category '{category_id}' not found")
    _save_sections(sections)
    return {"success": True, "message": f"Category '{category_id}' deleted"}


# ═══════════════════════════════════════════════════════════════════
# SUBCATEGORY CRUD
# ═══════════════════════════════════════════════════════════════════

@router.post("/subcategories", status_code=status.HTTP_201_CREATED)
async def create_subcategory(body: SubcategoryCreate, user: dict = Depends(require_admin)):
    """Add a subcategory to an existing category."""
    sections = _load_sections()
    found = False
    for sec in sections:
        if body.section_type and sec.get("type") != body.section_type:
            continue
        for cat in sec.get("categories", []):
            if cat["id"] == body.category_id:
                sub_id = f"sub-{body.name.lower().replace(' ', '-')}"
                new_sub = {"id": sub_id, "name": body.name}
                cat.setdefault("subcategories", []).append(new_sub)
                found = True
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Category '{body.category_id}' not found")
    _save_sections(sections)
    return {"success": True, "subcategory": {"id": sub_id, "name": body.name}}


@router.put("/subcategories/{subcategory_id}")
async def update_subcategory(
    subcategory_id: str, body: SubcategoryUpdate, user: dict = Depends(require_admin)
):
    """Rename or move a subcategory."""
    sections = _load_sections()
    found = False
    for sec in sections:
        for cat in sec.get("categories", []):
            for sub in cat.get("subcategories", []):
                if sub["id"] == subcategory_id:
                    if body.name:
                        sub["name"] = body.name
                    found = True
                    break
            if found:
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Subcategory '{subcategory_id}' not found")
    _save_sections(sections)
    return {"success": True, "message": f"Subcategory updated"}


@router.delete("/subcategories/{subcategory_id}")
async def delete_subcategory(subcategory_id: str, user: dict = Depends(require_admin)):
    """Delete a subcategory."""
    sections = _load_sections()
    found = False
    for sec in sections:
        for cat in sec.get("categories", []):
            subs = cat.get("subcategories", [])
            for i, sub in enumerate(subs):
                if sub["id"] == subcategory_id:
                    subs.pop(i)
                    found = True
                    break
            if found:
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Subcategory '{subcategory_id}' not found")
    _save_sections(sections)
    return {"success": True, "message": f"Subcategory deleted"}


# ═══════════════════════════════════════════════════════════════════
# PRODUCT CRUD (with variants, pricing, limits)
# ═══════════════════════════════════════════════════════════════════

PRODUCTS_FILE = "products"


def _load_prods() -> list[dict]:
    return load_json_data(PRODUCTS_FILE)


def _save_prods(prods: list[dict]):
    save_json_data(PRODUCTS_FILE, prods)
    logger.info(f"Products saved: {len(prods)} items")


@router.get("/products")
async def list_products_admin(
    category_id: Optional[str] = None,
    type_filter: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    """List all products with variant options (admin view)."""
    products = _load_prods()
    if type_filter:
        products = [p for p in products if p.get("type") == type_filter]
    if category_id:
        products = [p for p in products if p.get("categoryId") == category_id]
    if search:
        q = search.lower()
        products = [p for p in products if q in p.get("name", "").lower()]
    return {"success": True, "count": len(products), "products": products}


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, user: dict = Depends(require_admin)):
    """Create product with variant support (200g, 500g, 1kg etc)."""
    products = _load_prods()
    pid = f"kart-{body.name.lower().replace(' ', '-').replace('&', 'and')[:30]}"
    # Ensure unique ID
    existing = [p for p in products if p["id"] == pid]
    if existing:
        pid = f"{pid}-{len(existing) + 1}"

    new_product = {
        "id": pid,
        "name": body.name,
        "price": body.options[0].price if body.options else body.base_price,
        "category": body.category,
        "categoryId": body.category_id,
        "subcategory": body.subcategory,
        "subcategoryId": body.subcategory_id,
        "type": body.type,
        "brand": body.brand,
        "image": body.image,
        "unit": body.unit,
        "options": [o.model_dump() for o in body.options] if body.options else [],
        "stock": body.stock,
        "maxQuantity": body.max_quantity,
        "rating": body.rating,
        "deliveryTime": body.delivery_time,
        "isAvailable": body.is_available,
        "showVariants": body.show_variants,
        "description": body.description,
        "highlights": body.highlights,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    products.append(new_product)
    _save_prods(products)
    return {"success": True, "product": new_product}


@router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, user: dict = Depends(require_admin)):
    """Update product fields."""
    products = _load_prods()
    for i, p in enumerate(products):
        if p["id"] == product_id:
            for key, val in body.model_dump(exclude_unset=True).items():
                camel = {
                    "category_id": "categoryId", "subcategory_id": "subcategoryId",
                    "base_price": "price", "delivery_time": "deliveryTime",
                    "max_quantity": "maxQuantity", "is_available": "isAvailable",
                    "show_variants": "showVariants",
                }.get(key, key)
                if key == "options" and val is not None:
                    val = [o.model_dump() if hasattr(o, 'model_dump') else o for o in val]
                    # Update base price from first option
                    if val:
                        p["price"] = val[0]["price"]
                products[i][camel] = val
            products[i]["updatedAt"] = _now()
            _save_prods(products)
            return {"success": True, "product": products[i]}
    raise HTTPException(404, f"Product '{product_id}' not found")


@router.patch("/products/{product_id}/price")
async def update_product_price(product_id: str, body: PriceUpdate, user: dict = Depends(require_admin)):
    """Quick price update — daily price changes."""
    products = _load_prods()
    for i, p in enumerate(products):
        if p["id"] == product_id:
            if body.options is not None:
                p["options"] = [o.model_dump() for o in body.options]
                if p["options"]:
                    p["price"] = p["options"][0]["price"]
            elif body.base_price is not None:
                p["price"] = body.base_price
            p["updatedAt"] = _now()
            _save_prods(products)
            return {"success": True, "product": p, "message": "Price updated"}
    raise HTTPException(404, f"Product '{product_id}' not found")


@router.patch("/products/{product_id}/stock")
async def update_product_stock(product_id: str, body: StockUpdate, user: dict = Depends(require_admin)):
    """Quick stock update."""
    products = _load_prods()
    for i, p in enumerate(products):
        if p["id"] == product_id:
            if body.options is not None:
                for opt_update in body.options:
                    for opt in p.get("options", []):
                        if opt.get("weight") == opt_update.get("weight"):
                            opt["stock"] = opt_update.get("stock", opt["stock"])
            if body.stock is not None:
                p["stock"] = body.stock
            p["updatedAt"] = _now()
            _save_prods(products)
            return {"success": True, "product": p, "message": "Stock updated"}
    raise HTTPException(404, f"Product '{product_id}' not found")


@router.patch("/products/{product_id}/toggle-variants")
async def toggle_product_variants(product_id: str, user: dict = Depends(require_admin)):
    """Quick toggle showVariants on/off from product list — no full form needed."""
    products = _load_prods()
    for p in products:
        if p["id"] == product_id:
            p["showVariants"] = not p.get("showVariants", False)
            p["updatedAt"] = _now()
            _save_prods(products)
            return {"success": True, "product": p, "showVariants": p["showVariants"]}
    raise HTTPException(404, f"Product '{product_id}' not found")


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_admin)):
    """Delete a product."""
    products = _load_prods()
    products = [p for p in products if p["id"] != product_id]
    _save_prods(products)
    return {"success": True, "message": f"Product '{product_id}' deleted"}


@router.patch("/products/batch-price")
async def batch_update_prices(body: list[dict], user: dict = Depends(require_admin)):
    """Batch update prices for multiple products at once."""
    products = _load_prods()
    updated = 0
    for item in body:
        pid = item.get("id")
        new_price = item.get("price")
        new_options = item.get("options")
        if not pid:
            continue
        for p in products:
            if p["id"] == pid:
                if new_options:
                    p["options"] = new_options
                    if new_options:
                        p["price"] = new_options[0]["price"]
                elif new_price is not None:
                    p["price"] = new_price
                p["updatedAt"] = _now()
                updated += 1
                break
    _save_prods(products)
    return {"success": True, "updated": updated, "message": f"{updated} products updated"}
