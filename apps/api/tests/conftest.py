from __future__ import annotations

import io
from typing import Any

import pytest
from apps.api.app.core.config import Settings
from apps.api.app.main import create_app
from fastapi.testclient import TestClient
from PIL import Image
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


@pytest.fixture
def settings() -> Settings:
    return Settings(environment="test", maximum_upload_bytes=2048)


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
