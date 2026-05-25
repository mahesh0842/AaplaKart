"""Category service — reads the categories.json data file."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from loguru import logger

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "categories.json"


def _load_sections() -> list[dict]:
    """Load all sections with nested categories/subcategories."""
    if not DATA_FILE.exists():
        logger.warning("categories.json not found at {}", DATA_FILE)
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_sections(sections: list[dict]) -> None:
    """Save the full sections list back to the JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(sections, f, indent=2, ensure_ascii=False)
    logger.info("Categories data saved ({} sections)", len(sections))


def get_sections(type_filter: Optional[str] = None) -> list[dict]:
    """Return all sections, optionally filtered by type (kart/app)."""
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
