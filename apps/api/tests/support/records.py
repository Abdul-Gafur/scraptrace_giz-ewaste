"""Helpers for recovery-record API tests. All values are synthetic."""

from __future__ import annotations

import copy
import io
import uuid
from datetime import timedelta
from typing import Any

from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.app.seed import COLLECTION_CENTRE_ID, PROGRAMME_ID, SEED_USER_IDS
from apps.api.tests.support.builders import DEVICE_INSTANCE_ID, vision_result
from fastapi.testclient import TestClient
from PIL import Image

COLLECTOR = SEED_USER_IDS["collector.demo"]


def photo(
    seed: int = 1, fmt: str = "JPEG", size: tuple[int, int] = (64, 48), exif: bool = False
) -> bytes:
    """A distinct synthetic photograph per seed, so content digests never collide by accident."""
    image = Image.new("RGB", size, color=((seed * 37) % 256, (seed * 91) % 256, (seed * 53) % 256))
    output = io.BytesIO()
    if exif:
        metadata = Image.Exif()
        metadata[0x010F] = "Synthetic Camera Maker"  # Make
        metadata[0x0132] = "2026:09:20 09:00:00"  # DateTime
        image.save(output, format=fmt, exif=metadata.tobytes())
    else:
        image.save(output, format=fmt)
    return output.getvalue()


def confirmation(
    category: str = "televisions",
    source: str = "accepted_prediction",
    actor_id: uuid.UUID = COLLECTOR,
    reason: str | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "confirmed_category": category,
        "confirmed_by": {"actor_id": str(actor_id), "programme_id": str(PROGRAMME_ID)},
        "confirmed_at": format_timestamp(utc_now() - timedelta(seconds=30)),
        "source": source,
    }
    if reason:
        value["correction_reason"] = reason
    return value


def draft_metadata(category: str = "televisions", **overrides: Any) -> dict[str, Any]:
    captured = format_timestamp(utc_now() - timedelta(minutes=5))
    metadata: dict[str, Any] = {
        "device_instance_id": DEVICE_INSTANCE_ID,
        "category": category,
        "condition": "damaged",
        "item_count": 1,
        "approximate_weight": {"value": 14, "unit": "kg"},
        "captured_at": captured,
        "capture_location": {"latitude": 5.55, "longitude": -0.2, "source": "device"},
        "approximate_area": {"label": "Greater Accra", "country_code": "GH"},
        "vision_result": vision_result(category),
        "category_confirmation": confirmation(category),
        "destination_location_id": str(COLLECTION_CENTRE_ID),
        "original_image": {
            "captured_at": captured,
            "capture_source": "in_app_camera",
            "connectivity": "online",
            "application_version": "0.1.0",
        },
    }
    metadata.update(overrides)
    return {key: value for key, value in metadata.items() if value is not None}


def create_draft(
    client: TestClient,
    headers: dict[str, str],
    metadata: dict[str, Any] | None = None,
    image: bytes | None = None,
    key: str | None = None,
    content_type: str = "image/jpeg",
) -> Any:
    import json

    body = metadata if metadata is not None else draft_metadata()
    return client.post(
        "/v1/recovery-records",
        headers={**headers, "Idempotency-Key": key or f"create-{uuid7()}"},
        data={"record": json.dumps(body)},
        files={
            "original_image": (
                "C:\\\\..\\\\untrusted name.jpg",
                photo() if image is None else image,
                content_type,
            )
        },
    )


def created_record(client: TestClient, headers: dict[str, str], **kwargs: Any) -> dict[str, Any]:
    response = create_draft(client, headers, **kwargs)
    assert response.status_code == 201, response.text
    return dict(response.json()["data"])


def submitted_record(client: TestClient, headers: dict[str, str], **kwargs: Any) -> dict[str, Any]:
    record = created_record(client, headers, **kwargs)
    response = client.post(
        f"/v1/recovery-records/{record['record_id']}/submissions", headers=headers
    )
    assert response.status_code == 200, response.text
    return dict(response.json()["data"]["record"])


def upload_evidence(
    client: TestClient,
    headers: dict[str, str],
    record_id: str,
    evidence_type: str,
    image: bytes | None = None,
    capture_source: str = "recycler_camera",
    evidence_id: str | None = None,
    content_type: str = "image/jpeg",
) -> Any:
    fields = {
        "evidence_type": evidence_type,
        "captured_at": format_timestamp(utc_now() - timedelta(seconds=10)),
        "capture_source": capture_source,
        "device_instance_id": DEVICE_INSTANCE_ID,
        "connectivity": "online",
        "application_version": "0.1.0",
    }
    if evidence_id:
        fields["evidence_id"] = evidence_id
    return client.post(
        f"/v1/recovery-records/{record_id}/evidence",
        headers=headers,
        data=fields,
        files={"image": ("evidence.jpg", photo(99) if image is None else image, content_type)},
    )


def deep(value: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(value)
