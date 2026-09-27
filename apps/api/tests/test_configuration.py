"""Configuration fails clearly; database readiness reports migration state without detail."""

from __future__ import annotations

from pathlib import Path

import pytest
from apps.api.app.core.config import ConfigurationError, Settings
from apps.api.app.main import create_app
from apps.api.tests.conftest import FakePredictor, build_settings
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError


@pytest.mark.parametrize(
    "overrides",
    [
        {"database_url": SecretStr("mysql://user@localhost/scraptrace")},
        {"database_url": SecretStr("postgresql://user@localhost/scraptrace")},
        {"environment": "development", "database_url": SecretStr("sqlite+aiosqlite:///x.db")},
        {"allowed_origins": ("*",)},
        {"auth_token_secret": SecretStr("too-short")},
        {"auth_token_secret": SecretStr("change-me-" + "x" * 40)},
        {
            "environment": "production",
            "database_url": SecretStr("postgresql+asyncpg://u@h/db"),
            "auth_cookie_secure": False,
        },
        {"environment": "production", "enable_demo_account_discovery": True},
    ],
)
def test_invalid_configuration_is_rejected(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        Settings(**overrides)  # type: ignore[arg-type]


def test_invalid_configuration_messages_never_echo_secret_values() -> None:
    secret = "postgresql://operator:very-secret-password@db.internal/scraptrace"
    with pytest.raises(ValidationError) as failure:
        Settings(database_url=SecretStr(secret))
    assert "very-secret-password" not in str(failure.value)


def test_missing_database_url_stops_startup_with_a_named_variable() -> None:
    application = create_app(settings=Settings(environment="test"), predictor=FakePredictor())
    with pytest.raises(ConfigurationError) as failure, TestClient(application):
        pass
    assert "SCRAPTRACE_DATABASE_URL" in str(failure.value)


def test_database_readiness_reports_a_migrated_schema(client: TestClient) -> None:
    response = client.get("/health/database")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "schema_current": True}


def test_database_readiness_fails_safely_before_migration(tmp_path: Path) -> None:
    unmigrated = build_settings(f"sqlite+aiosqlite:///{tmp_path / 'empty.sqlite3'}")
    with TestClient(create_app(settings=unmigrated, predictor=FakePredictor())) as client:
        response = client.get("/health/database", headers={"X-Request-ID": "request-db-0001"})
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "DEPENDENCY_UNAVAILABLE"
    assert body["meta"]["correlation_id"] == "request-db-0001"
    assert "sqlite" not in response.text.lower()
