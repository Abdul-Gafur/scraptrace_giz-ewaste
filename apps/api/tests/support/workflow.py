"""Helpers that move records through handoff, processing and review over HTTP."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from apps.api.app.domain.integrity import sha256_canonical_json
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.app.seed import SEED_USER_IDS
from apps.api.tests.support.api import auth
from apps.api.tests.support.handoff import FACILITY, PROGRAMME, handoff_photos, handoff_request
from apps.api.tests.support.records import photo, submitted_record, upload_evidence
from fastapi.testclient import TestClient

RECYCLER = SEED_USER_IDS["recycler.demo"]
REVIEWER = SEED_USER_IDS["reviewer.demo"]


def received_record(
    client: TestClient, weight: float = 14.5, seed: int = 400, **kwargs: Any
) -> tuple[dict[str, Any], dict[str, str]]:
    record = submitted_record(client, auth(client, "collector.demo"), **kwargs)
    recycler = auth(client, "recycler.demo")
    evidence = handoff_photos(client, recycler, record["record_id"], seed=seed)
    response = client.post(
        "/v1/handoffs", headers=recycler, json=handoff_request(record, evidence, weight=weight)
    )
    assert response.status_code == 201, response.text
    refreshed = client.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler)
    return refreshed.json()["data"], recycler


def processing_photo(
    client: TestClient, headers: dict[str, str], record_id: str, seed: int = 500
) -> str:
    response = upload_evidence(
        client, headers, record_id, "processing_completion", image=photo(seed)
    )
    assert response.status_code == 201, response.text
    return str(response.json()["data"]["evidence_id"])


def processing_request(
    record: dict[str, Any],
    evidence_ids: list[str],
    *,
    entries: list[tuple[str, float]] | None = None,
    method: str = "material_recovery",
    notes: str = "Casing separated; boards and copper recovered.",
    key: str | None = None,
    **overrides: Any,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "recovery_record_id": record["record_id"],
        "recycler_reference": {
            "actor_id": str(RECYCLER),
            "programme_id": PROGRAMME,
            "facility_id": FACILITY,
        },
        "processing_method": method,
        "material_entries": [
            {"material": name, "weight": {"value": value, "unit": "kg"}}
            for name, value in (entries if entries is not None else [("Steel casing", 6.5)])
        ],
        "processing_timestamp": format_timestamp(utc_now() - timedelta(seconds=2)),
        "completion_evidence_ids": evidence_ids,
        "notes": notes,
    }
    body.update(overrides)
    body["idempotency"] = {
        "idempotency_key": key or f"record_processing:{record['record_id']}"[:128],
        "request_digest": sha256_canonical_json(
            {k: v for k, v in body.items() if k != "processing_timestamp"}
        ),
        "scope": {
            "actor_id": str(RECYCLER),
            "operation": "record_processing",
            "resource_id": record["record_id"],
        },
    }
    return body


def review_request(
    record: dict[str, Any],
    evidence_considered: list[str],
    decision: str,
    reason_code: str,
    *,
    note: str = "Scale photograph checked against the receipt.",
    requested_correction: str | None = None,
    previous_review_state: str = "open",
    previous_record_state: str = "under_review",
    review_reason_codes: list[str] | None = None,
    reviewer_id: Any = REVIEWER,
    key: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "recovery_record_id": record["record_id"],
        "review_reason_codes": review_reason_codes
        or list(record["review"]["flag_codes"])
        or ["MANUAL_REVIEW"],
        "assigned_reviewer": {"actor_id": str(reviewer_id), "programme_id": PROGRAMME},
        "evidence_considered": evidence_considered,
        "decision": decision,
        "reason_code": reason_code,
        "reviewer_note": note,
        "decision_timestamp": format_timestamp(utc_now() - timedelta(seconds=1)),
        "previous_review_state": previous_review_state,
        "previous_record_state": previous_record_state,
    }
    if requested_correction is not None:
        body["requested_correction"] = requested_correction
    body["idempotency"] = {
        "idempotency_key": key or f"review_{decision}:{record['record_id']}:{reviewer_id}"[:128],
        "request_digest": sha256_canonical_json(
            {k: v for k, v in body.items() if k != "decision_timestamp"}
        ),
        "scope": {
            "actor_id": str(reviewer_id),
            "operation": "record_review_decision",
            "resource_id": record["record_id"],
        },
    }
    return body


def under_review_record(
    client: TestClient, seed: int = 600
) -> tuple[dict[str, Any], dict[str, str]]:
    """A record with a weight discrepancy, processed, and therefore under review."""
    record, recycler = received_record(client, weight=31, seed=seed)
    evidence = processing_photo(client, recycler, record["record_id"], seed=seed + 50)
    response = client.post(
        "/v1/processing-submissions", headers=recycler, json=processing_request(record, [evidence])
    )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["outcome"] == "review_required"
    reviewer = auth(client, "reviewer.demo")
    refreshed = client.get(f"/v1/recovery-records/{record['record_id']}", headers=reviewer)
    return refreshed.json()["data"], reviewer
