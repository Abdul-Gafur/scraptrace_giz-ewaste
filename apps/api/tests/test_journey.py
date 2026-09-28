"""End-to-end backend journey: collector → recycler → reviewer, over HTTP only."""

from __future__ import annotations

import sqlalchemy as sa
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.core.config import Settings
from apps.api.app.db.models import AuditEvent
from apps.api.app.domain.integrity import recovery_record_digest
from apps.api.app.main import create_app
from apps.api.tests.conftest import FakePredictor, image_bytes
from apps.api.tests.support.api import auth, query
from apps.api.tests.support.builders import vision_result
from apps.api.tests.support.handoff import handoff_photos, handoff_request
from apps.api.tests.support.records import (
    confirmation,
    created_record,
    draft_metadata,
    photo,
    upload_evidence,
)
from apps.api.tests.support.workflow import processing_photo, processing_request, review_request
from fastapi.testclient import TestClient


def test_collector_to_reviewer_journey(api: TestClient, api_settings: Settings) -> None:
    collector = auth(api, "collector.demo")
    recycler = auth(api, "recycler.demo")
    reviewer = auth(api, "reviewer.demo")
    manager = auth(api, "manager.demo")

    # 1. The collector appraises a photograph (not stored) and corrects the suggestion.
    appraisal = api.post(
        "/v1/vision/appraise",
        headers=collector,
        files={"image": ("item.jpg", image_bytes(), "image/jpeg")},
    )
    assert appraisal.status_code == 200 and appraisal.json()["outcome"] == "classified"
    prediction = vision_result("televisions", appraisal.json()["confidence"])
    # The session's actor reference is used exactly as a client would copy it.
    me = api.get("/v1/auth/me", headers=collector).json()["data"]
    corrected = confirmation(
        "microwaves", source="human_correction", reason="The photograph shows a microwave."
    )
    corrected["confirmed_by"] = me["actor_reference"]
    metadata = draft_metadata(
        "microwaves",
        vision_result=prediction,
        category_confirmation=corrected,
        approximate_weight={"value": 18, "unit": "kg"},
    )
    draft = created_record(api, collector, metadata=metadata, image=photo(900))
    assert draft["vision_result"]["suggested_category"] == "televisions"
    assert draft["category"] == "microwaves"

    # 2. Adds a second photograph and submits.
    extra = upload_evidence(
        api,
        collector,
        draft["record_id"],
        "additional_item_photo",
        image=photo(901),
        capture_source="in_app_camera",
    )
    assert extra.status_code == 201
    submitted = api.post(
        f"/v1/recovery-records/{draft['record_id']}/submissions", headers=collector
    )
    record = submitted.json()["data"]["record"]
    assert record["business_state"] == "awaiting_handoff"
    qr = record["qr_payload"]

    # 3. The recycler scans the QR and sees only the handoff preview.
    lookup = api.post(
        "/v1/handoff-lookups",
        headers=recycler,
        json={
            "qr_text": f"SCRAPTRACE:{qr['contract_version']}:{qr['record_id']}:{qr['lookup_token']}"
        },
    ).json()["data"]
    assert lookup["outcome"] == "ready" and "capture_location" not in lookup["record"]

    # 4. Confirms receipt at 31 kg against 18 kg declared: a weight discrepancy.
    evidence_ids = handoff_photos(api, recycler, record["record_id"], seed=902)
    handoff = api.post(
        "/v1/handoffs",
        headers=recycler,
        json=handoff_request(record, evidence_ids, weight=31, lookup_token=lookup["lookup_token"]),
    ).json()["data"]
    assert handoff["outcome"] == "discrepancy" and handoff["flag_codes"] == ["WEIGHT_DISCREPANCY"]

    # 5. Prepares processing as a draft, corrects an entry, then submits.
    queue = api.get("/v1/processing-queue", headers=recycler).json()["data"]["items"]
    assert [item["record_id"] for item in queue] == [record["record_id"]]
    base = f"/v1/recovery-records/{record['record_id']}/processing"
    api.put(base, headers=recycler, json={"processing_method": "material_recovery"})
    added = api.post(
        f"{base}/material-entries",
        headers=recycler,
        json={"material": "Steel casing", "weight": {"value": 9.0, "unit": "kg"}},
    ).json()["data"]
    api.patch(
        f"{base}/material-entries/{added['material_entries'][0]['entry_id']}",
        headers=recycler,
        json={"weight": {"value": 8.4, "unit": "kg"}},
    )
    completion = processing_photo(api, recycler, record["record_id"], seed=905)
    processed = api.post(
        "/v1/processing-submissions",
        headers=recycler,
        json=processing_request(
            record, [completion], entries=[("Steel casing", 8.4), ("Transformer copper", 1.6)]
        ),
    ).json()["data"]
    assert processed["outcome"] == "review_required"

    # 6. The reviewer finds the case, reviews evidence and timeline, asks for a correction.
    cases = api.get("/v1/review-cases?flag_code=WEIGHT_DISCREPANCY", headers=reviewer)
    [case] = cases.json()["data"]["items"]
    assert case["decision_eligible"] is True
    detail = api.get(f"/v1/review-cases/{case['case_id']}", headers=reviewer).json()["data"]
    under_review = detail["record"]
    considered = [
        item["evidence_id"]
        for item in detail["evidence"]
        if item["evidence_type"] == "weight_measurement"
    ]
    correction = api.post(
        "/v1/review-decisions",
        headers=reviewer,
        json=review_request(
            under_review,
            considered,
            "request_correction",
            "ADDITIONAL_EVIDENCE_REQUIRED",
            requested_correction="Photograph the scale display with the item on it.",
        ),
    )
    assert correction.json()["data"]["resulting_review_state"] == "awaiting_information"

    # 7. The recycler returns clearer scale evidence; the reviewer approves.
    clearer = upload_evidence(
        api, recycler, record["record_id"], "weight_measurement", image=photo(906)
    )
    assert clearer.status_code == 201
    approval = api.post(
        "/v1/review-decisions",
        headers=reviewer,
        json=review_request(
            under_review,
            [clearer.json()["data"]["evidence_id"]],
            "approve",
            "WEIGHT_EXPLAINED",
            previous_review_state="awaiting_information",
        ),
    ).json()["data"]
    assert approval["resulting_record_state"] == "approved_and_completed"

    # 8. Every role sees the same final, contract-valid record within its scope.
    final = api.get(f"/v1/recovery-records/{record['record_id']}", headers=manager).json()["data"]
    REGISTRY.check_response("recovery_record", final)
    assert final["business_state"] == "approved_and_completed"
    assert final["integrity_digest"] == recovery_record_digest(final)
    assert final["vision_result"]["suggested_category"] == "televisions"  # never overwritten
    timeline = api.get(f"/v1/recovery-records/{record['record_id']}/events", headers=collector)
    assert [event["event_type"] for event in timeline.json()["data"]] == [
        "submit_record",
        "publish_for_handoff",
        "record_handoff",
        "record_processing",
        "flag_for_review",
        "request_correction",
        "approve_review",
    ]

    # 9. The terminal record cannot be reopened, and state survives a restart.
    reject = review_request(
        under_review,
        considered,
        "reject",
        "EVIDENCE_INSUFFICIENT",
        previous_review_state="approved",
        previous_record_state="approved_and_completed",
    )
    assert api.post("/v1/review-decisions", headers=reviewer, json=reject).status_code == 409
    with TestClient(create_app(settings=api_settings, predictor=FakePredictor())) as restarted:
        again = restarted.get(
            f"/v1/recovery-records/{record['record_id']}", headers=auth(restarted, "collector.demo")
        )
    assert again.json()["data"]["business_state"] == "approved_and_completed"

    async def actions(session: sa.ext.asyncio.AsyncSession) -> set[str]:
        return set((await session.execute(sa.select(AuditEvent.action))).scalars())

    assert {
        "recovery-record.created",
        "evidence.uploaded",
        "recovery-record.submitted",
        "qr-token.issued",
        "qr-lookup.resolved",
        "handoff.recorded",
        "review-case.opened",
        "processing.submitted",
        "review-case.accessed",
        "review-decision.recorded",
    } <= query(api_settings, actions)


def test_unflagged_record_reaches_verified_completion_without_review(api: TestClient) -> None:
    collector = auth(api, "collector.demo")
    recycler = auth(api, "recycler.demo")
    record = created_record(api, collector, image=photo(950))
    record = api.post(
        f"/v1/recovery-records/{record['record_id']}/submissions", headers=collector
    ).json()["data"]["record"]
    evidence = handoff_photos(api, recycler, record["record_id"], seed=951)
    accepted = api.post(
        "/v1/handoffs", headers=recycler, json=handoff_request(record, evidence, weight=14.2)
    )
    assert accepted.json()["data"]["outcome"] == "accepted"
    completion = processing_photo(api, recycler, record["record_id"], seed=953)
    processed = api.post(
        "/v1/processing-submissions",
        headers=recycler,
        json=processing_request(
            record, [completion], entries=[("Glass", 4.0), ("Circuit boards", 1.1)]
        ),
    ).json()["data"]
    assert processed["outcome"] == "processing_recorded"
    final = api.get(f"/v1/recovery-records/{record['record_id']}", headers=collector).json()["data"]
    assert final["business_state"] == "approved_and_completed"
    assert final["review"]["review_state"] == "not_required"
    assert (
        api.get("/v1/review-cases", headers=auth(api, "reviewer.demo")).json()["data"]["items"]
        == []
    )
