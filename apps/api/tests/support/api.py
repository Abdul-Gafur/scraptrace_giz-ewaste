"""Helpers for authenticated API tests."""

from __future__ import annotations

import asyncio
from typing import Any

from apps.api.app.api.security import SESSION_COOKIE_NAME
from apps.api.app.core.config import Settings
from apps.api.app.core.passwords import PasswordService
from apps.api.app.db.session import Database
from apps.api.app.seed import seed_reference_data
from fastapi.testclient import TestClient

DEMO_PASSWORD = "demonstration-password"
ALLOWED_ORIGIN = "http://localhost:3000"


async def _seed(settings: Settings) -> None:
    database = Database(settings)
    await database.start()
    try:
        async with database.session_scope() as session, session.begin():
            await seed_reference_data(session, PasswordService(settings), DEMO_PASSWORD)
    finally:
        await database.stop()


def seed_database(settings: Settings) -> None:
    asyncio.run(_seed(settings))


def sign_in_response(client: TestClient, username: str, password: str = DEMO_PASSWORD) -> Any:
    response = client.post("/v1/auth/sessions", json={"username": username, "password": password})
    assert response.status_code == 201, response.text
    return response


def sign_in(client: TestClient, username: str, password: str = DEMO_PASSWORD) -> dict[str, Any]:
    return dict(sign_in_response(client, username, password).json()["data"])


def session_token(client: TestClient, username: str) -> str:
    """The session credential, which the API delivers only in the HttpOnly cookie."""
    token = sign_in_response(client, username).cookies.get(SESSION_COOKIE_NAME)
    assert token, "sign-in must set the session cookie"
    return str(token)


def auth(client: TestClient, username: str) -> dict[str, str]:
    """Bearer headers for a seeded account, as a non-browser client would send them."""
    return {"Authorization": f"Bearer {session_token(client, username)}"}


async def run_with_database(settings: Settings, operation: Any) -> Any:
    database = Database(settings)
    await database.start()
    try:
        async with database.session_scope() as session:
            return await operation(session)
    finally:
        await database.stop()


def query(settings: Settings, operation: Any) -> Any:
    """Runs `operation(session)` against the test database from synchronous test code."""
    return asyncio.run(run_with_database(settings, operation))
