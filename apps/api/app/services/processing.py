"""Processing (FR-REV-001, FR-REV-002, FR-REV-007).

A recycler at the receiving facility prepares processing information as an editable draft
(method, notes, time, completion evidence, recovered material entries), then submits the
contract `ProcessingRequest`. Submission always applies `record_processing`. What follows
depends on flags: a record with an unresolved flag (new processing flags or earlier handoff
flags) moves to `under_review` through `flag_for_review`; an unflagged record is completed
by the recycler and approved by the system through `approve_unflagged_completion`, which makes
it eligible for verified totals (BR-010).
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import sqlalchemy as sa
from apps.api.app.container import AppServices
from apps.api.app.contracts import mappers
from apps.api.app.contracts.transport import PROCESSING_DETAIL_SCHEMA, check_transport_response
from apps.api.app.core.errors import (
    ApiError,
    invalid_transition,
    not_found,
    permission_denied,
    validation_failed,
    version_conflict,
)
from apps.api.app.db.models import (
    Handoff,
    ProcessingRecord,
    RecoveredMaterialEntry,
    RecoveryRecord,
)
from apps.api.app.domain.flags import Weight, evaluate_processing_flags, to_kilograms
from apps.api.app.domain.time import format_timestamp, parse_timestamp
from apps.api.app.repositories.records import RecoveryRecordRepository
from apps.api.app.repositories.workflow import WorkflowRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.authorization import Actor, RecordScope, context_for
from apps.api.app.services.idempotency import IdempotencyGuard, IdempotencyScope
from apps.api.app.services.lifecycle import Lifecycle, has_unresolved_flags
from apps.api.app.services.pagination import decode_cursor, encode_cursor, keyset, page_meta
from apps.api.app.services.records import RecordService
from apps.api.app.services.review_cases import merge_flags, raise_flags
from sqlalchemy.ext.asyncio import AsyncSession

PROCESSING_OPERATION = "record_processing"
RESULT_LIMIT = 500
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")


@dataclass(frozen=True)
class ProcessingOutcome:
    status_code: int
    body: dict[str, Any]


def clean_material(value: str) -> str:
    """Material names are free text in the contract; they are trimmed, whitespace-normalised
    and refused if they contain control characters."""
    cleaned = " ".join(value.split())
    if not cleaned or _CONTROL_CHARACTERS.search(value):
        raise validation_failed(
            "Each material needs a readable name.", "material_entries.material", "invalid_material"
        )
    return cleaned


def processing_detail(processing: ProcessingRecord) -> dict[str, Any]:
    entries = [
        {
            "entry_id": str(entry.id),
            "material": entry.material,
            "weight": mappers.weight(entry.weight_value, entry.weight_unit),
        }
        for entry in processing.material_entries
    ]
    detail: dict[str, Any] = {
        "record_id": str(processing.record_id),
        "status": processing.status,
        "completion_evidence_ids": list(processing.evidence_ids),
        "material_entries": entries,
        "total_recovered_weight_kg": round(
            sum(
                to_kilograms(Weight(e.weight_value, e.weight_unit))
                for e in processing.material_entries
            ),
            4,
        ),
        "version": processing.version,
        "updated_at": format_timestamp(processing.updated_at),
    }
    if processing.processing_method is not None:
        detail["processing_method"] = processing.processing_method
    if processing.notes is not None:
        detail["notes"] = processing.notes
    if processing.processed_at is not None:
        detail["processing_timestamp"] = format_timestamp(processing.processed_at)
    if processing.submitted_at is not None:
        detail["submitted_at"] = format_timestamp(processing.submitted_at)
    check_transport_response(PROCESSING_DETAIL_SCHEMA, detail)
    return detail


class ProcessingService:
    def __init__(self, session: AsyncSession, services: AppServices, context: RequestContext):
        self.session = session
        self.services = services
        self.context = context
        self.records = RecoveryRecordRepository(session)
        self.workflow = WorkflowRepository(session)
        self.record_service = RecordService(session, services, context)
        self.clock = services.clock

    # Access ----------------------------------------------------------------------------------

    async def _load_for_processing(self, record_id: uuid.UUID, actor: Actor) -> RecoveryRecord:
        await self.services.authorizer.require_role_permission(
            actor, "processing:record", self.context, "recovery_record", record_id
        )
        record = await self.records.get(record_id, for_update=True)
        if record is None:
            raise not_found()
        # Only the facility that received the item may process it (strict facility scope).
        await self.services.authorizer.require(
            actor,
            "processing:record",
            context_for(actor, RecordScope.of(record)),
            self.context,
            target_type="recovery_record",
            target_id=record.id,
        )
        return record

    async def _editable_draft(
        self, record: RecoveryRecord, actor: Actor, *, create: bool, expected_version: int | None
    ) -> ProcessingRecord:
        processing = record.processing
        if processing is not None and processing.status == "submitted":
            raise invalid_transition(
                "Processing was already submitted and can no longer be edited.",
                reason="PROCESSING_SUBMITTED",
            )
        if record.business_state != "received":
            raise invalid_transition(
                "Processing can be prepared only after the handoff is received.",
                reason="NOT_RECEIVED",
            )
        if processing is None:
            if not create:
                raise not_found("No processing information exists for this record.")
            assert record.handoff is not None
            processing = ProcessingRecord(
                record_id=record.id,
                facility_id=record.handoff.recycler_facility_id,
                recycler_id=actor.user_id,
                recycler_programme_id=actor.programme_id,
                status="draft",
                evidence_ids=[],
                # A new draft has no entries; initialising the collection avoids a lazy load.
                material_entries=[],
            )
            self.workflow.add(processing)
            record.processing = processing
            record.processing_state = "in_progress"
            record.updated_at = self.clock()
            await self.session.flush()
        elif expected_version is not None and expected_version != processing.version:
            raise version_conflict()
        return processing

    async def _validated_evidence(
        self, actor: Actor, record: RecoveryRecord, evidence_ids: list[str], field: str
    ) -> list[str]:
        if len(set(evidence_ids)) != len(evidence_ids):
            raise validation_failed("Evidence identifiers repeat.", field, "duplicate_items")
        for value in evidence_ids:
            item = await self.records.get_evidence(uuid.UUID(value))
            if (
                item is None
                or item.record_id != record.id
                or item.evidence_type != "processing_completion"
                or item.validation_status != "accepted"
                or item.captured_by_facility_id not in actor.facility_ids
            ):
                raise validation_failed(
                    "Completion evidence must be processing photographs uploaded for this record "
                    "by the receiving facility.",
                    field,
                    "invalid_reference",
                )
        return evidence_ids

    def _processing_time(self, record: RecoveryRecord, value: str, field: str) -> Any:
        instant = parse_timestamp(value)
        skew = timedelta(seconds=self.services.settings.clock_skew_seconds)
        received = record.handoff.server_received_at if record.handoff is not None else None
        if instant > self.clock() + skew or (received is not None and instant < received - skew):
            raise validation_failed(
                "Processing time must fall between receipt and now.", field, "out_of_range"
            )
        return instant

    def _audit(
        self, actor: Actor, record: RecoveryRecord, action: str, details: dict[str, Any]
    ) -> None:
        self.services.audit.add(
            self.session,
            self.services.audit.event(
                action=action,
                outcome="succeeded",
                context=self.context,
                actor=actor,
                target_type="recovery_record",
                target_id=record.id,
                programme_id=record.programme_id,
                facility_id=actor.facility_id,
                details=details,
            ),
        )

    async def _detail(self, record_id: uuid.UUID) -> dict[str, Any]:
        await self.session.flush()
        processing = await self.workflow.get_processing_for_record(record_id)
        assert processing is not None
        return processing_detail(processing)

    # Queries --------------------------------------------------------------------------------

    async def get(self, record_id: uuid.UUID, actor: Actor) -> dict[str, Any]:
        async with self.session.begin():
            record = await self.record_service.load_visible(record_id, actor)
            processing = await self.workflow.get_processing_for_record(record.id)
            if processing is None:
                raise not_found("No processing information exists for this record.")
            return processing_detail(processing)

    async def queue(
        self, actor: Actor, cursor: str | None, limit: int, sort: str
    ) -> dict[str, Any]:
        """Received records at the actor's facility locations, oldest receipt first by default."""
        await self.services.authorizer.require_role_permission(
            actor, "processing:record", self.context, "recovery_record", None
        )
        descending = sort.startswith("-")
        statement = (
            sa.select(RecoveryRecord)
            .join(Handoff, Handoff.record_id == RecoveryRecord.id)
            .where(
                RecoveryRecord.business_state == "received",
                RecoveryRecord.programme_id.in_(actor.programme_ids),
                Handoff.receiving_location_id.in_(actor.location_ids),
            )
        )
        statement = keyset(
            statement,
            Handoff.server_received_at,
            RecoveryRecord.id,
            descending,
            decode_cursor(cursor, sort),
        ).limit(limit + 1)
        async with self.session.begin():
            rows = await self.records.execute_listing(statement)
            items = [self.record_service.represent(record, actor) for record in rows[:limit]]
            next_cursor = None
            if len(rows) > limit and rows[limit - 1].handoff is not None:
                last = rows[limit - 1]
                assert last.handoff is not None
                next_cursor = encode_cursor(sort, last.handoff.server_received_at, last.id)
        return {"items": items, "pagination": page_meta(next_cursor)}

    # Draft commands --------------------------------------------------------------------------

    async def save_draft(
        self,
        record_id: uuid.UUID,
        actor: Actor,
        changes: dict[str, Any],
        expected_version: int | None,
    ) -> dict[str, Any]:
        async with self.session.begin():
            record = await self._load_for_processing(record_id, actor)
            existing = record.processing is not None
            if existing and expected_version is None:
                raise ApiError(
                    status_code=428,
                    code="VALIDATION_FAILED",
                    message="Send If-Match with the processing version you last read.",
                    field_issues=[{"field": "If-Match", "reason": "required"}],
                )
            processing = await self._editable_draft(
                record, actor, create=True, expected_version=expected_version
            )
            if "processing_method" in changes:
                processing.processing_method = changes["processing_method"]
            if "notes" in changes:
                notes = changes["notes"]
                processing.notes = (
                    notes.strip() if isinstance(notes, str) and notes.strip() else None
                )
            if "processing_timestamp" in changes:
                value = changes["processing_timestamp"]
                processing.processed_at = (
                    self._processing_time(record, value, "processing_timestamp") if value else None
                )
            if "completion_evidence_ids" in changes:
                processing.evidence_ids = await self._validated_evidence(
                    actor, record, changes["completion_evidence_ids"], "completion_evidence_ids"
                )
            processing.updated_at = self.clock()
            self._audit(actor, record, "processing.draft-saved", {"fields": sorted(changes)})
            return await self._detail(record.id)

    async def add_entry(
        self,
        record_id: uuid.UUID,
        actor: Actor,
        entry: dict[str, Any],
        expected_version: int | None,
    ) -> dict[str, Any]:
        async with self.session.begin():
            record = await self._load_for_processing(record_id, actor)
            processing = await self._editable_draft(
                record, actor, create=True, expected_version=expected_version
            )
            if len(processing.material_entries) >= 100:
                raise validation_failed(
                    "A processing record holds at most 100 material entries.",
                    "material_entries",
                    "too_many_items",
                )
            position = max((e.position for e in processing.material_entries), default=-1) + 1
            self.workflow.add(
                RecoveredMaterialEntry(
                    processing_record_id=processing.id,
                    material=clean_material(entry["material"]),
                    weight_value=entry["weight"]["value"],
                    weight_unit=entry["weight"]["unit"],
                    position=position,
                )
            )
            # Touching the parent advances its version, so concurrent editors notice.
            processing.updated_at = self.clock()
            self._audit(actor, record, "processing.material-entry-added", {"position": position})
            return await self._detail(record.id)

    async def _entry(
        self, record: RecoveryRecord, processing: ProcessingRecord, entry_id: uuid.UUID
    ) -> RecoveredMaterialEntry:
        entry = await self.workflow.get_material_entry(entry_id)
        if entry is None or entry.processing_record_id != processing.id:
            raise not_found("The material entry does not exist on this record.")
        return entry

    async def update_entry(
        self,
        record_id: uuid.UUID,
        entry_id: uuid.UUID,
        actor: Actor,
        changes: dict[str, Any],
        expected_version: int | None,
    ) -> dict[str, Any]:
        async with self.session.begin():
            record = await self._load_for_processing(record_id, actor)
            processing = await self._editable_draft(
                record, actor, create=False, expected_version=expected_version
            )
            entry = await self._entry(record, processing, entry_id)
            if "material" in changes:
                entry.material = clean_material(changes["material"])
            if "weight" in changes:
                entry.weight_value = changes["weight"]["value"]
                entry.weight_unit = changes["weight"]["unit"]
            entry.updated_at = processing.updated_at = self.clock()
            self._audit(
                actor, record, "processing.material-entry-updated", {"entry_id": str(entry.id)}
            )
            return await self._detail(record.id)

    async def remove_entry(
        self, record_id: uuid.UUID, entry_id: uuid.UUID, actor: Actor, expected_version: int | None
    ) -> dict[str, Any]:
        async with self.session.begin():
            record = await self._load_for_processing(record_id, actor)
            processing = await self._editable_draft(
                record, actor, create=False, expected_version=expected_version
            )
            entry = await self._entry(record, processing, entry_id)
            await self.workflow.delete(entry)
            processing.updated_at = self.clock()
            self._audit(
                actor, record, "processing.material-entry-removed", {"entry_id": str(entry_id)}
            )
            return await self._detail(record.id)

    # Submission ------------------------------------------------------------------------------

    def _validate_identity(self, actor: Actor, request: dict[str, Any]) -> None:
        scope = request["idempotency"]["scope"]
        issues = []
        if scope["actor_id"] != str(actor.user_id):
            issues.append(
                {"field": "idempotency.scope.actor_id", "reason": "must_be_signed_in_user"}
            )
        if scope["operation"] != PROCESSING_OPERATION:
            issues.append(
                {"field": "idempotency.scope.operation", "reason": "must_be_record_processing"}
            )
        if scope.get("resource_id") != request["recovery_record_id"]:
            issues.append({"field": "idempotency.scope.resource_id", "reason": "must_match_record"})
        if issues:
            raise ApiError(
                status_code=422,
                code="VALIDATION_FAILED",
                message="The idempotency scope does not match this request.",
                field_issues=issues,
            )
        recycler = request["recycler_reference"]
        facility = recycler.get("facility_id")
        if recycler["actor_id"] != str(actor.user_id) or (
            facility is not None and uuid.UUID(facility) not in actor.facility_ids
        ):
            raise permission_denied("Processing can only be recorded by the signed-in recycler.")
        if not (request.get("notes") or "").strip():
            # The contract stores the result as required text (ProcessingInformation.result).
            raise validation_failed("A processing result is required.", "notes", "required")

    def _rejected(self, message: str) -> ProcessingOutcome:
        return ProcessingOutcome(
            200,
            {
                "outcome": "rejected",
                "error_code": "INVALID_STATE_TRANSITION",
                "message": message,
                "replayed": False,
            },
        )

    async def submit(self, actor: Actor, request: dict[str, Any]) -> ProcessingOutcome:
        for permission in ("processing:record", "processing:complete"):
            await self.services.authorizer.require_role_permission(
                actor, permission, self.context, "recovery_record", request["recovery_record_id"]
            )
        self._validate_identity(actor, request)
        record_id = uuid.UUID(request["recovery_record_id"])
        idempotency = request["idempotency"]
        scope = IdempotencyScope(
            actor_id=actor.user_id,
            operation=PROCESSING_OPERATION,
            resource_scope=str(record_id),
            key=idempotency["idempotency_key"],
            request_digest=idempotency["request_digest"],
        )
        guard = IdempotencyGuard(
            self.session, self.clock, self.services.settings.idempotency_retention_days
        )
        async with self.session.begin():
            replay = await guard.replay(scope)
            if replay is not None:
                return ProcessingOutcome(200, {**replay.body, "replayed": True})
            record = await self._load_for_processing(record_id, actor)
            if record.business_state in ("approved_and_completed", "rejected"):
                outcome = self._rejected(
                    "A decided record cannot be edited. Record an amendment instead."
                )
            elif record.business_state != "received":
                outcome = self._rejected(
                    "Processing can only be recorded once, after the handoff has been received."
                )
            else:
                outcome = await self._record(actor, record, request)
            self.services.contracts.check_response("processing_response", outcome.body)
            guard.remember(scope, outcome.status_code, outcome.body)
            return outcome

    async def _record(
        self, actor: Actor, record: RecoveryRecord, request: dict[str, Any]
    ) -> ProcessingOutcome:
        processed_at = self._processing_time(
            record, request["processing_timestamp"], "processing_timestamp"
        )
        evidence_ids = await self._validated_evidence(
            actor, record, request["completion_evidence_ids"], "completion_evidence_ids"
        )
        entries = [
            (clean_material(entry["material"]), entry["weight"])
            for entry in request["material_entries"]
        ]
        notes = request["notes"].strip()
        now = self.clock()

        processing = record.processing
        if processing is None:
            assert record.handoff is not None
            processing = ProcessingRecord(
                record_id=record.id,
                facility_id=record.handoff.recycler_facility_id,
                recycler_id=actor.user_id,
                recycler_programme_id=actor.programme_id,
                status="draft",
                evidence_ids=[],
                # A new draft has no entries; initialising the collection avoids a lazy load.
                material_entries=[],
            )
            self.workflow.add(processing)
            record.processing = processing
            await self.session.flush()
        # The submitted request is authoritative: draft entries are replaced by its entries.
        for existing in list(processing.material_entries):
            await self.workflow.delete(existing)
        await self.session.flush()
        for position, (material, weight) in enumerate(entries):
            self.workflow.add(
                RecoveredMaterialEntry(
                    processing_record_id=processing.id,
                    material=material,
                    weight_value=weight["value"],
                    weight_unit=weight["unit"],
                    position=position,
                )
            )
        processing.recycler_id = actor.user_id
        processing.recycler_programme_id = actor.programme_id
        processing.status = "submitted"
        processing.processing_method = request["processing_method"]
        processing.notes = notes
        # ProcessingInformation.result allows 500 characters; the full notes are kept separately.
        processing.result = notes[:RESULT_LIMIT]
        processing.processed_at = processed_at
        processing.evidence_ids = evidence_ids
        processing.submitted_at = now
        processing.updated_at = now
        await self.session.flush()
        record = await self.records.get(record.id, for_update=True) or record

        assert record.handoff is not None
        new_flags = evaluate_processing_flags(
            received_weight=Weight(
                record.handoff.measured_weight_value, record.handoff.measured_weight_unit
            ),
            material_weights=[Weight(w["value"], w["unit"]) for _, w in entries],
            requires_material_weights=request["processing_method"] == "material_recovery",
        )
        lifecycle = Lifecycle(self.session, self.clock, self.context)
        await lifecycle.apply(record, "record_processing", actor_role="recycler", actor=actor)
        record.processing_state = "evidence_recorded"

        case = record.review_case
        existing_flags = (
            list(case.flag_codes) if case is not None and has_unresolved_flags(record) else []
        )
        all_flags = merge_flags(existing_flags, new_flags)
        if all_flags:
            await raise_flags(
                self.session,
                record,
                new_flags,
                opened_by_role="system",
                actor=None,
                facility_id=processing.facility_id,
                clock=self.clock,
                audit=self.services.audit,
                context=self.context,
            )
            await lifecycle.apply(
                record,
                "flag_for_review",
                actor_role="system",
                reason="Flags requiring review: " + ", ".join(all_flags),
            )
            body: dict[str, Any] = {
                "outcome": "review_required",
                "recovery_record_id": str(record.id),
                "flag_codes": all_flags,
                "replayed": False,
            }
        else:
            await lifecycle.apply(
                record, "mark_processing_complete", actor_role="recycler", actor=actor
            )
            record.processing_state = "completed"
            await lifecycle.apply(record, "approve_unflagged_completion", actor_role="system")
            await self.session.flush()
            body = {
                "outcome": "processing_recorded",
                "recovery_record_id": str(record.id),
                "server_revision": record.revision,
                "replayed": False,
            }
        self._audit(
            actor,
            record,
            "processing.submitted",
            {"outcome": body["outcome"], "flag_codes": all_flags},
        )
        await self.session.flush()
        if body["outcome"] == "processing_recorded":
            body["server_revision"] = record.revision
        return ProcessingOutcome(201, body)
