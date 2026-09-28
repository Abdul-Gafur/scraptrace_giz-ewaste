"""Recovery records: drafts, editing, category confirmation, submission, visibility, lists."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
import sqlalchemy as sa
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.core.config import Settings
from apps.api.app.db.models import AuditEvent, RecoveryRecord
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.integrity import recovery_record_digest
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.app.main import create_app
from apps.api.app.seed import OTHER_FACILITY_LOCATION_ID, PROGRAMME_ID, SEED_USER_IDS
from apps.api.tests.conftest import FakePredictor
from apps.api.tests.support.api import auth, query
from apps.api.tests.support.builders import vision_result
from apps.api.tests.support.records import (
    confirmation,
    create_draft,
    created_record,
    draft_metadata,
    photo,
    submitted_record,
)
from fastapi.testclient import TestClient


def _record_ok(data: dict[str, Any]) -> None:
    REGISTRY.check_response("recovery_record", data)


# Creation ----------------------------------------------------------------------------------


def test_collector_creates_a_contract_valid_draft(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    response = create_draft(api, headers)
    assert response.status_code == 201
    data = response.json()["data"]
    _record_ok(data)
    assert data["business_state"] == "draft"
    assert data["handoff_state"] == "not_started"
    assert data["collector"]["actor_id"] == str(SEED_USER_IDS["collector.demo"])
    assert "qr_payload" not in data  # credentials are served only by the owner operation
    assert data["destination"]["verification_status"] == "programme_verified"
    assert response.headers["etag"] == f'"{data["revision"]}"'
    assert response.headers["location"] == f"/v1/recovery-records/{data['record_id']}"

    evidence = api.get(f"/v1/recovery-records/{data['record_id']}/evidence", headers=headers)
    [original] = evidence.json()["data"]
    assert original["evidence_id"] == data["original_image_evidence_id"]
    assert original["evidence_type"] == "original_item_photo"
    assert original["provenance"]["ai_observation"]["original_prediction"] == "televisions"
    assert "storage_reference" not in original
    assert "untrusted" not in evidence.text  # the client file name is never stored or echoed


def test_offline_client_identifiers_are_kept(api: TestClient) -> None:
    record_id, evidence_id = str(uuid7()), str(uuid7())
    metadata = draft_metadata(record_id=record_id)
    metadata["original_image"]["evidence_id"] = evidence_id
    data = created_record(api, auth(api, "collector.demo"), metadata=metadata)
    assert data["record_id"] == record_id
    assert data["original_image_evidence_id"] == evidence_id


def test_mixed_scrap_is_a_weighed_batch(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    data = created_record(
        api, headers, metadata=draft_metadata("mixed_scrap", item_count=None, record_kind=None)
    )
    assert data["record_kind"] == "batch"
    unweighed = draft_metadata("mixed_scrap", approximate_weight=None)
    assert create_draft(api, headers, metadata=unweighed).status_code == 422
    as_item = draft_metadata("mixed_scrap", record_kind="item")
    rejected = create_draft(api, headers, metadata=as_item)
    assert rejected.status_code == 422
    assert {"field": "record_kind", "reason": "mixed_scrap_must_be_batch"} in rejected.json()[
        "error"
    ]["field_issues"]


def test_creation_is_idempotent(api: TestClient, api_settings: Settings) -> None:
    headers = auth(api, "collector.demo")
    metadata, image = draft_metadata(), photo(7)
    first = create_draft(api, headers, metadata=metadata, image=image, key="create-draft-000001")
    again = create_draft(api, headers, metadata=metadata, image=image, key="create-draft-000001")
    assert first.status_code == again.status_code == 201
    assert again.headers["idempotent-replayed"] == "true"
    assert again.json()["data"] == first.json()["data"]
    different = create_draft(
        api, headers, metadata=metadata, image=photo(8), key="create-draft-000001"
    )
    assert different.status_code == 409
    assert different.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

    async def count(session: sa.ext.asyncio.AsyncSession) -> int:
        return int(await session.scalar(sa.select(sa.func.count()).select_from(RecoveryRecord)))

    assert query(api_settings, count) == 1


def test_creation_requires_an_idempotency_key(api: TestClient) -> None:
    response = api.post(
        "/v1/recovery-records",
        headers=auth(api, "collector.demo"),
        data={"record": "{}"},
        files={"original_image": ("x.jpg", photo(), "image/jpeg")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"] == [
        {"field": "Idempotency-Key", "reason": "required"}
    ]


def _issues(response: Any) -> list[dict[str, str]]:
    return list(response.json()["error"].get("field_issues", []))


@pytest.mark.parametrize(
    ("metadata", "issue"),
    [
        (
            draft_metadata(category="phones"),
            {"field": "record.category", "reason": "unsupported_value"},
        ),
        (
            draft_metadata(unexpected=True),
            {"field": "record.unexpected", "reason": "unexpected_field"},
        ),
        (
            draft_metadata(approximate_weight={"value": -1, "unit": "kg"}),
            {"field": "record.approximate_weight.value", "reason": "below_minimum"},
        ),
        (
            draft_metadata(category_confirmation=confirmation("microwaves")),
            {"field": "category_confirmation.confirmed_category", "reason": "must_match_category"},
        ),
        (
            draft_metadata(
                category_confirmation=confirmation(actor_id=SEED_USER_IDS["collector-two.demo"])
            ),
            {
                "field": "category_confirmation.confirmed_by",
                "reason": "must_be_signed_in_collector",
            },
        ),
        (
            draft_metadata(vision_result=vision_result("televisions", 0.3, low=True)),
            {"field": "category_confirmation.source", "reason": "prediction_not_acceptable"},
        ),
        (
            draft_metadata(vision_result={**vision_result("televisions"), "confidence": 0.5}),
            {"field": "vision_result.confidence", "reason": "must_equal_selected_score"},
        ),
        (
            draft_metadata(captured_at=format_timestamp(utc_now() + timedelta(hours=2))),
            {"field": "captured_at", "reason": "in_future"},
        ),
        (
            draft_metadata(destination_location_id=str(uuid7())),
            {"field": "destination_location_id", "reason": "unknown_location"},
        ),
    ],
)
def test_invalid_drafts_are_rejected_with_field_issues(
    api: TestClient, metadata: dict[str, Any], issue: dict[str, str]
) -> None:
    response = create_draft(api, auth(api, "collector.demo"), metadata=metadata)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_FAILED"
    assert issue in _issues(response)


def test_low_confidence_prediction_can_be_manually_confirmed(api: TestClient) -> None:
    metadata = draft_metadata(
        vision_result=vision_result("televisions", 0.3, low=True),
        category_confirmation=confirmation("televisions", source="manual_selection"),
    )
    data = created_record(api, auth(api, "collector.demo"), metadata=metadata)
    assert data["vision_result"]["low_confidence"] is True
    assert data["category_confirmation"]["source"] == "manual_selection"


@pytest.mark.parametrize(
    ("image", "content_type", "status"),
    [(b"not an image", "image/jpeg", 422), (b"GIF89a", "image/gif", 415), (b"", "image/jpeg", 422)],
)
def test_invalid_photographs_are_rejected(
    api: TestClient, image: bytes, content_type: str, status: int
) -> None:
    response = create_draft(
        api, auth(api, "collector.demo"), image=image, content_type=content_type
    )
    assert response.status_code == status


@pytest.mark.parametrize("username", ["recycler.demo", "reviewer.demo", "safety-admin.demo"])
def test_only_collectors_create_records(api: TestClient, username: str) -> None:
    response = create_draft(api, auth(api, username))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


# Visibility -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("username", "status"),
    [
        ("collector.demo", 200),
        ("collector-two.demo", 404),
        ("recycler.demo", 404),
        ("reviewer.demo", 404),
        ("manager.demo", 404),
        ("safety-admin.demo", 403),
        ("ml-reviewer.demo", 403),
    ],
)
def test_drafts_are_private_to_their_collector(api: TestClient, username: str, status: int) -> None:
    record = created_record(api, auth(api, "collector.demo"))
    response = api.get(f"/v1/recovery-records/{record['record_id']}", headers=auth(api, username))
    assert response.status_code == status


@pytest.mark.parametrize(
    ("username", "status", "coordinates"),
    [
        ("collector.demo", 200, True),
        ("recycler.demo", 200, False),
        ("recycler-ashanti.demo", 404, None),
        ("reviewer.demo", 200, True),
        ("manager.demo", 200, True),
        ("collector-two.demo", 404, None),
        ("safety-admin.demo", 403, None),
    ],
)
def test_submitted_record_visibility_and_field_shaping(
    api: TestClient, username: str, status: int, coordinates: bool | None
) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    response = api.get(f"/v1/recovery-records/{record['record_id']}", headers=auth(api, username))
    assert response.status_code == status
    if status == 200:
        _record_ok(response.json()["data"])
        assert ("capture_location" in response.json()["data"]) is coordinates


def test_record_ids_do_not_reveal_existence(api: TestClient) -> None:
    headers = auth(api, "collector-two.demo")
    private = created_record(api, auth(api, "collector.demo"))
    missing = api.get(f"/v1/recovery-records/{uuid7()}", headers=headers)
    hidden = api.get(f"/v1/recovery-records/{private['record_id']}", headers=headers)
    assert missing.status_code == hidden.status_code == 404
    assert missing.json()["error"]["message"] == hidden.json()["error"]["message"]


# Editing and category confirmation -----------------------------------------------------------


def test_draft_update_requires_the_current_revision(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    url = f"/v1/recovery-records/{record['record_id']}"
    missing = api.patch(url, headers=headers, json={"condition": "working"})
    assert missing.status_code == 428
    stale = api.patch(url, headers={**headers, "If-Match": '"999"'}, json={"condition": "working"})
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "VERSION_CONFLICT"
    updated = api.patch(
        url,
        headers={**headers, "If-Match": f'"{record["revision"]}"'},
        json={"condition": "working", "item_count": 2, "capture_location": None},
    )
    assert updated.status_code == 200
    data = updated.json()["data"]
    assert (data["condition"], data["item_count"]) == ("working", 2)
    assert "capture_location" not in data
    assert data["revision"] > record["revision"]
    assert updated.headers["etag"] == f'"{data["revision"]}"'


def test_original_prediction_cannot_be_replaced(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    response = api.patch(
        f"/v1/recovery-records/{record['record_id']}",
        headers={**headers, "If-Match": f'"{record["revision"]}"'},
        json={"vision_result": vision_result("televisions", 0.9)},
    )
    assert response.status_code == 422
    assert _issues(response) == [
        {"field": "vision_result", "reason": "immutable_original_prediction"}
    ]


def test_vision_result_can_be_associated_once_with_a_manual_draft(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    metadata = draft_metadata(
        vision_result=None, category_confirmation=confirmation(source="manual_selection")
    )
    record = created_record(api, headers, metadata=metadata)
    appraisal = vision_result("televisions", 0.72)
    associated = api.patch(
        f"/v1/recovery-records/{record['record_id']}",
        headers={**headers, "If-Match": f'"{record["revision"]}"'},
        json={"vision_result": appraisal},
    )
    assert associated.status_code == 200
    assert associated.json()["data"]["vision_result"] == appraisal
    evidence = api.get(f"/v1/recovery-records/{record['record_id']}/evidence", headers=headers)
    assert evidence.json()["data"][0]["provenance"]["ai_observation"]["confidence"] == 0.72


def test_collector_corrects_the_suggested_category(api: TestClient, api_settings: Settings) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    correction = confirmation(
        "microwaves", source="human_correction", reason="The photograph shows a microwave."
    )
    response = api.post(
        f"/v1/recovery-records/{record['record_id']}/category-confirmations",
        headers={**headers, "If-Match": f'"{record["revision"]}"'},
        json=correction,
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["category"] == "microwaves"
    assert data["category_confirmation"] == correction
    # The original prediction is preserved, not overwritten by the correction (FR-VIS-006).
    assert data["vision_result"] == record["vision_result"]

    async def audit(session: sa.ext.asyncio.AsyncSession) -> list[dict[str, Any]]:
        result = await session.execute(
            sa.select(AuditEvent.details).where(
                AuditEvent.action == "recovery-record.category-confirmed"
            )
        )
        return list(result.scalars().all())

    assert query(api_settings, audit) == [
        {
            "previous_category": "televisions",
            "previous_source": "accepted_prediction",
            "confirmed_category": "microwaves",
            "source": "human_correction",
        }
    ]


def test_other_collectors_cannot_edit_a_draft(api: TestClient) -> None:
    record = created_record(api, auth(api, "collector.demo"))
    response = api.patch(
        f"/v1/recovery-records/{record['record_id']}",
        headers={**auth(api, "collector-two.demo"), "If-Match": f'"{record["revision"]}"'},
        json={"condition": "working"},
    )
    assert response.status_code == 404


# Submission and lifecycle -----------------------------------------------------------------


def test_submission_runs_the_state_machine_and_records_the_timeline(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    response = api.post(f"/v1/recovery-records/{record['record_id']}/submissions", headers=headers)
    assert response.status_code == 200
    body = response.json()["data"]
    assert (body["outcome"], body["replayed"], body["flag_codes"]) == ("submitted", False, [])
    submitted = body["record"]
    _record_ok(submitted)
    assert submitted["business_state"] == "awaiting_handoff"
    assert submitted["handoff_state"] == "awaiting"
    assert submitted["integrity_digest"] == recovery_record_digest(submitted)

    events = api.get(f"/v1/recovery-records/{record['record_id']}/events", headers=headers)
    timeline = events.json()["data"]
    for event in timeline:
        REGISTRY.check_response("recovery_record_event", event)
    assert [(e["event_type"], e["actor_role"], e["resulting_state"]) for e in timeline] == [
        ("draft_created", "collector", "draft"),
        ("appraisal_recorded", "collector", "draft"),
        ("category_confirmed", "collector", "draft"),
        ("submit_record", "collector", "submitted"),
        ("publish_for_handoff", "system", "awaiting_handoff"),
        ("qr_issued", "system", "awaiting_handoff"),
    ]
    assert timeline[0]["evidence_id"] == record["original_image_evidence_id"]
    assert timeline[3]["actor"]["actor_id"] == str(SEED_USER_IDS["collector.demo"])
    assert "actor" not in timeline[4] and "actor" not in timeline[5]


def test_repeated_submission_is_one_logical_mutation(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = submitted_record(api, headers)
    url = f"/v1/recovery-records/{record['record_id']}"
    for _ in range(2):
        again = api.post(f"{url}/submissions", headers=headers)
        assert again.status_code == 200
        assert again.json()["data"]["replayed"] is True
    events = api.get(f"{url}/events", headers=headers).json()["data"]
    assert [event["event_type"] for event in events].count("submit_record") == 1
    assert [event["event_type"] for event in events].count("qr_issued") == 1


def test_submitted_records_are_no_longer_editable(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = submitted_record(api, headers)
    response = api.patch(
        f"/v1/recovery-records/{record['record_id']}",
        headers={**headers, "If-Match": f'"{record["revision"]}"'},
        json={"condition": "working"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.parametrize(
    ("username", "status"), [("collector-two.demo", 404), ("recycler.demo", 403)]
)
def test_only_the_owner_can_submit(api: TestClient, username: str, status: int) -> None:
    record = created_record(api, auth(api, "collector.demo"))
    response = api.post(
        f"/v1/recovery-records/{record['record_id']}/submissions", headers=auth(api, username)
    )
    assert response.status_code == status


def test_exact_photograph_reuse_is_flagged_not_blocked(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    image = photo(42)
    submitted_record(api, headers, image=image)
    duplicate = created_record(api, headers, image=image)
    response = api.post(
        f"/v1/recovery-records/{duplicate['record_id']}/submissions", headers=headers
    )
    body = response.json()["data"]
    assert body["outcome"] == "duplicate_image"
    assert body["flag_codes"] == ["DUPLICATE_EVIDENCE_DIGEST"]
    assert body["record"]["business_state"] == "awaiting_handoff"
    assert body["record"]["review"]["review_state"] == "open"


def test_submitted_records_survive_an_application_restart(
    api: TestClient, api_settings: Settings
) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    with TestClient(create_app(settings=api_settings, predictor=FakePredictor())) as restarted:
        response = restarted.get(
            f"/v1/recovery-records/{record['record_id']}", headers=auth(restarted, "collector.demo")
        )
    assert response.status_code == 200
    assert response.json()["data"] == record


# Listing ----------------------------------------------------------------------------------


def test_lists_are_scoped_paginated_and_filtered(api: TestClient) -> None:
    collector = auth(api, "collector.demo")
    first = submitted_record(api, collector)
    second = created_record(api, collector, metadata=draft_metadata("microwaves"))
    third = submitted_record(api, collector, metadata=draft_metadata("refrigerators"))
    other = SEED_USER_IDS["collector-two.demo"]
    created_record(
        api,
        auth(api, "collector-two.demo"),
        metadata=draft_metadata(category_confirmation=confirmation(actor_id=other)),
    )

    page = api.get("/v1/recovery-records?limit=2", headers=collector).json()["data"]
    assert [item["record_id"] for item in page["items"]] == [
        third["record_id"],
        second["record_id"],
    ]
    assert page["pagination"]["has_more"] is True
    rest = api.get(
        f"/v1/recovery-records?limit=2&cursor={page['pagination']['next_cursor']}",
        headers=collector,
    ).json()["data"]
    assert [item["record_id"] for item in rest["items"]] == [first["record_id"]]
    assert rest["pagination"] == {"next_cursor": None, "has_more": False}

    drafts = api.get("/v1/recovery-records?state=draft", headers=collector).json()["data"]
    assert [item["record_id"] for item in drafts["items"]] == [second["record_id"]]
    fridges = api.get(
        "/v1/recovery-records?category=refrigerators&sort=captured_at", headers=collector
    ).json()["data"]
    assert [item["record_id"] for item in fridges["items"]] == [third["record_id"]]

    recycler = api.get("/v1/recovery-records", headers=auth(api, "recycler.demo")).json()["data"]
    assert {item["record_id"] for item in recycler["items"]} == {
        first["record_id"],
        third["record_id"],
    }
    elsewhere = api.get("/v1/recovery-records", headers=auth(api, "recycler-ashanti.demo")).json()[
        "data"
    ]
    assert elsewhere["items"] == []


def test_list_rejects_bad_parameters(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    assert (
        api.get("/v1/recovery-records?cursor=bm90LWEtY3Vyc29y", headers=headers).status_code == 422
    )
    assert api.get("/v1/recovery-records?state=deleted", headers=headers).status_code == 422
    assert api.get("/v1/recovery-records?limit=101", headers=headers).status_code == 422
    assert api.get("/v1/recovery-records?sort=collector_id", headers=headers).status_code == 422


def test_list_is_denied_to_roles_without_record_access(api: TestClient) -> None:
    for username in ("safety-admin.demo", "ml-reviewer.demo"):
        assert api.get("/v1/recovery-records", headers=auth(api, username)).status_code == 403


def test_destination_decides_which_facility_sees_the_record(api: TestClient) -> None:
    metadata = draft_metadata(destination_location_id=str(OTHER_FACILITY_LOCATION_ID))
    record = submitted_record(api, auth(api, "collector.demo"), metadata=metadata)
    assert record["destination"]["location_id"] == str(OTHER_FACILITY_LOCATION_ID)
    assert record["collector"]["programme_id"] == str(PROGRAMME_ID)
    url = f"/v1/recovery-records/{record['record_id']}"
    assert api.get(url, headers=auth(api, "recycler-ashanti.demo")).status_code == 200
    assert api.get(url, headers=auth(api, "recycler.demo")).status_code == 404
