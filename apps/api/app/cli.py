"""Operational commands. Run from the repository root:

    PYTHONPATH=. .venv/bin/python -m apps.api.app.cli seed
    PYTHONPATH=. .venv/bin/python -m apps.api.app.cli purge-idempotency

Migrations use Alembic directly (`npm run api:db:migrate`).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from apps.api.app.core.config import ConfigurationError, Settings, get_settings
from apps.api.app.core.passwords import MINIMUM_PASSWORD_LENGTH, PasswordService
from apps.api.app.db.session import Database
from apps.api.app.domain.time import utc_now
from apps.api.app.repositories.operations import IdempotencyRepository
from apps.api.app.seed import seed_reference_data


async def run_seed(settings: Settings, demo_password: str, reset_passwords: bool) -> str:
    database = Database(settings)
    await database.start()
    try:
        async with database.session_scope() as session, session.begin():
            report = await seed_reference_data(
                session, PasswordService(settings), demo_password, reset_passwords=reset_passwords
            )
    finally:
        await database.stop()
    return (
        f"Seed complete: {report.created} created, {report.unchanged} already present, "
        f"{report.passwords_reset} passwords reset."
    )


async def run_purge(settings: Settings) -> str:
    database = Database(settings)
    await database.start()
    try:
        async with database.session_scope() as session, session.begin():
            removed = await IdempotencyRepository(session).purge_expired(utc_now())
    finally:
        await database.stop()
    return f"Removed {removed} expired idempotency records."


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scraptrace-api")
    commands = parser.add_subparsers(dest="command", required=True)
    seed = commands.add_parser("seed", help="Load deterministic demonstration data.")
    seed.add_argument(
        "--reset-passwords",
        action="store_true",
        help="Re-hash every demo account with the current SCRAPTRACE_SEED_DEMO_PASSWORD.",
    )
    commands.add_parser("purge-idempotency", help="Delete expired idempotency records.")
    arguments = parser.parse_args(argv)

    try:
        settings = get_settings()
        settings.require_runtime_configuration()
    except (ConfigurationError, ValueError) as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 2

    if arguments.command == "seed":
        if settings.environment == "production":
            print("Refusing to load demonstration accounts in production.", file=sys.stderr)
            return 2
        demo_password = os.getenv("SCRAPTRACE_SEED_DEMO_PASSWORD", "")
        if len(demo_password) < MINIMUM_PASSWORD_LENGTH:
            print(
                "Set SCRAPTRACE_SEED_DEMO_PASSWORD to a password of at least "
                f"{MINIMUM_PASSWORD_LENGTH} characters.",
                file=sys.stderr,
            )
            return 2
        print(asyncio.run(run_seed(settings, demo_password, arguments.reset_passwords)))
        return 0
    print(asyncio.run(run_purge(settings)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
