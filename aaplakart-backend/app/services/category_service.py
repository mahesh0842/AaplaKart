"""Category service — reads categories.json with in-memory cache."""

from __future__ import annotations

from typing import Optional
from loguru import logger
from app.services.cache_service import load_json_data, save_json_data

DATA_NAME = "categories"

def _load_sections() -> list[dict]:
    return load_json_data(DATA_NAME)

def _save_sections(sections: list[dict]) -> None:
    save_json_data(DATA_NAME, sections)
    logger.info("Categories data saved ({} sections)", len(sections))


def get_sections(type_filter: Optional[str] = None) -> list[dict]:
    sections = _load_sections()
    if type_filter and type_filter != "all":
        sections = [s for s in sections if s.get("type") == type_filter]
    return sections


def get_categories(
    type_filter: Optional[str] = None,
    section_id: Optional[str] = None,
) -> list[dict]:
    """Return flat list of all categories, optionally filtered."""
    sections = get_sections(type_filter)
    cats = []
    for sec in sections:
        if section_id and sec.get("id") != section_id:
            continue
        for cat in sec.get("categories", []):
            cat["sectionId"] = sec["id"]
            cat["sectionName"] = sec["name"]
            cat["type"] = sec["type"]
            cats.append(cat)
    return cats


def get_category_by_id(category_id: str) -> Optional[dict]:
    """Find a single category by its ID."""
    for cat in get_categories():
        if cat.get("id") == category_id:
            return cat
    return None


def get_subcategories(
    category_id: Optional[str] = None,
    type_filter: Optional[str] = None,
) -> list[dict]:
    """Return all subcategories, optionally filtered by category or type."""
    cats = get_categories(type_filter)
    subs = []
    for cat in cats:
        if category_id and cat.get("id") != category_id:
            continue
        for sub in cat.get("subcategories", []):
            sub["categoryId"] = cat["id"]
            sub["categoryName"] = cat["name"]
            subs.append(sub)
    return subs
