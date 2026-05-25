"""Product routes — CRUD + filtering + pagination + stock toggle."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.middleware.auth_middleware import require_admin
from app.models.product import (
    CategoriesResponse,
    CreateProductRequest,
    ProductResponse,
    ProductsResponse,
    ProductSchema,
    UpdateProductRequest,
)
from app.services.product_service import (
    add_product,
    delete_product,
    get_categories,
    get_product_by_id,
    get_products,
    update_product,
)

router = APIRouter(prefix="/products", tags=["Products"])


# ── GET /products — list with filters + pagination ────────────────

@router.get("", response_model=ProductsResponse)
async def list_products(
    type: str | None = Query(None, description="Filter by type: kart, app, or all"),
    brand: str | None = Query(None, description="Filter by brand: kart, waffle, or all"),
    category: str | None = Query(None, description="Filter by category name"),
    category_id: str | None = Query(None, description="Filter by category ID"),
    subcategory: str | None = Query(None, description="Filter by subcategory name"),
    subcategory_id: str | None = Query(None, description="Filter by subcategory ID"),
    search: str | None = Query(None, description="Search in product name & category"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
):
    all_products = get_products(
        type_filter=type if type and type != "all" else None,
        brand=brand if brand and brand != "all" else None,
        category=category if category and category != "All" else None,
        category_id=category_id,
        subcategory=subcategory if subcategory else None,
        subcategory_id=subcategory_id,
        search=search if search else None,
    )

    # Pagination
    total = len(all_products)
    start = (page - 1) * page_size
    end = start + page_size
    page_products = all_products[start:end]

    return ProductsResponse(
        success=True,
        count=total,
        page=page,
        page_size=page_size,
        products=[ProductSchema(**p) for p in page_products],
    )


# ── GET /products/{product_id} ────────────────────────────────────

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductResponse(success=True, product=ProductSchema(**product))


# ── POST /products — create new product ──────────────────────────

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(body: CreateProductRequest, user: dict = Depends(require_admin)):
    product = add_product(body.model_dump())
    return ProductResponse(success=True, product=ProductSchema(**product))


# ── PUT /products/{product_id} — update existing product ─────────

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product_endpoint(product_id: str, body: UpdateProductRequest, user: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    product = update_product(product_id, updates)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductResponse(success=True, product=ProductSchema(**product))


# ── PATCH /products/{product_id}/status — toggle stock ───────────

@router.patch("/{product_id}/status", response_model=ProductResponse)
async def toggle_product_status(product_id: str, body: dict, user: dict = Depends(require_admin)):
    stock = body.get("stock")
    if stock is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="stock field required")
    product = update_product(product_id, {"stock": stock})
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductResponse(success=True, product=ProductSchema(**product))


# ── DELETE /products/{product_id} ─────────────────────────────────

@router.delete("/{product_id}", response_model=dict)
async def delete_product_endpoint(product_id: str, user: dict = Depends(require_admin)):
    deleted = delete_product(product_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return {"success": True, "message": f"Product {product_id} deleted"}


# ── GET /products/categories/list — category names ────────────────

@router.get("/categories/list", response_model=CategoriesResponse)
async def list_categories(
    type: str | None = Query(None, description="Filter categories by type"),
):
    cats = get_categories(type_filter=type if type and type != "all" else None)
    return CategoriesResponse(success=True, categories=cats)
