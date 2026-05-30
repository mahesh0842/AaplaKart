"""In-memory cache service for product, category, and config data.
Reads JSON files once, caches in memory, instant reads thereafter.
Auto-invalidates on write. NO Firestore dependency for reads.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from loguru import logger

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# ── Simple in-memory cache ──────────────────────────────────────

_cache: dict[str, list[dict]] = {}
_file_paths: dict[str, Path] = {}

def _get_file(name: str) -> Path:
    if name not in _file_paths:
        _file_paths[name] = DATA_DIR / f"{name}.json"
    return _file_paths[name]

def cache_get(name: str) -> list[dict] | None:
    """Get data from cache. Returns None if not cached."""
    return _cache.get(name)

def cache_set(name: str, data: list[dict]) -> None:
    """Store data in cache."""
    _cache[name] = data

def cache_invalidate(name: str) -> None:
    """Remove a specific cache entry."""
    _cache.pop(name, None)

def cache_invalidate_all() -> None:
    """Clear entire cache."""
    _cache.clear()


# ── Load from JSON (with memory cache) ─────────────────────────

def load_json_data(name: str) -> list[dict]:
    """Load JSON data with in-memory cache. Instant on repeated calls."""
    # Check memory cache first
    cached = cache_get(name)
    if cached is not None:
        return cached

    # Load from file
    file = _get_file(name)
    if not file.exists():
        logger.warning(f"{name}.json not found at {file}")
        return []

    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Cache in memory
    cache_set(name, data)
    logger.debug(f"[Cache] Loaded {len(data)} items from {name}.json")
    return data


# ── Save to JSON (and invalidate cache) ────────────────────────

def save_json_data(name: str, data: list[dict]) -> None:
    """Save data to JSON file and update memory cache."""
    file = _get_file(name)
    file.parent.mkdir(parents=True, exist_ok=True)
    with open(file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    # Update cache
    cache_set(name, data)
    logger.debug(f"[Cache] Saved {len(data)} items to {name}.json")


def save_json_dict(name: str, data: dict) -> None:
    """Save a single dict to JSON file and update memory cache."""
    file = _get_file(name)
    file.parent.mkdir(parents=True, exist_ok=True)
    with open(file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    cache_set(name, [data])
    logger.debug(f"[Cache] Saved dict to {name}.json")
