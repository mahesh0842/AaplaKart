"""Category routes — sections, categories, subcategories."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.category import (
    CategoriesResponse,
    CategorySchema,
    SectionSchema,
    SectionsResponse,
    SubcategorySchema,
)
from app.services.category_service import (
    get_categories,
    get_sections,
    get_subcategories,
)

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/sections", response_model=SectionsResponse)
async def list_sections(
    type: str | None = Query(None, description="Filter by type: kart, app, or all"),
):
    sections = get_sections(type_filter=type if type and type != "all" else None)
    return SectionsResponse(
        success=True,
        sections=[SectionSchema(**s) for s in sections],
    )


@router.get("", response_model=CategoriesResponse)
async def list_categories(
    type: str | None = Query(None, description="Filter by type: kart, app, or all"),
    section_id: str | None = Query(None, description="Filter by section ID"),
):
    cats = get_categories(
        type_filter=type if type and type != "all" else None,
        section_id=section_id,
    )
    return CategoriesResponse(
        success=True,
        categories=[CategorySchema(**c) for c in cats],
    )


@router.get("/subcategories", response_model=dict)
async def list_subcategories(
    category_id: str | None = Query(None, description="Filter by category ID"),
    type: str | None = Query(None, description="Filter by type: kart, app"),
):
    subs = get_subcategories(
        category_id=category_id,
        type_filter=type if type and type != "all" else None,
    )
    return {
        "success": True,
        "subcategories": [SubcategorySchema(**s) for s in subs],
    }
