"""Helpers for handoff tests: evidence uploads and contract `HandoffRequest` bodies."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from apps.api.app.domain.integrity import sha256_canonical_json
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.app.seed import COLLECTION_CENTRE_ID, SEED_USER_IDS
from apps.api.tests.support.records import lookup_token as issued_lookup_token
from apps.api.tests.support.records import photo, upload_evidence
from fastapi.testclient import TestClient

RECYCLER = SEED_USER_IDS["recycler.demo"]
FACILITY = "0199b011-0011-7011-8011-000000000011"
PROGRAMME = "0199b010-0010-7010-8010-000000000010"


def handoff_photos(
    client: TestClient, headers: dict[str, str], record_id: str, seed: int = 200
) -> list[str]:
    ids = []
    for offset, evidence_type in enumerate(("handoff_photo", "weight_measurement")):
        response = upload_evidence(
            client, headers, record_id, evidence_type, image=photo(seed + offset)
        )
        assert response.status_code == 201, response.text
        ids.append(response.json()["data"]["evidence_id"])
    return ids


def handoff_request(
    record: dict[str, Any],
    evidence_ids: list[str],
    *,
    recycler_id: Any = RECYCLER,
    facility_id: str = FACILITY,
    location_id: Any = COLLECTION_CENTRE_ID,
    weight: float = 14.5,
    unit: str = "kg",
    category: str | None = None,
    currency: str = "GHS",
    key: str | None = None,
    lookup_token: str | None = None,
    manual_transfer_code: str | None = None,
    **overrides: Any,
) -> dict[str, Any]:
    credential = (
        {"manual_transfer_code": manual_transfer_code}
        if manual_transfer_code is not None
        else {"lookup_token": lookup_token or issued_lookup_token(record["record_id"])}
    )
    body: dict[str, Any] = {
        "recovery_record_id": record["record_id"],
        **credential,
        "collector_reference": record["collector"],
        "recycler_reference": {
            "actor_id": str(recycler_id),
            "programme_id": PROGRAMME,
            "facility_id": facility_id,
        },
        "receiving_location_id": str(location_id),
        "handoff_time": format_timestamp(utc_now() - timedelta(seconds=5)),
        "confirmed_category": category or record["category"],
        "confirmed_condition": record["condition"],
        "measured_weight": {"value": weight, "unit": unit},
        "final_price": {"amount": 65.25, "currency": currency},
        "evidence_ids": evidence_ids,
    }
    body.update(overrides)
    digest = sha256_canonical_json({k: v for k, v in body.items() if k not in ("handoff_time",)})
    body["idempotency"] = {
        "idempotency_key": key or f"record_handoff:{record['record_id']}:{recycler_id}"[:128],
        "request_digest": digest,
        "scope": {
            "actor_id": str(recycler_id),
            "operation": "record_handoff",
            "resource_id": record["record_id"],
        },
    }
    return body
