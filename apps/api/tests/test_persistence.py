"""Repositories persist contract-aligned entities; transactions and history guards hold."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa
from apps.api.app.contracts import mappers, refinements
from apps.api.app.contracts.validation import ContractRegistry
from apps.api.app.core.config import CONTRACT_SCHEMA_DIRECTORY, Settings
from apps.api.app.core.passwords import PasswordService
from apps.api.app.db.models import (
    AuditEvent,
    Handoff,
    IdempotencyRecord,
    ProcessingRecord,
    QrLookupToken,
    RecoveredMaterialEntry,
    RecoveryRecord,
    RecoveryRecordEvent,
    ReviewCase,
    ReviewDecision,
)
from apps.api.app.db.session import Database
from apps.api.app.domain.identifiers import (
    derive_lookup_token,
    lookup_token_digest,
    new_token_nonce,
    uuid7,
)
from apps.api.app.domain.integrity import recovery_record_digest
from apps.api.app.domain.time import utc_now
from apps.api.app.repositories.identity import IdentityRepository
from apps.api.app.repositories.operations import AuditRepository, IdempotencyRepository
from apps.api.app.repositories.records import RecoveryRecordRepository
from apps.api.app.repositories.workflow import WorkflowRepository
from apps.api.app.seed import (
    FACILITY_ID,
    PROGRAMME_ID,
    RECYCLER_LOCATION_ID,
    SEED_USER_IDS,
    seed_reference_data,
)
from apps.api.tests.support.builders import evidence_model, record_model
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

COLLECTOR = SEED_USER_IDS["collector.demo"]
RECYCLER = SEED_USER_IDS["recycler.demo"]
REVIEWER = SEED_USER_IDS["reviewer.demo"]
QR_SECRET = b"q" * 32
REGISTRY = ContractRegistry(CONTRACT_SCHEMA_DIRECTORY)


async def _seed(database: Database, settings: Settings) -> None:
    async with database.session_scope() as session, session.begin():
        await seed_reference_data(session, PasswordService(settings), "demonstration-password")


async def _create_record(database: Database, state: str = "draft") -> uuid.UUID:
    async with database.session_scope() as session, session.begin():
        records = RecoveryRecordRepository(session)
        record = record_model(COLLECTOR, PROGRAMME_ID, state=state)
        records.add(record)
        await session.flush()
        photo = evidence_model(record.id, COLLECTOR, programme_id=PROGRAMME_ID)
        records.add_evidence(photo)
        await session.flush()
        record.original_image_evidence_id = photo.id
        token_id, nonce = uuid7(), new_token_nonce()
        records.add_qr_token(
            QrLookupToken(
                id=token_id,
                record_id=record.id,
                token_digest=lookup_token_digest(derive_lookup_token(QR_SECRET, token_id, nonce)),
                nonce=nonce,
            )
        )
        return record.id


async def test_seeded_identity_is_retrievable(database: Database, settings: Settings) -> None:
    await _seed(database, settings)
    async with database.session_scope() as session:
        identity = IdentityRepository(session)
        recycler = await identity.get_user_by_username("RECYCLER.demo ")
        assert recycler is not None
        assert [(role.role, role.facility_id) for role in recycler.role_assignments] == [
            ("recycler", FACILITY_ID)
        ]
        assert recycler.password_hash.startswith("$argon2id$")
        location = await identity.get_location(RECYCLER_LOCATION_ID)
        assert location is not None and location.facility.id == FACILITY_ID
        assert RECYCLER_LOCATION_ID in await identity.location_ids_for_facilities([FACILITY_ID])
        programme = await identity.get_programme(PROGRAMME_ID)
        assert programme is not None and programme.currency == "GHS"


async def test_full_record_graph_maps_to_valid_contract_objects(
    database: Database, settings: Settings
) -> None:
    await _seed(database, settings)
    record_id = await _create_record(database, state="under_review")
    now = utc_now()

    async with database.session_scope() as session, session.begin():
        records = RecoveryRecordRepository(session)
        workflow = WorkflowRepository(session)
        handoff_photo = evidence_model(
            record_id, RECYCLER, evidence_type="handoff_photo", digest="sha256:" + "b" * 64
        )
        weight_photo = evidence_model(
            record_id, RECYCLER, evidence_type="weight_measurement", digest="sha256:" + "c" * 64
        )
        decision_evidence = evidence_model(
            record_id, REVIEWER, evidence_type="reviewer_decision", digest="sha256:" + "d" * 64
        )
        for item in (handoff_photo, weight_photo, decision_evidence):
            records.add_evidence(item)
        records.add_event(
            RecoveryRecordEvent(
                record_id=record_id,
                event_schema_version="1.0.0",
                event_type="submit_record",
                actor_id=COLLECTOR,
                actor_programme_id=PROGRAMME_ID,
                actor_role="collector",
                occurred_at=now,
                previous_state="draft",
                resulting_state="submitted",
            )
        )
        workflow.add(
            Handoff(
                record_id=record_id,
                recycler_id=RECYCLER,
                recycler_programme_id=PROGRAMME_ID,
                recycler_facility_id=FACILITY_ID,
                collector_id=COLLECTOR,
                receiving_location_id=RECYCLER_LOCATION_ID,
                confirmed_category="televisions",
                confirmed_condition="damaged",
                measured_weight_value=31.5,
                measured_weight_unit="kg",
                final_price_amount=140.75,
                final_price_currency="GHS",
                handed_off_at=now,
                server_received_at=now,
                evidence_ids=[str(handoff_photo.id), str(weight_photo.id)],
                outcome="discrepancy",
                flag_codes=["WEIGHT_DISCREPANCY"],
            )
        )
        processing = ProcessingRecord(
            record_id=record_id,
            facility_id=FACILITY_ID,
            recycler_id=RECYCLER,
            recycler_programme_id=PROGRAMME_ID,
            status="submitted",
            processing_method="material_recovery",
            result="Casing and board separated.",
            processed_at=now,
            evidence_ids=[str(handoff_photo.id)],
            submitted_at=now,
        )
        workflow.add(processing)
        await session.flush()
        workflow.add(
            RecoveredMaterialEntry(
                processing_record_id=processing.id,
                material="Steel casing",
                weight_value=12.25,
                weight_unit="kg",
                position=0,
            )
        )
        case = ReviewCase(
            record_id=record_id,
            programme_id=PROGRAMME_ID,
            facility_id=FACILITY_ID,
            status="rejected",
            flag_codes=["WEIGHT_DISCREPANCY"],
            opened_at=now,
            opened_by_role="system",
        )
        workflow.add(case)
        await session.flush()
        workflow.add(
            ReviewDecision(
                review_case_id=case.id,
                record_id=record_id,
                reviewer_id=REVIEWER,
                reviewer_programme_id=PROGRAMME_ID,
                decision="reject",
                reason_code="WEIGHT_UNEXPLAINED",
                reviewer_note="Scale photograph does not match the record.",
                review_reason_codes=["WEIGHT_DISCREPANCY"],
                evidence_considered=[str(weight_photo.id)],
                decision_evidence_id=decision_evidence.id,
                decision_timestamp=now,
                previous_review_state="open",
                resulting_review_state="rejected",
                previous_record_state="under_review",
                resulting_record_state="rejected",
            )
        )
        IdempotencyRepository(session).add(
            IdempotencyRecord(
                actor_id=RECYCLER,
                operation="record_handoff",
                resource_scope=str(record_id),
                idempotency_key="record_handoff:fixture-0001",
                request_digest="sha256:" + "e" * 64,
                response_status=201,
                response_body={"outcome": "accepted"},
                expires_at=now + timedelta(days=30),
            )
        )
        AuditRepository(session).add(
            AuditEvent(
                action="handoff.recorded",
                outcome="succeeded",
                actor_id=RECYCLER,
                actor_role="recycler",
                target_type="recovery_record",
                target_id=str(record_id),
                details={"outcome": "discrepancy"},
            )
        )

    async with database.session_scope() as session:
        records = RecoveryRecordRepository(session)
        record = await records.get(record_id)
        assert record is not None
        token = record.qr_tokens[0]
        lookup_token = derive_lookup_token(QR_SECRET, token.id, token.nonce)
        assert token.token_digest == lookup_token_digest(lookup_token)
        contract = mappers.recovery_record(
            record, lookup_token=lookup_token, audience=mappers.FULL_AUDIENCE
        )
        REGISTRY.check_response("recovery_record", contract)
        assert refinements.recovery_record(contract) == []
        assert contract["handoff"]["measured_weight"] == {"value": 31.5, "unit": "kg"}
        assert contract["processing"]["material_entries"][0]["material"] == "Steel casing"
        assert contract["review"]["decision"] == "reject"
        assert contract["captured_at"] == "2026-09-20T09:00:00.000Z"
        assert recovery_record_digest(contract).startswith("sha256:")

        restricted = mappers.recovery_record(
            record,
            lookup_token=lookup_token,
            audience=mappers.RecordAudience(personal_data=False, reviewer_notes=False),
        )
        REGISTRY.check_response("recovery_record", restricted)
        assert "reviewer_note" not in restricted["review"]

        for item in await records.list_evidence(record_id):
            REGISTRY.check_response("evidence", mappers.evidence(item, personal_data=True))
        events = await records.list_events(record_id)
        assert [event.event_type for event in events] == ["submit_record"]
        REGISTRY.check_response("recovery_record_event", mappers.recovery_record_event(events[0]))
        assert await records.digest_used_elsewhere(
            ["sha256:" + "a" * 64], uuid7(), ["original_item_photo"]
        )
        stored = await IdempotencyRepository(session).find(
            RECYCLER, "record_handoff", str(record_id), "record_handoff:fixture-0001"
        )
        assert stored is not None and stored.response_body == {"outcome": "accepted"}


async def test_failed_transaction_rolls_back_every_row(
    database: Database, settings: Settings
) -> None:
    await _seed(database, settings)
    with pytest.raises(RuntimeError):
        async with database.session_scope() as session, session.begin():
            record = record_model(COLLECTOR, PROGRAMME_ID)
            RecoveryRecordRepository(session).add(record)
            await session.flush()
            raise RuntimeError("simulated failure after the first write")
    async with database.session_scope() as session:
        count = await session.scalar(sa.select(sa.func.count()).select_from(RecoveryRecord))
    assert count == 0


async def test_concurrent_update_is_rejected_by_revision(
    database: Database, settings: Settings
) -> None:
    await _seed(database, settings)
    record_id = await _create_record(database)
    first, second = database.session(), database.session()
    try:
        async with first.begin():
            stale = await first.get(RecoveryRecord, record_id)
        async with second.begin():
            fresh = await second.get(RecoveryRecord, record_id)
            assert fresh is not None
            fresh.condition = "working"
        assert stale is not None
        with pytest.raises(StaleDataError):
            async with first.begin():
                first.add(stale)
                stale.condition = "repairable"
    finally:
        await first.close()
        await second.close()


async def test_history_rows_cannot_be_updated_or_deleted(
    database: Database, settings: Settings
) -> None:
    await _seed(database, settings)
    record_id = await _create_record(database)
    async with database.session_scope() as session, session.begin():
        AuditRepository(session).add(
            AuditEvent(action="fixture.recorded", outcome="succeeded", details={})
        )
    for statement in (
        sa.update(AuditEvent).values(action="rewritten"),
        sa.delete(AuditEvent),
        sa.delete(RecoveryRecord).where(RecoveryRecord.id == record_id),
    ):
        with pytest.raises(IntegrityError):
            async with database.session_scope() as session, session.begin():
                await session.execute(statement)


async def test_constraints_reject_invalid_domain_values(
    database: Database, settings: Settings
) -> None:
    await _seed(database, settings)
    invalid = record_model(COLLECTOR, PROGRAMME_ID, category="mixed_scrap")
    invalid.record_kind = "item"
    with pytest.raises(IntegrityError):
        async with database.session_scope() as session, session.begin():
            session.add(invalid)


async def test_naive_datetimes_are_refused(database: Database, settings: Settings) -> None:
    await _seed(database, settings)
    naive = record_model(COLLECTOR, PROGRAMME_ID)
    naive.captured_at = datetime(2026, 9, 20, 9, 0)
    with pytest.raises(sa.exc.StatementError):
        async with database.session_scope() as session, session.begin():
            session.add(naive)
    aware = record_model(
        COLLECTOR,
        PROGRAMME_ID,
        captured_at=datetime(2026, 9, 20, 11, 0, tzinfo=timezone(timedelta(hours=2))),
    )
    async with database.session_scope() as session, session.begin():
        session.add(aware)
    async with database.session_scope() as session:
        stored = await session.get(RecoveryRecord, aware.id)
        assert stored is not None
        assert stored.captured_at == datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc)
        assert stored.captured_at.tzinfo is not None


async def test_seed_can_run_repeatedly_without_duplication(
    database: Database, settings: Settings
) -> None:
    passwords = PasswordService(settings)
    async with database.session_scope() as session, session.begin():
        first = await seed_reference_data(session, passwords, "demonstration-password")
    async with database.session_scope() as session, session.begin():
        second = await seed_reference_data(session, passwords, "demonstration-password")
    assert first.created > 0 and first.unchanged == 0
    assert second.created == 0 and second.unchanged == first.created
    async with database.session_scope() as session:
        users = await IdentityRepository(session).list_active_users()
    roles = {assignment.role for user in users for assignment in user.role_assignments}
    assert roles == {
        "collector",
        "recycler",
        "programme_reviewer",
        "programme_manager",
        "safety_content_administrator",
        "data_ml_reviewer",
    }
