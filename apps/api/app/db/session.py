"""Engine and session lifecycle.

One `Database` instance belongs to one application. Sessions are short-lived and every
lifecycle-changing operation runs inside a single explicit transaction (`session.begin()`), so a
failure anywhere in the operation rolls back every row it touched.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import sqlalchemy as sa
from apps.api.app.core.config import ConfigurationError, Settings
from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

LOGGER = logging.getLogger("scraptrace.database")


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def create_engine_from_settings(settings: Settings) -> AsyncEngine:
    if settings.database_url is None:
        raise ConfigurationError(
            "Missing required configuration: SCRAPTRACE_DATABASE_URL. See apps/api/.env.example."
        )
    try:
        url = make_url(settings.database_url.get_secret_value())
    except ArgumentError as exc:
        # The URL may contain credentials, so the message never repeats it.
        raise ConfigurationError("SCRAPTRACE_DATABASE_URL is not a valid database URL.") from exc

    if url.get_backend_name() == "sqlite":
        engine = create_async_engine(url)
        event.listen(engine.sync_engine, "connect", _enable_sqlite_foreign_keys)
        return engine

    statement_timeout_ms = int(settings.database_statement_timeout_seconds * 1000)
    return create_async_engine(
        url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout_seconds,
        pool_pre_ping=True,
        connect_args={
            "timeout": settings.database_pool_timeout_seconds,
            "server_settings": {
                "statement_timeout": str(statement_timeout_ms),
                "application_name": "scraptrace-api",
                "timezone": "UTC",
            },
        },
    )


class Database:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engine: AsyncEngine | None = None
        self._sessions: async_sessionmaker[AsyncSession] | None = None

    @property
    def engine(self) -> AsyncEngine:
        if self._engine is None:
            raise RuntimeError("The database has not been started.")
        return self._engine

    async def start(self) -> None:
        if self._engine is not None:
            return
        self._engine = create_engine_from_settings(self._settings)
        self._sessions = async_sessionmaker(self._engine, expire_on_commit=False, autoflush=False)
        if not await self.is_reachable():
            # An unreachable database degrades readiness rather than crashing the process;
            # requests that need persistence return DEPENDENCY_UNAVAILABLE.
            LOGGER.warning("database_unreachable_at_startup")

    async def stop(self) -> None:
        if self._engine is not None:
            await self._engine.dispose()
        self._engine = None
        self._sessions = None

    def session(self) -> AsyncSession:
        if self._sessions is None:
            raise RuntimeError("The database has not been started.")
        return self._sessions()

    @asynccontextmanager
    async def session_scope(self) -> AsyncIterator[AsyncSession]:
        session = self.session()
        try:
            yield session
        finally:
            await session.close()

    async def is_reachable(self) -> bool:
        try:
            async with self.engine.connect() as connection:
                await connection.execute(sa.text("SELECT 1"))
        except (SQLAlchemyError, OSError, TimeoutError):
            return False
        return True

    async def schema_revision(self) -> str | None:
        """The applied Alembic revision, or None when migrations have not been applied."""
        try:
            async with self.engine.connect() as connection:
                result = await connection.execute(
                    sa.text("SELECT version_num FROM alembic_version")
                )
                row = result.first()
        except (SQLAlchemyError, OSError, TimeoutError):
            return None
        return None if row is None else str(row[0])
