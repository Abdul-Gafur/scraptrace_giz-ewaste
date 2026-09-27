"""Secure QR lookup and recycler handoff."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import pytest
import sqlalchemy as sa
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.core.config import Settings
from apps.api.app.db.models import (
    AuditEvent,
    Evidence,
    Handoff,
    QrLookupToken,
    RecoveryRecord,
    ReviewCase,
)
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import format_timestamp, utc_now
from apps.api.app.main import create_app
from apps.api.app.seed import (
    OTHER_FACILITY_LOCATION_ID,
    RECYCLER_LOCATION_ID,
    SEED_USER_IDS,
)
from apps.api.tests.conftest import FakePredictor, build_settings
from apps.api.tests.support.api import auth, query, seed_database
from apps.api.tests.support.handoff import handoff_photos, handoff_request
from apps.api.tests.support.records import (
    created_record,
    draft_metadata,
    photo,
    submitted_record,
    upload_evidence,
)
from fastapi.testclient import TestClient


def _lookup(client: TestClient, headers: dict[str, str], body: dict[str, Any]) -> Any:
    return client.post("/v1/handoff-lookups", headers=headers, json=body)


def _handoff(client: TestClient, headers: dict[str, str], body: dict[str, Any]) -> Any:
    return client.post("/v1/handoffs", headers=headers, json=body)


def _ready(api: TestClient, **kwargs: Any) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    record = submitted_record(api, auth(api, "collector.demo"), **kwargs)
    recycler = auth(api, "recycler.demo")
    return record, recycler, handoff_photos(api, recycler, record["record_id"])


# QR issuing and privacy --------------------------------------------------------------------


def test_submitted_record_carries_a_privacy_safe_qr_payload(
    api: TestClient, api_settings: Settings
) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    payload = record["qr_payload"]
    REGISTRY.check_response("qr_payload", payload)
    assert set(payload) == {"contract_version", "record_id", "lookup_token"}
    token = payload["lookup_token"]
    assert record["record_id"] not in token and record["human_reference"] not in token

    async def stored(session: sa.ext.asyncio.AsyncSession) -> list[tuple[Any, ...]]:
        rows = await session.execute(sa.select(QrLookupToken))
        return [tuple(vars(row).values()) for row in rows.scalars()]

    rows = query(api_settings, stored)
    assert rows and all(token not in str(values) for values in rows)


def test_draft_tokens_are_inert_until_publication(api: TestClient) -> None:
    draft = created_record(api, auth(api, "collector.demo"))
    response = _lookup(api, auth(api, "recycler.demo"), {"qr_payload": draft["qr_payload"]})
    assert response.status_code == 404


# Lookup ------------------------------------------------------------------------------------


def test_recycler_resolves_every_presentation_form(api: TestClient) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    headers = auth(api, "recycler.demo")
    payload = record["qr_payload"]
    forms = [
        {"qr_payload": payload},
        {"qr_text": f"SCRAPTRACE:1.0.0:{payload['record_id']}:{payload['lookup_token']}"},
        {"lookup_token": payload["lookup_token"]},
        {"transfer_code": " " + record["human_reference"].lower().replace("-", "- ") + " "},
    ]
    for body in forms:
        response = _lookup(api, headers, body)
        assert response.status_code == 200, (body, response.text)
        result = response.json()["data"]
        assert result["outcome"] == "ready"
        assert result["lookup_token"] == payload["lookup_token"]
        preview = result["record"]
        assert preview["record_id"] == record["record_id"]
        assert "capture_location" not in preview
        assert "vision_result" not in preview and "qr_payload" not in preview


@pytest.mark.parametrize(
    "body",
    [
        {"lookup_token": "A" * 43},
        {"qr_text": "SCRAPTRACE:1.0.0:not-a-record:" + "a" * 43},
        {"qr_text": "https://example.org/somewhere"},
        {"transfer_code": "ST-NOTREAL00"},
    ],
)
def test_unknown_codes_reveal_nothing(
    api: TestClient, api_settings: Settings, body: dict[str, Any]
) -> None:
    submitted_record(api, auth(api, "collector.demo"))
    response = _lookup(api, auth(api, "recycler.demo"), body)
    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "RESOURCE_NOT_FOUND",
        "message": "No record matches this code.",
        "retryable": False,
    }

    async def failures(session: sa.ext.asyncio.AsyncSession) -> int:
        return int(
            await session.scalar(
                sa.select(sa.func.count())
                .select_from(AuditEvent)
                .where(AuditEvent.action == "qr-lookup.failed")
            )
        )

    assert query(api_settings, failures) == 1


def test_token_for_another_record_is_rejected(api: TestClient) -> None:
    collector = auth(api, "collector.demo")
    first = submitted_record(api, collector)
    second = submitted_record(api, collector)
    mixed = {**first["qr_payload"], "record_id": second["record_id"]}
    assert _lookup(api, auth(api, "recycler.demo"), {"qr_payload": mixed}).status_code == 404


def test_unsupported_qr_version_is_named(api: TestClient) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    payload = {**record["qr_payload"], "contract_version": "2.0.0"}
    response = _lookup(api, auth(api, "recycler.demo"), {"qr_payload": payload})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_CONTRACT_VERSION"


def test_lookup_requires_exactly_one_form(api: TestClient) -> None:
    headers = auth(api, "recycler.demo")
    assert _lookup(api, headers, {}).status_code == 422
    both = {"lookup_token": "a" * 43, "transfer_code": "ST-ABCDEFGH"}
    assert _lookup(api, headers, both).status_code == 422


def test_other_facility_learns_only_that_the_code_is_elsewhere(api: TestClient) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    response = _lookup(
        api, auth(api, "recycler-ashanti.demo"), {"qr_payload": record["qr_payload"]}
    )
    assert response.status_code == 200
    assert response.json()["data"] == {"outcome": "other_facility"}


@pytest.mark.parametrize("username", ["collector.demo", "reviewer.demo", "manager.demo"])
def test_only_recyclers_look_up_codes(api: TestClient, username: str) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    response = _lookup(api, auth(api, username), {"qr_payload": record["qr_payload"]})
    assert response.status_code == 403


def test_lookups_are_rate_limited(database_url: str, evidence_root: Any) -> None:
    settings = build_settings(
        database_url, lookup_rate_limit_attempts=2, evidence_storage_root=evidence_root
    )
    seed_database(settings)
    with TestClient(create_app(settings=settings, predictor=FakePredictor())) as client:
        headers = auth(client, "recycler.demo")
        for _ in range(2):
            assert _lookup(client, headers, {"lookup_token": "a" * 43}).status_code == 404
        limited = _lookup(client, headers, {"lookup_token": "a" * 43})
    assert limited.status_code == 429
    assert limited.headers["retry-after"]


def test_rotation_revokes_the_previous_code(api: TestClient) -> None:
    collector = auth(api, "collector.demo")
    record = submitted_record(api, collector)
    rotated = api.post(
        f"/v1/recovery-records/{record['record_id']}/qr-token-rotations", headers=collector
    )
    assert rotated.status_code == 201
    payload = rotated.json()["data"]
    REGISTRY.check_response("qr_payload", payload)
    assert payload["lookup_token"] != record["qr_payload"]["lookup_token"]
    recycler = auth(api, "recycler.demo")
    assert _lookup(api, recycler, {"qr_payload": record["qr_payload"]}).status_code == 404
    assert _lookup(api, recycler, {"qr_payload": payload}).json()["data"]["outcome"] == "ready"
    current = api.get(f"/v1/recovery-records/{record['record_id']}", headers=collector)
    assert current.json()["data"]["qr_payload"] == payload
    other = auth(api, "collector-two.demo")
    assert (
        api.post(
            f"/v1/recovery-records/{record['record_id']}/qr-token-rotations", headers=other
        ).status_code
        == 404
    )


def test_expired_codes_do_not_resolve(api: TestClient, api_settings: Settings) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    later = utc_now() + timedelta(days=api_settings.qr_token_ttl_days + 1)
    with TestClient(
        create_app(settings=api_settings, predictor=FakePredictor(), clock=lambda: later)
    ) as future:
        response = _lookup(
            future, auth(future, "recycler.demo"), {"qr_payload": record["qr_payload"]}
        )
    assert response.status_code == 404


# Handoff -----------------------------------------------------------------------------------


def test_recycler_confirms_handoff(api: TestClient, api_settings: Settings) -> None:
    record, recycler, evidence_ids = _ready(api)
    response = _handoff(api, recycler, handoff_request(record, evidence_ids))
    assert response.status_code == 201, response.text
    result = response.json()["data"]
    REGISTRY.check_response("handoff_response", result)
    assert result["outcome"] == "accepted" and result["replayed"] is False

    received = api.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler).json()[
        "data"
    ]
    REGISTRY.check_response("recovery_record", received)
    assert (received["business_state"], received["handoff_state"]) == ("received", "received")
    handoff = received["handoff"]
    assert handoff["measured_weight"] == {"value": 14.5, "unit": "kg"}
    assert handoff["recycler"]["actor_id"] == str(SEED_USER_IDS["recycler.demo"])
    assert len(handoff["evidence_ids"]) == 4

    evidence = api.get(
        f"/v1/recovery-records/{record['record_id']}/evidence", headers=recycler
    ).json()["data"]
    generated = {
        e["evidence_type"]: e
        for e in evidence
        if e["provenance"]["capture_source"] == "system_generated"
    }
    assert set(generated) == {"handoff_qr_scan", "recycler_receipt"}
    assert {e["evidence_id"] for e in generated.values()} <= set(handoff["evidence_ids"])

    events = api.get(f"/v1/recovery-records/{record['record_id']}/events", headers=recycler)
    assert events.json()["data"][-1]["event_type"] == "record_handoff"
    assert events.json()["data"][-1]["actor_role"] == "recycler"

    async def used(session: sa.ext.asyncio.AsyncSession) -> bool:
        token = await session.scalar(
            sa.select(QrLookupToken).where(QrLookupToken.revoked_at.is_(None))
        )
        return token is not None and token.used_at is not None

    assert query(api_settings, used)


def test_retried_handoff_replays_without_duplicating(
    api: TestClient, api_settings: Settings
) -> None:
    record, recycler, evidence_ids = _ready(api)
    body = handoff_request(record, evidence_ids)
    first = _handoff(api, recycler, body)
    retry = _handoff(api, recycler, {**body, "handoff_time": format_timestamp(utc_now())})
    assert (first.status_code, retry.status_code) == (201, 200)
    assert retry.json()["data"] == {**first.json()["data"], "replayed": True}
    conflicting = handoff_request(record, evidence_ids, weight=99.0)
    conflict = _handoff(api, recycler, conflicting)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

    async def handoffs(session: sa.ext.asyncio.AsyncSession) -> int:
        return int(await session.scalar(sa.select(sa.func.count()).select_from(Handoff)))

    assert query(api_settings, handoffs) == 1


def test_second_scan_reports_the_original_receipt(api: TestClient) -> None:
    record, recycler, evidence_ids = _ready(api)
    first = _handoff(api, recycler, handoff_request(record, evidence_ids)).json()["data"]
    again = _handoff(
        api, recycler, handoff_request(record, evidence_ids, key="record_handoff:second-scan-01")
    )
    assert again.status_code == 200
    assert again.json()["data"] == {
        "outcome": "duplicate_scan",
        "original_received_at": first["received_at"],
        "original_logical_result": "accepted",
    }
    lookup = _lookup(api, recycler, {"qr_payload": record["qr_payload"]}).json()["data"]
    assert lookup["outcome"] == "already_received"
    assert lookup["received_at"] == first["received_at"]


def test_weight_discrepancy_opens_a_review_case_atomically(
    api: TestClient, api_settings: Settings
) -> None:
    record, recycler, evidence_ids = _ready(api)
    response = _handoff(api, recycler, handoff_request(record, evidence_ids, weight=31))
    assert response.status_code == 201
    result = response.json()["data"]
    assert result["outcome"] == "discrepancy"
    assert result["flag_codes"] == ["WEIGHT_DISCREPANCY"]

    received = api.get(
        f"/v1/recovery-records/{record['record_id']}", headers=auth(api, "reviewer.demo")
    ).json()["data"]
    assert received["business_state"] == "received"
    assert received["handoff_state"] == "disputed"
    assert received["review"]["review_state"] == "open"
    assert received["review"]["flag_codes"] == ["WEIGHT_DISCREPANCY"]

    async def case(session: sa.ext.asyncio.AsyncSession) -> tuple[str, list[str], Any]:
        row = await session.scalar(sa.select(ReviewCase))
        assert row is not None
        return row.status, row.flag_codes, row.facility_id

    status, flags, facility = query(api_settings, case)
    assert (status, flags) == ("open", ["WEIGHT_DISCREPANCY"])
    assert str(facility) == "0199b011-0011-7011-8011-000000000011"


def test_grams_are_converted_before_comparing_weights(api: TestClient) -> None:
    record, recycler, evidence_ids = _ready(api)
    body = handoff_request(record, evidence_ids, weight=14800, unit="g")
    assert _handoff(api, recycler, body).json()["data"]["outcome"] == "accepted"


def test_category_disagreement_is_flagged(api: TestClient) -> None:
    record, recycler, evidence_ids = _ready(api)
    body = handoff_request(record, evidence_ids, category="microwaves")
    result = _handoff(api, recycler, body).json()["data"]
    assert result["flag_codes"] == ["CATEGORY_DISAGREEMENT"]


def test_reused_handoff_photographs_are_flagged(api: TestClient) -> None:
    first, recycler, first_evidence = _ready(api)
    _handoff(api, recycler, handoff_request(first, first_evidence))
    second = submitted_record(api, auth(api, "collector.demo"))
    reused = handoff_photos(api, recycler, second["record_id"], seed=200)
    result = _handoff(api, recycler, handoff_request(second, reused)).json()["data"]
    assert result["flag_codes"] == ["DUPLICATE_EVIDENCE_DIGEST"]


@pytest.mark.parametrize(
    ("overrides", "status", "code"),
    [
        ({"location_id": OTHER_FACILITY_LOCATION_ID}, 403, "PERMISSION_DENIED"),
        ({"location_id": uuid7()}, 422, "VALIDATION_FAILED"),
        ({"facility_id": "0199b012-0012-7012-8012-000000000012"}, 403, "PERMISSION_DENIED"),
        ({"recycler_id": SEED_USER_IDS["recycler-ashanti.demo"]}, 422, "VALIDATION_FAILED"),
        ({"currency": "USD"}, 422, "VALIDATION_FAILED"),
        ({"weight": 0}, 422, "VALIDATION_FAILED"),
        ({"unit": "lb"}, 422, "VALIDATION_FAILED"),
        ({"lookup_token": "Z" * 43}, 404, "RESOURCE_NOT_FOUND"),
        (
            {"handoff_time": format_timestamp(utc_now() + timedelta(days=1))},
            422,
            "VALIDATION_FAILED",
        ),
    ],
)
def test_invalid_handoffs_are_rejected(
    api: TestClient, overrides: dict[str, Any], status: int, code: str
) -> None:
    record, recycler, evidence_ids = _ready(api)
    response = _handoff(api, recycler, handoff_request(record, evidence_ids, **overrides))
    assert response.status_code == status, response.text
    assert response.json()["error"]["code"] == code
    unchanged = api.get(f"/v1/recovery-records/{record['record_id']}", headers=recycler)
    assert unchanged.json()["data"]["business_state"] == "awaiting_handoff"


def test_recycler_identity_must_be_the_signed_in_user(api: TestClient) -> None:
    record, recycler, evidence_ids = _ready(api)
    body = handoff_request(record, evidence_ids)
    body["recycler_reference"]["actor_id"] = str(SEED_USER_IDS["recycler-ashanti.demo"])
    response = _handoff(api, recycler, body)
    assert response.status_code == 403


def test_record_destined_elsewhere_cannot_be_received(api: TestClient) -> None:
    metadata = draft_metadata(destination_location_id=str(OTHER_FACILITY_LOCATION_ID))
    record = submitted_record(api, auth(api, "collector.demo"), metadata=metadata)
    recycler = auth(api, "recycler.demo")
    evidence = upload_evidence(api, recycler, record["record_id"], "handoff_photo")
    assert evidence.status_code == 404  # outside the recycler's facility scope


@pytest.mark.parametrize(
    ("types", "reason"),
    [
        (["handoff_photo"], "missing_weight_measurement"),
        (["weight_measurement"], "missing_handoff_photo"),
    ],
)
def test_handoff_requires_photo_and_scale_evidence(
    api: TestClient, types: list[str], reason: str
) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    recycler = auth(api, "recycler.demo")
    # Two photographs of one kind satisfy the contract's two-item minimum but not FR-HND-004.
    ids = [
        upload_evidence(api, recycler, record["record_id"], kind, image=photo(300 + index)).json()[
            "data"
        ]["evidence_id"]
        for index, kind in enumerate(types * 2)
    ]
    response = _handoff(api, recycler, handoff_request(record, ids))
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"] == [{"field": "evidence_ids", "reason": reason}]


def test_handoff_refuses_evidence_that_is_not_the_recyclers(api: TestClient) -> None:
    record, recycler, evidence_ids = _ready(api)
    foreign = [evidence_ids[0], record["original_image_evidence_id"]]
    response = _handoff(api, recycler, handoff_request(record, foreign))
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"] == [
        {"field": "evidence_ids", "reason": "invalid_reference"}
    ]


def test_only_recyclers_record_handoffs(api: TestClient) -> None:
    record, _, evidence_ids = _ready(api)
    for username in ("collector.demo", "reviewer.demo", "manager.demo"):
        response = _handoff(api, auth(api, username), handoff_request(record, evidence_ids))
        assert response.status_code == 403


def test_idempotency_scope_must_match_the_request(api: TestClient) -> None:
    record, recycler, evidence_ids = _ready(api)
    body = handoff_request(record, evidence_ids)
    body["idempotency"]["scope"]["operation"] = "record_processing"
    response = _handoff(api, recycler, body)
    assert response.status_code == 422
    assert response.json()["error"]["field_issues"] == [
        {"field": "idempotency.scope.operation", "reason": "must_be_record_handoff"}
    ]


def test_failed_handoff_rolls_back_every_change(
    api: TestClient, api_settings: Settings, evidence_root: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.api.app.services import handoff as handoff_module

    record, recycler, evidence_ids = _ready(api)
    files_before = {path for path in evidence_root.rglob("*") if path.is_file()}

    async def fail(*_: object, **__: object) -> None:
        raise RuntimeError("simulated failure while opening the review case")

    monkeypatch.setattr(handoff_module, "raise_flags", fail)
    with pytest.raises(RuntimeError):
        _handoff(api, recycler, handoff_request(record, evidence_ids, weight=40))

    async def state(session: sa.ext.asyncio.AsyncSession) -> tuple[Any, ...]:
        stored = await session.get(RecoveryRecord, uuid.UUID(record["record_id"]))
        counts = [
            await session.scalar(sa.select(sa.func.count()).select_from(model))
            for model in (Handoff, ReviewCase, Evidence)
        ]
        return (stored.business_state if stored else None, *counts)

    assert query(api_settings, state) == ("awaiting_handoff", 0, 0, 3)
    assert {path for path in evidence_root.rglob("*") if path.is_file()} == files_before


def test_submitted_record_at_recycler_location_is_receivable(api: TestClient) -> None:
    metadata = draft_metadata(destination_location_id=str(RECYCLER_LOCATION_ID))
    record, recycler, evidence_ids = _ready(api, metadata=metadata)
    body = handoff_request(record, evidence_ids, location_id=RECYCLER_LOCATION_ID)
    assert _handoff(api, recycler, body).status_code == 201
