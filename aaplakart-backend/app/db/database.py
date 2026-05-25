"""Database engine and session management.

Supports both SQLite (local dev) and Cloud SQL PostgreSQL (production).
Configure via environment variables in .env – see ``.env.example`` for details.
"""

from __future__ import annotations

import os

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# ── Database URL ───────────────────────────────────────────────────
# SQLite for local dev; override with DATABASE_URL for Cloud SQL
_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./aaplakart.db",
)

_engine = create_async_engine(_DATABASE_URL, echo=False, future=True)

_async_session_factory = async_sessionmaker(
    _engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables (safe to call on every startup)."""
    from app.db import models  # noqa: F401 – ensure models are loaded

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready (engine={})", _DATABASE_URL)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """Yield an async session – use as a FastAPI dependency."""
    async with _async_session_factory() as session:
        yield session


async def close_db() -> None:
    await _engine.dispose()
