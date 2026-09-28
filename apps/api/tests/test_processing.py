"""Processing: queue, editable drafts, material entries, validation and submission."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.tests.support.api import auth
from apps.api.tests.support.records import submitted_record, upload_evidence
from apps.api.tests.support.workflow import (
    processing_photo,
    processing_request,
    received_record,
)
from fastapi.testclient import TestClient


def _submit(client: TestClient, headers: dict[str, str], body: dict[str, Any]) -> Any:
    return client.post("/v1/processing-submissions", headers=headers, json=body)


def test_queue_lists_received_records_at_the_facility(api: TestClient) -> None:
    record, recycler = received_record(api)
    submitted_record(api, auth(api, "collector.demo"))  # awaiting handoff: not in the queue
    queue = api.get("/v1/processing-queue", headers=recycler).json()["data"]
    assert [item["record_id"] for item in queue["items"]] == [record["record_id"]]
    elsewhere = api.get("/v1/processing-queue", headers=auth(api, "recycler-ashanti.demo"))
    assert elsewhere.json()["data"]["items"] == []
    assert api.get("/v1/processing-queue", headers=auth(api, "reviewer.demo")).status_code == 403


def test_draft_processing_with_editable_material_entries(api: TestClient) -> None:
    record, recycler = received_record(api)
    base = f"/v1/recovery-records/{record['record_id']}/processing"
    assert api.get(base, headers=recycler).status_code == 404

    created = api.put(base, headers=recycler, json={"processing_method": "material_recovery"})
    assert created.status_code == 200, created.text
    draft = created.json()["data"]
    assert draft["status"] == "draft" and draft["material_entries"] == []
    assert created.headers["etag"] == f'"{draft["version"]}"'
    record_now = api.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler)
    assert record_now.json()["data"]["processing_state"] == "in_progress"

    first = api.post(
        f"{base}/material-entries",
        headers=recycler,
        json={"material": "  Steel   casing ", "weight": {"value": 6.5, "unit": "kg"}},
    )
    assert first.status_code == 201
    second = api.post(
        f"{base}/material-entries",
        headers=recycler,
        json={"material": "Copper", "weight": {"value": 900, "unit": "g"}},
    ).json()["data"]
    assert [entry["material"] for entry in second["material_entries"]] == ["Steel casing", "Copper"]
    assert second["total_recovered_weight_kg"] == 7.4

    copper = second["material_entries"][1]["entry_id"]
    updated = api.patch(
        f"{base}/material-entries/{copper}",
        headers=recycler,
        json={"weight": {"value": 1.2, "unit": "kg"}},
    ).json()["data"]
    assert updated["total_recovered_weight_kg"] == 7.7
    removed = api.delete(f"{base}/material-entries/{copper}", headers=recycler).json()["data"]
    assert [entry["material"] for entry in removed["material_entries"]] == ["Steel casing"]

    stale = api.put(
        base, headers={**recycler, "If-Match": f'"{draft["version"]}"'}, json={"notes": "x"}
    )
    assert stale.status_code == 409
    missing = api.put(base, headers=recycler, json={"notes": "x"})
    assert missing.status_code == 428
    fresh = api.put(
        base, headers={**recycler, "If-Match": f'"{removed["version"]}"'}, json={"notes": "Sorted."}
    )
    assert fresh.status_code == 200 and fresh.json()["data"]["notes"] == "Sorted."


@pytest.mark.parametrize(
    "entry",
    [
        {"material": "Steel", "weight": {"value": 0, "unit": "kg"}},
        {"material": "Steel", "weight": {"value": -1, "unit": "kg"}},
        {"material": "Steel", "weight": {"value": 2, "unit": "lb"}},
        {"material": "", "weight": {"value": 2, "unit": "kg"}},
        {"material": "   ", "weight": {"value": 2, "unit": "kg"}},
        {"material": "Steel\u0000", "weight": {"value": 2, "unit": "kg"}},
        {"material": "Steel", "weight": {"value": 2, "unit": "kg"}, "grade": "A"},
    ],
)
def test_invalid_material_entries_are_rejected(api: TestClient, entry: dict[str, Any]) -> None:
    record, recycler = received_record(api)
    response = api.post(
        f"/v1/recovery-records/{record['record_id']}/processing/material-entries",
        headers=recycler,
        json=entry,
    )
    assert response.status_code == 422


def test_other_facilities_cannot_process(api: TestClient) -> None:
    record, _ = received_record(api)
    response = api.put(
        f"/v1/recovery-records/{record['record_id']}/processing",
        headers=auth(api, "recycler-ashanti.demo"),
        json={"processing_method": "safe_storage"},
    )
    assert response.status_code == 404
    collector = api.put(
        f"/v1/recovery-records/{record['record_id']}/processing",
        headers=auth(api, "collector.demo"),
        json={"processing_method": "safe_storage"},
    )
    assert collector.status_code == 403


def test_unflagged_processing_completes_and_approves(api: TestClient) -> None:
    record, recycler = received_record(api)
    evidence = processing_photo(api, recycler, record["record_id"])
    response = _submit(api, recycler, processing_request(record, [evidence]))
    assert response.status_code == 201, response.text
    result = response.json()["data"]
    REGISTRY.check_response("processing_response", result)
    assert result["outcome"] == "processing_recorded"

    final = api.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler).json()["data"]
    REGISTRY.check_response("recovery_record", final)
    assert final["business_state"] == "approved_and_completed"
    assert final["processing_state"] == "completed"
    assert final["revision"] == result["server_revision"]
    assert final["processing"]["method"] == "material_recovery"
    assert final["processing"]["material_entries"] == [
        {"material": "Steel casing", "weight": {"value": 6.5, "unit": "kg"}}
    ]
    events = api.get(f"/v1/recovery-records/{record['record_id']}/events", headers=recycler)
    assert [e["event_type"] for e in events.json()["data"]][-3:] == [
        "record_processing",
        "mark_processing_complete",
        "approve_unflagged_completion",
    ]


def test_submission_replaces_draft_entries_and_locks_the_draft(api: TestClient) -> None:
    record, recycler = received_record(api)
    base = f"/v1/recovery-records/{record['record_id']}/processing"
    api.post(
        f"{base}/material-entries",
        headers=recycler,
        json={"material": "Draft only", "weight": {"value": 1, "unit": "kg"}},
    )
    evidence = processing_photo(api, recycler, record["record_id"])
    _submit(api, recycler, processing_request(record, [evidence], entries=[("Aluminium", 2.0)]))
    detail = api.get(base, headers=recycler).json()["data"]
    assert detail["status"] == "submitted"
    assert [entry["material"] for entry in detail["material_entries"]] == ["Aluminium"]
    locked = api.post(
        f"{base}/material-entries",
        headers=recycler,
        json={"material": "Late", "weight": {"value": 1, "unit": "kg"}},
    )
    assert locked.status_code == 409


@pytest.mark.parametrize(
    ("kwargs", "flags"),
    [
        ({"entries": [("Steel", 20.0)]}, ["PROCESSED_WEIGHT_ABOVE_RECEIVED"]),
        ({"entries": []}, ["MISSING_MATERIAL_WEIGHTS"]),
    ],
)
def test_processing_flags_send_the_record_to_review(
    api: TestClient, kwargs: dict[str, Any], flags: list[str]
) -> None:
    record, recycler = received_record(api)
    evidence = processing_photo(api, recycler, record["record_id"])
    result = _submit(api, recycler, processing_request(record, [evidence], **kwargs)).json()["data"]
    assert result == {
        "outcome": "review_required",
        "recovery_record_id": record["record_id"],
        "flag_codes": flags,
        "replayed": False,
    }
    final = api.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler).json()["data"]
    assert final["business_state"] == "under_review"


def test_earlier_handoff_flags_route_processing_to_review(api: TestClient) -> None:
    record, recycler = received_record(api, weight=31)
    evidence = processing_photo(api, recycler, record["record_id"])
    result = _submit(api, recycler, processing_request(record, [evidence])).json()["data"]
    assert result["outcome"] == "review_required"
    assert result["flag_codes"] == ["WEIGHT_DISCREPANCY"]


def test_processing_submission_is_idempotent_and_single(api: TestClient) -> None:
    record, recycler = received_record(api)
    evidence = processing_photo(api, recycler, record["record_id"])
    body = processing_request(record, [evidence])
    first = _submit(api, recycler, body)
    replay = _submit(api, recycler, {**body, "processing_timestamp": format_timestamp(utc_now())})
    assert (first.status_code, replay.status_code) == (201, 200)
    assert replay.json()["data"] == {**first.json()["data"], "replayed": True}
    again = _submit(
        api,
        recycler,
        processing_request(record, [evidence], key="record_processing:second-attempt"),
    )
    assert again.status_code == 200
    assert again.json()["data"]["outcome"] == "rejected"
    assert again.json()["data"]["error_code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"notes": "   "}, "notes"),
        (
            {"processing_timestamp": format_timestamp(utc_now() + timedelta(days=1))},
            "processing_timestamp",
        ),
        ({"processing_timestamp": "2026-01-01T00:00:00.000Z"}, "processing_timestamp"),
    ],
)
def test_invalid_processing_is_rejected(
    api: TestClient, override: dict[str, Any], field: str
) -> None:
    record, recycler = received_record(api)
    evidence = processing_photo(api, recycler, record["record_id"])
    body = processing_request(record, [evidence], **override)
    response = _submit(api, recycler, body)
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"][0]["field"] == field


def test_completion_evidence_must_be_processing_photographs(api: TestClient) -> None:
    record, recycler = received_record(api)
    handoff_photo = record["handoff"]["evidence_ids"][0]
    response = _submit(api, recycler, processing_request(record, [handoff_photo]))
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"] == [
        {"field": "completion_evidence_ids", "reason": "invalid_reference"}
    ]


def test_processing_before_receipt_is_refused(api: TestClient) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    recycler = auth(api, "recycler.demo")
    upload = upload_evidence(api, recycler, record["record_id"], "processing_completion")
    assert upload.status_code == 422  # not a handoff-stage evidence type
    draft = api.put(
        f"/v1/recovery-records/{record['record_id']}/processing",
        headers=recycler,
        json={"processing_method": "safe_storage"},
    )
    assert draft.status_code == 409
