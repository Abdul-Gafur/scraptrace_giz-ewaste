"""Alembic environment: runs migrations over the application's async engine."""

from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from apps.api.app.db import models  # noqa: F401  (registers every table)
from apps.api.app.db.base import Base
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logging", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def database_url() -> str:
    url = config.attributes.get("database_url") or os.getenv("SCRAPTRACE_DATABASE_URL")
    if not url:
        raise RuntimeError("Set SCRAPTRACE_DATABASE_URL before running migrations.")
    return str(url)


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=connection.dialect.name == "sqlite",
    )


def run_migrations_offline() -> None:
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    _configure(connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(database_url())
    try:
        async with engine.connect() as connection:
            if connection.dialect.name == "sqlite":
                await connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            await connection.run_sync(_run_sync)
            await connection.commit()
    finally:
        await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
