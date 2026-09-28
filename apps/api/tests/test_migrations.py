"""Migrations build the schema from an empty database, reverse cleanly and match the models."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from apps.api.app.db import models  # noqa: F401
from apps.api.app.db.base import Base
from apps.api.tests.support.database import (
    TEST_DATABASE_URL,
    alembic_config,
    downgrade,
    fresh_postgres_database,
    upgrade,
)
from sqlalchemy.ext.asyncio import create_async_engine

EXPECTED_TABLES = {
    "audit_events",
    "evidence",
    "facility_locations",
    "handoffs",
    "idempotency_records",
    "processing_records",
    "programmes",
    "qr_lookup_tokens",
    "recovered_material_entries",
    "recovery_record_events",
    "recovery_records",
    "recycler_facilities",
    "review_cases",
    "review_decisions",
    "user_roles",
    "users",
}


@pytest.fixture
def empty_database_url(tmp_path: Path) -> str:
    if TEST_DATABASE_URL:
        return fresh_postgres_database(TEST_DATABASE_URL, "migrations")
    return f"sqlite+aiosqlite:///{tmp_path / 'empty.sqlite3'}"


async def _inspect(url: str) -> tuple[set[str], str | None, list[object]]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:

            def read(sync_connection: sa.Connection) -> tuple[set[str], str | None, list[object]]:
                tables = set(sa.inspect(sync_connection).get_table_names()) - {"alembic_version"}
                context = MigrationContext.configure(sync_connection)
                drift = compare_metadata(context, Base.metadata)
                return tables, context.get_current_revision(), list(drift)

            return await connection.run_sync(read)
    finally:
        await engine.dispose()


def test_migrations_apply_to_an_empty_database(empty_database_url: str) -> None:
    upgrade(empty_database_url)
    tables, revision, drift = asyncio.run(_inspect(empty_database_url))
    head = ScriptDirectory.from_config(alembic_config(empty_database_url)).get_current_head()
    assert tables == EXPECTED_TABLES
    assert revision == head
    assert drift == [], "models and migrations disagree"


def test_migrations_reverse_to_a_clean_state_and_reapply(empty_database_url: str) -> None:
    upgrade(empty_database_url)
    downgrade(empty_database_url)
    tables, revision, _ = asyncio.run(_inspect(empty_database_url))
    assert tables == set()
    assert revision is None
    upgrade(empty_database_url)
    tables, revision, drift = asyncio.run(_inspect(empty_database_url))
    assert tables == EXPECTED_TABLES
    assert drift == []
