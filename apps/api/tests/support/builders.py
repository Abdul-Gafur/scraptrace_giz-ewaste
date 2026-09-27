"""Synthetic, contract-valid fixture values. No personal data."""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from apps.api.app.contracts.mappers import actor_reference
from apps.api.app.db.models import Evidence, RecoveryRecord
from apps.api.app.domain.identifiers import new_human_reference, uuid7
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.app.domain.vocabulary import EWASTE_CATEGORIES
from PIL import Image

DEVICE_INSTANCE_ID = "0199b020-0020-7020-8020-000000000020"


def scores(winner: str = "televisions", top: float = 0.8) -> list[dict[str, Any]]:
    remainder = round((1 - top) / 6, 6)
    return [
        {"category": category, "score": top if category == winner else remainder}
        for category in EWASTE_CATEGORIES
    ]


def vision_result(
    winner: str = "televisions", top: float = 0.8, low: bool = False
) -> dict[str, Any]:
    return {
        "prediction_id": str(uuid7()),
        "model_name": "scraptrace-vision-efficientnet-b0",
        "model_version": "0.2.0",
        "inferred_at": format_timestamp(utc_now() - timedelta(minutes=1)),
        "scores": scores(winner, top),
        "suggested_category": winner,
        "confidence": top,
        "low_confidence": low,
    }


def image_file(
    color: tuple[int, int, int] = (70, 90, 120), size: tuple[int, int] = (48, 32), fmt: str = "JPEG"
) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, color=color).save(output, format=fmt)
    return output.getvalue()


def record_model(
    collector_id: uuid.UUID,
    programme_id: uuid.UUID,
    *,
    category: str = "televisions",
    state: str = "draft",
    captured_at: datetime | None = None,
) -> RecoveryRecord:
    captured = captured_at or datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc)
    confirmation = {
        "confirmed_category": category,
        "confirmed_by": actor_reference(collector_id, programme_id),
        "confirmed_at": format_timestamp(captured),
        "source": "accepted_prediction",
    }
    return RecoveryRecord(
        id=uuid7(),
        human_reference=new_human_reference(),
        programme_id=programme_id,
        collector_id=collector_id,
        record_kind="batch" if category == "mixed_scrap" else "item",
        category=category,
        item_count=None if category == "mixed_scrap" else 1,
        approximate_weight_value=14.0,
        approximate_weight_unit="kg",
        condition="damaged",
        captured_at=captured,
        approximate_area={"label": "Greater Accra", "country_code": "GH"},
        vision_result=vision_result(category),
        category_confirmation=confirmation,
        business_state=state,
        handoff_state="not_started",
        processing_state="not_started",
        device_instance_id=uuid.UUID(DEVICE_INSTANCE_ID),
    )


def evidence_model(
    record_id: uuid.UUID,
    captured_by: uuid.UUID,
    *,
    evidence_type: str = "original_item_photo",
    digest: str = "sha256:" + "a" * 64,
    programme_id: uuid.UUID | None = None,
) -> Evidence:
    evidence_id = uuid7()
    now = utc_now()
    return Evidence(
        id=evidence_id,
        record_id=record_id,
        evidence_type=evidence_type,
        storage_provider="local-filesystem",
        object_key=f"evidence/{record_id}/{evidence_id}",
        mime_type="image/jpeg",
        file_size_bytes=1024,
        content_digest=digest,
        metadata_stripped=True,
        capture_source="in_app_camera",
        captured_by_id=captured_by,
        captured_by_programme_id=programme_id,
        device_instance_id=uuid.UUID(DEVICE_INSTANCE_ID),
        captured_at=now,
        server_received_at=now,
        application_version="0.1.0",
        connectivity="online",
        validation_status="accepted",
    )
