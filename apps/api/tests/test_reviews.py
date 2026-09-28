"""Review queue, case detail and the three contract decisions."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
import sqlalchemy as sa
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.core.config import Settings
from apps.api.app.db.models import AuditEvent, ReviewDecision
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.tests.support.api import auth, query
from apps.api.tests.support.records import upload_evidence
from apps.api.tests.support.workflow import (
    received_record,
    review_request,
    under_review_record,
)
from fastapi.testclient import TestClient


def _decide(client: TestClient, headers: dict[str, str], body: dict[str, Any]) -> Any:
    return client.post("/v1/review-decisions", headers=headers, json=body)


def _case_id(client: TestClient, headers: dict[str, str], record_id: str) -> str:
    items = client.get("/v1/review-cases", headers=headers).json()["data"]["items"]
    return next(item["case_id"] for item in items if item["record_id"] == record_id)


# Queue and detail -----------------------------------------------------------------------


def test_flagged_records_appear_in_the_reviewer_queue(api: TestClient) -> None:
    record, reviewer = under_review_record(api)
    pending, _ = received_record(api, weight=40, seed=700)  # flagged but not yet processed
    page = api.get("/v1/review-cases", headers=reviewer).json()["data"]
    by_record = {item["record_id"]: item for item in page["items"]}
    assert by_record[record["record_id"]]["decision_eligible"] is True
    assert by_record[record["record_id"]]["flag_codes"] == ["WEIGHT_DISCREPANCY"]
    assert by_record[record["record_id"]]["record_business_state"] == "under_review"
    assert by_record[pending["record_id"]]["decision_eligible"] is False
    assert page["pagination"] == {"next_cursor": None, "has_more": False}


def test_queue_filters_and_pagination(api: TestClient) -> None:
    first, reviewer = under_review_record(api, seed=610)
    second, _ = under_review_record(api, seed=630)
    one = api.get("/v1/review-cases?limit=1", headers=reviewer).json()["data"]
    assert [item["record_id"] for item in one["items"]] == [first["record_id"]]
    rest = api.get(
        f"/v1/review-cases?limit=1&cursor={one['pagination']['next_cursor']}", headers=reviewer
    ).json()["data"]
    assert [item["record_id"] for item in rest["items"]] == [second["record_id"]]

    flagged = api.get("/v1/review-cases?flag_code=WEIGHT_DISCREPANCY", headers=reviewer)
    assert len(flagged.json()["data"]["items"]) == 2
    other_flag = api.get("/v1/review-cases?flag_code=CATEGORY_DISAGREEMENT", headers=reviewer)
    assert other_flag.json()["data"]["items"] == []
    # Opening-date filters are UTC calendar dates.
    utc_today = datetime.now(timezone.utc).date()
    today = utc_today.isoformat()
    tomorrow = (utc_today + timedelta(days=1)).isoformat()
    dated = api.get(f"/v1/review-cases?opened_from={today}&opened_to={tomorrow}", headers=reviewer)
    assert len(dated.json()["data"]["items"]) == 2
    future = api.get(f"/v1/review-cases?opened_from={tomorrow}", headers=reviewer)
    assert future.json()["data"]["items"] == []
    facility = api.get(
        "/v1/review-cases?facility_id=0199b012-0012-7012-8012-000000000012", headers=reviewer
    )
    assert facility.json()["data"]["items"] == []
    decided = api.get("/v1/review-cases?status=approved", headers=reviewer)
    assert decided.json()["data"]["items"] == []
    assert api.get("/v1/review-cases?flag_code=FRAUD", headers=reviewer).status_code == 422


@pytest.mark.parametrize(
    "username",
    ["collector.demo", "recycler.demo", "manager.demo", "safety-admin.demo", "ml-reviewer.demo"],
)
def test_only_reviewers_access_the_queue(api: TestClient, username: str) -> None:
    assert api.get("/v1/review-cases", headers=auth(api, username)).status_code == 403


def test_case_detail_contains_permitted_evidence_and_timeline(
    api: TestClient, api_settings: Settings
) -> None:
    record, reviewer = under_review_record(api)
    case_id = _case_id(api, reviewer, record["record_id"])
    detail = api.get(f"/v1/review-cases/{case_id}", headers=reviewer)
    assert detail.status_code == 200
    data = detail.json()["data"]
    REGISTRY.check_response("recovery_record", data["record"])
    assert "capture_location" in data["record"]  # reviewers hold personal_data:view
    types = {item["evidence_type"] for item in data["evidence"]}
    assert {
        "original_item_photo",
        "handoff_photo",
        "weight_measurement",
        "handoff_qr_scan",
        "recycler_receipt",
        "processing_completion",
    } <= types
    for item in data["evidence"]:
        REGISTRY.check_response("evidence", item)
    assert [event["event_type"] for event in data["timeline"]] == [
        "submit_record",
        "publish_for_handoff",
        "record_handoff",
        "record_processing",
        "flag_for_review",
    ]
    assert data["decisions"] == []

    async def accessed(session: sa.ext.asyncio.AsyncSession) -> int:
        return int(
            await session.scalar(
                sa.select(sa.func.count())
                .select_from(AuditEvent)
                .where(AuditEvent.action == "review-case.accessed")
            )
        )

    assert query(api_settings, accessed) == 1


def test_case_detail_is_hidden_outside_review_roles(api: TestClient) -> None:
    record, reviewer = under_review_record(api)
    case_id = _case_id(api, reviewer, record["record_id"])
    assert (
        api.get(f"/v1/review-cases/{case_id}", headers=auth(api, "manager.demo")).status_code == 403
    )
    assert (
        api.get(f"/v1/review-cases/{case_id}", headers=auth(api, "recycler.demo")).status_code
        == 403
    )


# Decisions ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("decision", "reason", "record_state", "review_state"),
    [
        ("approve", "WEIGHT_EXPLAINED", "approved_and_completed", "approved"),
        ("reject", "WEIGHT_UNEXPLAINED", "rejected", "rejected"),
    ],
)
def test_terminal_decisions(
    api: TestClient,
    api_settings: Settings,
    decision: str,
    reason: str,
    record_state: str,
    review_state: str,
) -> None:
    record, reviewer = under_review_record(api)
    evidence = [record["handoff"]["evidence_ids"][1]]
    response = _decide(api, reviewer, review_request(record, evidence, decision, reason))
    assert response.status_code == 201, response.text
    result = response.json()["data"]
    REGISTRY.check_response("programme_review_response", result)
    assert result["previous_record_state"] == "under_review"
    assert result["resulting_record_state"] == record_state
    assert result["resulting_review_state"] == review_state

    final = api.get(f"/v1/recovery-records/{record['record_id']}", headers=reviewer).json()["data"]
    REGISTRY.check_response("recovery_record", final)
    assert final["business_state"] == record_state
    assert final["review"]["decision"] == decision
    assert final["review"]["reason_code"] == reason
    assert (
        final["review"]["assigned_reviewer"]["actor_id"] == "0199b003-0003-7003-8003-000000000003"
    )
    # The collector sees the outcome but not the reviewer's note.
    own = api.get(
        f"/v1/recovery-records/{record['record_id']}", headers=auth(api, "collector.demo")
    )
    assert own.json()["data"]["review"]["decision"] == decision
    assert "reviewer_note" not in own.json()["data"]["review"]

    events = api.get(f"/v1/recovery-records/{record['record_id']}/events", headers=reviewer)
    last = events.json()["data"][-1]
    assert last["event_type"] == f"{decision}_review"
    assert last["actor_role"] == "programme_reviewer"

    async def audit(session: sa.ext.asyncio.AsyncSession) -> dict[str, Any]:
        event = await session.scalar(
            sa.select(AuditEvent).where(AuditEvent.action == "review-decision.recorded")
        )
        assert event is not None
        return dict(event.details)

    assert query(api_settings, audit)["reporting_eligible"] is (
        record_state == "approved_and_completed"
    )


def test_request_correction_keeps_the_record_under_review(api: TestClient) -> None:
    record, reviewer = under_review_record(api)
    evidence = [record["handoff"]["evidence_ids"][1]]
    response = _decide(
        api,
        reviewer,
        review_request(
            record,
            evidence,
            "request_correction",
            "ADDITIONAL_EVIDENCE_REQUIRED",
            requested_correction="Upload a clearer photograph of the scale display.",
        ),
    )
    assert response.status_code == 201
    result = response.json()["data"]
    assert (result["resulting_record_state"], result["resulting_review_state"]) == (
        "under_review",
        "awaiting_information",
    )
    # The recycler can now return the requested evidence (FR-REV-006).
    recycler = auth(api, "recycler.demo")
    upload = upload_evidence(api, recycler, record["record_id"], "weight_measurement")
    assert upload.status_code == 201
    own = api.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler).json()["data"]
    assert own["review"]["requested_correction"].startswith("Upload a clearer")
    assert "reviewer_note" not in own["review"]

    approved = _decide(
        api,
        reviewer,
        review_request(
            record,
            [upload.json()["data"]["evidence_id"]],
            "approve",
            "EVIDENCE_SUFFICIENT",
            previous_review_state="awaiting_information",
        ),
    )
    assert approved.status_code == 201
    assert approved.json()["data"]["resulting_record_state"] == "approved_and_completed"


def test_decided_records_cannot_be_decided_again(api: TestClient) -> None:
    record, reviewer = under_review_record(api)
    evidence = [record["handoff"]["evidence_ids"][1]]
    first = review_request(record, evidence, "approve", "EVIDENCE_SUFFICIENT")
    assert _decide(api, reviewer, first).status_code == 201
    replay = _decide(api, reviewer, first)
    assert replay.status_code == 200
    assert replay.json()["data"]["replayed"] is True
    reversal = review_request(record, evidence, "reject", "EVIDENCE_INSUFFICIENT")
    refused = _decide(api, reviewer, reversal)
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "INVALID_STATE_TRANSITION"
    assert refused.json()["error"]["safe_details"]["reason"] == "ALREADY_DECIDED"


def test_decision_idempotency_conflict(api: TestClient, api_settings: Settings) -> None:
    record, reviewer = under_review_record(api)
    evidence = [record["handoff"]["evidence_ids"][1]]
    body = review_request(
        record, evidence, "approve", "EVIDENCE_SUFFICIENT", key="review_approve:conflict-01"
    )
    assert _decide(api, reviewer, body).status_code == 201
    changed = review_request(
        record, evidence, "approve", "WEIGHT_EXPLAINED", key="review_approve:conflict-01"
    )
    conflict = _decide(api, reviewer, changed)
    assert (
        conflict.status_code == 409 and conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    )

    async def decisions(session: sa.ext.asyncio.AsyncSession) -> int:
        return int(await session.scalar(sa.select(sa.func.count()).select_from(ReviewDecision)))

    assert query(api_settings, decisions) == 1


@pytest.mark.parametrize(
    ("changes", "status", "field"),
    [
        ({"reason_code": "WEIGHT_UNEXPLAINED"}, 422, "reason_code"),
        ({"reviewer_note": "   "}, 422, "reviewer_note"),
        ({"review_reason_codes": ["SUSPECTED_FRAUD"]}, 422, "review_reason_codes"),
        (
            {"evidence_considered": ["0199c0ff-00ff-70ff-80ff-0000000000ff"]},
            422,
            "evidence_considered",
        ),
        (
            {"decision_timestamp": format_timestamp(utc_now() + timedelta(days=1))},
            422,
            "decision_timestamp",
        ),
        ({"previous_record_state": "completed"}, 409, None),
        ({"previous_review_state": "awaiting_information"}, 409, None),
    ],
)
def test_invalid_decisions_fail_safely(
    api: TestClient, changes: dict[str, Any], status: int, field: str | None
) -> None:
    record, reviewer = under_review_record(api)
    body = review_request(
        record, [record["handoff"]["evidence_ids"][1]], "approve", "EVIDENCE_SUFFICIENT"
    )
    body.update(changes)
    response = _decide(api, reviewer, body)
    assert response.status_code == status, response.text
    if field:
        assert response.json()["error"]["field_issues"][0]["field"] == field
    unchanged = api.get(f"/v1/recovery-records/{record['record_id']}", headers=reviewer)
    assert unchanged.json()["data"]["business_state"] == "under_review"


def test_correction_request_requires_details(api: TestClient) -> None:
    record, reviewer = under_review_record(api)
    body = review_request(
        record,
        [record["handoff"]["evidence_ids"][1]],
        "request_correction",
        "ADDITIONAL_EVIDENCE_REQUIRED",
    )
    response = _decide(api, reviewer, body)
    assert response.status_code == 422
    assert {"field": "requested_correction", "reason": "required"} in response.json()["error"][
        "field_issues"
    ]


@pytest.mark.parametrize(
    "username", ["manager.demo", "recycler.demo", "collector.demo", "safety-admin.demo"]
)
def test_unauthorized_roles_cannot_decide(api: TestClient, username: str) -> None:
    record, _ = under_review_record(api)
    body = review_request(
        record, [record["handoff"]["evidence_ids"][1]], "approve", "EVIDENCE_SUFFICIENT"
    )
    assert _decide(api, auth(api, username), body).status_code == 403


def test_reviewer_must_decide_as_themselves(api: TestClient) -> None:
    record, reviewer = under_review_record(api)
    body = review_request(
        record,
        [record["handoff"]["evidence_ids"][1]],
        "approve",
        "EVIDENCE_SUFFICIENT",
        reviewer_id="0199b004-0004-7004-8004-000000000004",
    )
    body["idempotency"]["scope"]["actor_id"] = "0199b003-0003-7003-8003-000000000003"
    assert _decide(api, reviewer, body).status_code == 403


def test_records_not_under_review_cannot_be_decided(api: TestClient) -> None:
    record, _ = received_record(api, weight=31, seed=720)
    reviewer = auth(api, "reviewer.demo")
    body = review_request(
        record,
        [record["handoff"]["evidence_ids"][1]],
        "approve",
        "EVIDENCE_SUFFICIENT",
        previous_record_state="received",
    )
    response = _decide(api, reviewer, body)
    assert response.status_code == 409
    assert response.json()["error"]["safe_details"]["reason"] == "NOT_UNDER_REVIEW"
