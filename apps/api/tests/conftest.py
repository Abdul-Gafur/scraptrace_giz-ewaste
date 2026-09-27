from __future__ import annotations

import io
import shutil
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from apps.api.app.core.config import Settings
from apps.api.app.db.session import Database
from apps.api.app.main import create_app
from apps.api.tests.support.database import (
    TEST_DATABASE_URL,
    reset_postgres_schema,
    truncate_postgres,
    upgrade,
)
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import SecretStr
from services.vision.predictor import InferenceError, ModelLoadError

SCORES = [
    {"category": "refrigerators", "score": 0.03},
    {"category": "laptops_and_desktop_computers", "score": 0.04},
    {"category": "televisions", "score": 0.8},
    {"category": "microwaves", "score": 0.03},
    {"category": "air_conditioners", "score": 0.04},
    {"category": "compressors", "score": 0.03},
    {"category": "mixed_scrap", "score": 0.03},
]


CLASSIFIED_RESPONSE = {
    "outcome": "classified",
    "category": "televisions",
    "scores": SCORES,
    "confidence": 0.8,
    "model_name": "scraptrace-vision-efficientnet-b0",
    "model_version": "0.2.0",
    "inferred_at": "2026-09-26T12:30:00.000Z",
}


class FakePredictor:
    def __init__(
        self,
        response: dict[str, Any] | None = None,
        load_failure: bool = False,
        inference_failure: bool = False,
    ) -> None:
        self.response = response or CLASSIFIED_RESPONSE
        self.load_failure = load_failure
        self.inference_failure = inference_failure
        self.ready = False
        self.load_error: str | None = "not loaded"

    def load(self) -> None:
        if self.load_failure:
            self.load_error = "fixture model unavailable"
            raise ModelLoadError(self.load_error)
        self.ready = True
        self.load_error = None

    def is_ready(self) -> bool:
        return self.ready

    def appraise(
        self, image: Image.Image, confidence_threshold: float, ambiguity_margin: float
    ) -> dict[str, Any]:
        assert image.mode == "RGB"
        assert 0 <= confidence_threshold <= 1
        assert 0 <= ambiguity_margin <= 1
        if self.inference_failure:
            raise InferenceError("fixture inference failed")
        return self.response


@pytest.fixture(scope="session")
def migrated_template(tmp_path_factory: pytest.TempPathFactory) -> str | Path:
    """The fully migrated schema, built once per session by the real Alembic migrations."""
    if TEST_DATABASE_URL:
        reset_postgres_schema(TEST_DATABASE_URL)
        upgrade(TEST_DATABASE_URL)
        return TEST_DATABASE_URL
    template = tmp_path_factory.mktemp("database") / "template.sqlite3"
    upgrade(f"sqlite+aiosqlite:///{template}")
    return template


@pytest.fixture
def database_url(migrated_template: str | Path, tmp_path_factory: pytest.TempPathFactory) -> str:
    """An isolated, migrated database for one test, kept outside the test's own `tmp_path`."""
    if TEST_DATABASE_URL:
        truncate_postgres(TEST_DATABASE_URL)
        return TEST_DATABASE_URL
    target = tmp_path_factory.mktemp("database") / "scraptrace-test.sqlite3"
    shutil.copyfile(Path(migrated_template), target)
    return f"sqlite+aiosqlite:///{target}"


def build_settings(database_url: str, **overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "environment": "test",
        "database_url": SecretStr(database_url),
        # Test-only hashing cost; production defaults are Argon2id t=3, m=64 MiB.
        "password_hash_time_cost": 1,
        "password_hash_memory_cost_kib": 8,
        "password_hash_parallelism": 1,
    }
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def settings(database_url: str) -> Settings:
    return build_settings(database_url, maximum_upload_bytes=2048)


@pytest.fixture
async def database(settings: Settings) -> AsyncIterator[Database]:
    instance = Database(settings)
    await instance.start()
    try:
        yield instance
    finally:
        await instance.stop()


@pytest.fixture
def predictor() -> FakePredictor:
    return FakePredictor()


@pytest.fixture
def client(settings: Settings, predictor: FakePredictor):
    with TestClient(create_app(settings=settings, predictor=predictor)) as test_client:
        yield test_client


def image_bytes(format_name: str = "JPEG", size: tuple[int, int] = (32, 32)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, color=(70, 90, 120)).save(output, format=format_name)
    return output.getvalue()
