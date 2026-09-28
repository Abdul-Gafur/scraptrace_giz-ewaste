"""Isolated test databases built by the real migrations.

By default each test receives a copy of a SQLite file migrated once per session. Set
`SCRAPTRACE_TEST_DATABASE_URL` to a disposable PostgreSQL database to run the same suite against
PostgreSQL: the schema is rebuilt by migration once per session and every table is truncated
before each test (TRUNCATE bypasses the append-only row triggers by design).
"""

from __future__ import annotations

import asyncio
import os

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from apps.api.app.core.config import API_ROOT
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

TEST_DATABASE_URL = os.getenv("SCRAPTRACE_TEST_DATABASE_URL")


def alembic_config(url: str) -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    config.attributes["database_url"] = url
    config.attributes["configure_logging"] = False
    return config


def upgrade(url: str, revision: str = "head") -> None:
    command.upgrade(alembic_config(url), revision)


def downgrade(url: str, revision: str = "base") -> None:
    command.downgrade(alembic_config(url), revision)


async def _execute(url: str, statements: list[str], autocommit: bool = False) -> None:
    engine = create_async_engine(
        url, isolation_level="AUTOCOMMIT" if autocommit else "READ COMMITTED"
    )
    try:
        async with engine.begin() as connection:
            for statement in statements:
                await connection.execute(sa.text(statement))
    finally:
        await engine.dispose()


def reset_postgres_schema(url: str) -> None:
    asyncio.run(_execute(url, ["DROP SCHEMA IF EXISTS public CASCADE", "CREATE SCHEMA public"]))


async def _truncate(url: str) -> None:
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            tables = (
                await connection.execute(
                    sa.text(
                        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
                        "AND tablename <> 'alembic_version'"
                    )
                )
            ).scalars()
            names = ", ".join(f'"{name}"' for name in tables)
            if names:
                await connection.execute(sa.text(f"TRUNCATE TABLE {names} CASCADE"))
    finally:
        await engine.dispose()


def truncate_postgres(url: str) -> None:
    asyncio.run(_truncate(url))


def fresh_postgres_database(url: str, suffix: str) -> str:
    """Creates (or recreates) an empty sibling database for migration tests."""
    parsed = make_url(url)
    name = f"{parsed.database}_{suffix}"
    admin = parsed.set(database="postgres").render_as_string(hide_password=False)
    asyncio.run(
        _execute(
            admin,
            [f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)', f'CREATE DATABASE "{name}"'],
            autocommit=True,
        )
    )
    return parsed.set(database=name).render_as_string(hide_password=False)
