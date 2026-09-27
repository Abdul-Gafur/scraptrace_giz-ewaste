from __future__ import annotations

import tempfile
import time
from pathlib import Path

from apps.api.app.core.config import REPOSITORY_ROOT, Settings
from apps.api.app.main import create_app
from apps.api.tests.conftest import CLASSIFIED_RESPONSE, FakePredictor, image_bytes
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator


def post_image(client: TestClient, content: bytes, content_type: str = "image/jpeg"):
    return client.post(
        "/v1/vision/appraise",
        files={"image": ("untrusted-name.jpg", content, content_type)},
        data={"evidence_id": "0199a111-1111-7111-8111-111111111111"},
    )


def test_valid_jpeg_matches_generated_contract(client: TestClient) -> None:
    response = post_image(client, image_bytes("JPEG"))
    assert response.status_code == 200
    schema = __import__("json").loads(
        (
            REPOSITORY_ROOT / "packages/contracts/schemas/vision_appraisal_response.schema.json"
        ).read_text(encoding="utf-8")
    )
    Draft202012Validator(schema).validate(response.json())


def test_valid_png(client: TestClient) -> None:
    response = post_image(client, image_bytes("PNG"), "image/png")
    assert response.status_code == 200


def test_unsupported_media_type(client: TestClient) -> None:
    response = post_image(client, b"GIF89a", "image/gif")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "VALIDATION_FAILED"


def test_empty_upload(client: TestClient) -> None:
    response = post_image(client, b"")
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"][0]["reason"] == "empty"


def test_corrupt_image(client: TestClient) -> None:
    response = post_image(client, b"not an image")
    assert response.status_code == 422
    assert "Traceback" not in response.text


def test_oversized_upload(client: TestClient) -> None:
    response = post_image(client, b"x" * 2049)
    assert response.status_code == 413
    assert response.json()["error"]["safe_details"]["maximum_upload_bytes"] == 2048


def test_excessive_dimensions(settings: Settings) -> None:
    constrained = settings.model_copy(
        update={"maximum_upload_bytes": 20_000, "maximum_image_width": 224}
    )
    with TestClient(create_app(settings=constrained, predictor=FakePredictor())) as client:
        response = post_image(client, image_bytes("PNG", (225, 32)), "image/png")
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"][0]["reason"] == "maximum_dimensions_exceeded"


def test_low_confidence_response(settings: Settings) -> None:
    low_confidence = {
        "outcome": "unable_to_classify",
        "reason": "low_confidence",
        "scores": CLASSIFIED_RESPONSE["scores"],
        "model_name": CLASSIFIED_RESPONSE["model_name"],
        "model_version": CLASSIFIED_RESPONSE["model_version"],
        "inferred_at": CLASSIFIED_RESPONSE["inferred_at"],
    }
    with TestClient(
        create_app(settings=settings, predictor=FakePredictor(response=low_confidence))
    ) as client:
        response = post_image(client, image_bytes())
    assert response.status_code == 200
    assert response.json()["outcome"] == "unable_to_classify"


def test_model_failure_is_safe(settings: Settings) -> None:
    with TestClient(
        create_app(settings=settings, predictor=FakePredictor(inference_failure=True))
    ) as client:
        response = post_image(client, image_bytes())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DEPENDENCY_UNAVAILABLE"
    assert "fixture" not in response.text


def test_timeout_keeps_capacity_reserved_until_worker_finishes(settings: Settings) -> None:
    class SlowPredictor(FakePredictor):
        def appraise(self, image, confidence_threshold, ambiguity_margin):
            time.sleep(0.1)
            return super().appraise(image, confidence_threshold, ambiguity_margin)

    constrained = settings.model_copy(
        update={"inference_timeout_seconds": 0.01, "maximum_concurrent_inferences": 1}
    )
    with TestClient(create_app(settings=constrained, predictor=SlowPredictor())) as client:
        timed_out = post_image(client, image_bytes())
        busy = post_image(client, image_bytes())
        time.sleep(0.12)
    assert timed_out.status_code == 504
    assert busy.status_code == 429


def test_request_id_form_field_is_propagated(client: TestClient) -> None:
    response = client.post(
        "/v1/vision/appraise",
        files={"image": ("sample.jpg", image_bytes(), "image/jpeg")},
        data={"request_id": "client-request-0001"},
    )
    assert response.status_code == 200
    assert response.headers["x-request-id"] == "client-request-0001"


def test_upload_leaves_no_temporary_file(client: TestClient, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    response = post_image(client, image_bytes("PNG"), "image/png")
    assert response.status_code == 200
    assert list(tmp_path.iterdir()) == []


def test_openapi_documents_multipart_and_classifier_limitation(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    operation = response.json()["paths"]["/v1/vision/appraise"]["post"]
    assert "multipart/form-data" in operation["requestBody"]["content"]
    assert "does not detect" in operation["description"]
    assert "413" in operation["responses"]
