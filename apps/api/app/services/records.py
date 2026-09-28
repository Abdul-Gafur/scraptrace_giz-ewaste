"""Recovery-record use cases: draft creation and editing, category confirmation, submission,
retrieval, listing and timelines.

Business states change only through `Lifecycle.apply`. Collectors act on their own drafts;
operational roles see non-draft records within their programme, facility and review scope.
Every representation is validated against the contract before it leaves the service.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import sqlalchemy as sa
from apps.api.app.container import AppServices
from apps.api.app.contracts import mappers, refinements
from apps.api.app.contracts.validation import ContractValidationError
from apps.api.app.core.errors import (
    ApiError,
    invalid_transition,
    not_found,
    permission_denied,
    validation_failed,
    version_conflict,
)
from apps.api.app.db.models import (
    Evidence,
    Handoff,
    RecoveryRecord,
    ReviewCase,
)
from apps.api.app.domain.identifiers import new_human_reference, uuid7
from apps.api.app.domain.integrity import sha256_bytes, sha256_canonical_json
from apps.api.app.domain.time import format_timestamp, parse_timestamp
from apps.api.app.repositories.identity import IdentityRepository
from apps.api.app.repositories.records import RecoveryRecordRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.authorization import Actor, RecordScope, context_for, view_permission
from apps.api.app.services.evidence_storage import StoredObject, object_key_for
from apps.api.app.services.idempotency import IdempotencyGuard, IdempotencyScope
from apps.api.app.services.image_validation import SanitizedImage
from apps.api.app.services.lifecycle import Lifecycle
from apps.api.app.services.pagination import (
    DEFAULT_LIMIT,
    decode_cursor,
    encode_cursor,
    keyset,
    page_meta,
)
from apps.api.app.services.review_cases import raise_flags
from sqlalchemy.ext.asyncio import AsyncSession

REVIEW_NOTE_ROLES = frozenset({"programme_reviewer", "programme_manager"})
SORT_COLUMNS = {
    "created_at": RecoveryRecord.created_at,
    "updated_at": RecoveryRecord.updated_at,
    "captured_at": RecoveryRecord.captured_at,
}
DUPLICATE_SOURCE_TYPES = ("original_item_photo", "additional_item_photo")


@dataclass(frozen=True)
class RecordListQuery:
    states: tuple[str, ...] = ()
    categories: tuple[str, ...] = ()
    captured_from: date | None = None
    captured_to: date | None = None
    sort: str = "-created_at"
    cursor: str | None = None
    limit: int = DEFAULT_LIMIT


@dataclass(frozen=True)
class CommandResult:
    status_code: int
    body: dict[str, Any]
    replayed: bool = False
    revision: int | None = None


def audience_for(actor: Actor, record: RecoveryRecord) -> mappers.RecordAudience:
    return mappers.RecordAudience(
        personal_data=record.collector_id == actor.user_id
        or actor.has_permission("personal_data:view"),
        reviewer_notes=actor.role in REVIEW_NOTE_ROLES,
    )


def parse_if_match(value: str | None, *, required: bool) -> int | None:
    """Accepts `"<revision>"`, `W/"<revision>"` or a bare integer."""
    if value is None:
        if required:
            raise ApiError(
                status_code=428,
                code="VALIDATION_FAILED",
                message="Send If-Match with the record revision you last read.",
                field_issues=[{"field": "If-Match", "reason": "required"}],
            )
        return None
    cleaned = value.strip().removeprefix("W/").strip('"')
    if not cleaned.isdigit():
        raise validation_failed("The If-Match header is not a record revision.", "If-Match")
    return int(cleaned)


class RecordService:
    def __init__(self, session: AsyncSession, services: AppServices, context: RequestContext):
        self.session = session
        self.services = services
        self.context = context
        self.records = RecoveryRecordRepository(session)
        self.identity = IdentityRepository(session)
        self.clock = services.clock

    # Representation ----------------------------------------------------------------------

    def represent(self, record: RecoveryRecord, actor: Actor) -> dict[str, Any]:
        data = mappers.recovery_record(record, audience=audience_for(actor, record))
        self.services.contracts.check_response("recovery_record", data)
        issues = refinements.recovery_record(data)
        if issues:
            raise ContractValidationError(
                "Outgoing 'recovery_record' failed a contract refinement: "
                + ", ".join(issue["field"] for issue in issues)
            )
        return data

    # Access --------------------------------------------------------------------------------

    async def authorize_view(self, actor: Actor, record: RecoveryRecord) -> None:
        permission = view_permission(actor)
        authorizer = self.services.authorizer
        await authorizer.require_role_permission(
            actor, permission, self.context, "recovery_record", record.id
        )
        # Drafts are private to their collector.
        if record.business_state == "draft" and record.collector_id != actor.user_id:
            await authorizer.deny_scope(
                actor, permission, self.context, target_type="recovery_record", target_id=record.id
            )
        await authorizer.require(
            actor,
            permission,
            context_for(actor, RecordScope.of(record)),
            self.context,
            target_type="recovery_record",
            target_id=record.id,
        )

    async def load_visible(
        self, record_id: uuid.UUID, actor: Actor, *, for_update: bool = False
    ) -> RecoveryRecord:
        await self.services.authorizer.require_role_permission(
            actor, view_permission(actor), self.context, "recovery_record", record_id
        )
        record = await self.records.get(record_id, for_update=for_update)
        if record is None:
            raise not_found()
        await self.authorize_view(actor, record)
        return record

    async def load_own_draft(
        self, record_id: uuid.UUID, actor: Actor, expected_revision: int | None
    ) -> RecoveryRecord:
        await self.services.authorizer.require_role_permission(
            actor, "recovery_record:correct_own", self.context, "recovery_record", record_id
        )
        record = await self.records.get(record_id, for_update=True)
        if record is None:
            raise not_found()
        await self.services.authorizer.require(
            actor,
            "recovery_record:correct_own",
            context_for(actor, RecordScope.of(record)),
            self.context,
            target_type="recovery_record",
            target_id=record.id,
        )
        if expected_revision is not None and expected_revision != record.revision:
            raise version_conflict()
        if record.business_state != "draft":
            raise invalid_transition(
                "Only a draft can be edited. Submitted records change through lifecycle events.",
                reason="NOT_A_DRAFT",
            )
        return record

    # Queries -------------------------------------------------------------------------------

    async def get(self, record_id: uuid.UUID, actor: Actor) -> tuple[dict[str, Any], int]:
        async with self.session.begin():
            record = await self.load_visible(record_id, actor)
            return self.represent(record, actor), record.revision

    async def events(self, record_id: uuid.UUID, actor: Actor) -> list[dict[str, Any]]:
        async with self.session.begin():
            await self.load_visible(record_id, actor)
            events = [
                mappers.recovery_record_event(event)
                for event in await self.records.list_events(record_id)
            ]
        for event in events:
            self.services.contracts.check_response("recovery_record_event", event)
        return events

    def _visibility(self, statement: sa.Select[Any], actor: Actor) -> sa.Select[Any]:
        if actor.role == "collector":
            return statement.where(RecoveryRecord.collector_id == actor.user_id)
        statement = statement.where(
            RecoveryRecord.programme_id.in_(actor.programme_ids),
            RecoveryRecord.business_state != "draft",
        )
        if actor.role == "recycler":
            location = sa.func.coalesce(
                Handoff.receiving_location_id, RecoveryRecord.destination_location_id
            )
            return statement.outerjoin(Handoff, Handoff.record_id == RecoveryRecord.id).where(
                location.in_(actor.location_ids)
            )
        if actor.role == "programme_reviewer":
            return statement.outerjoin(ReviewCase, ReviewCase.record_id == RecoveryRecord.id).where(
                sa.or_(
                    ReviewCase.assigned_reviewer_id.is_(None),
                    ReviewCase.assigned_reviewer_id == actor.user_id,
                )
            )
        return statement

    async def list(self, actor: Actor, query: RecordListQuery) -> dict[str, Any]:
        await self.services.authorizer.require_role_permission(
            actor, view_permission(actor), self.context, "recovery_record", None
        )
        descending = query.sort.startswith("-")
        column = SORT_COLUMNS[query.sort.lstrip("-")]
        statement = self._visibility(sa.select(RecoveryRecord), actor)
        if query.states:
            statement = statement.where(RecoveryRecord.business_state.in_(query.states))
        if query.categories:
            statement = statement.where(RecoveryRecord.category.in_(query.categories))
        if query.captured_from is not None:
            start = datetime.combine(query.captured_from, time.min, tzinfo=timezone.utc)
            statement = statement.where(RecoveryRecord.captured_at >= start)
        if query.captured_to is not None:
            end = datetime.combine(query.captured_to, time.min, tzinfo=timezone.utc)
            statement = statement.where(RecoveryRecord.captured_at < end + timedelta(days=1))
        statement = keyset(
            statement,
            column,
            RecoveryRecord.id,
            descending,
            decode_cursor(query.cursor, query.sort),
        ).limit(query.limit + 1)
        async with self.session.begin():
            rows = await self.records.execute_listing(statement)
            items = [self.represent(record, actor) for record in rows[: query.limit]]
            next_cursor = None
            if len(rows) > query.limit:
                last = rows[query.limit - 1]
                next_cursor = encode_cursor(query.sort, getattr(last, column.key), last.id)
        return {"items": items, "pagination": page_meta(next_cursor)}

    # Validation shared by creation and editing --------------------------------------------

    def ensure_not_future(self, value: str | None, field: str) -> None:
        if value is None:
            return
        try:
            instant = parse_timestamp(value)
        except ValueError as exc:
            raise validation_failed(
                "A timestamp is not a real instant.", field, "invalid_calendar_instant"
            ) from exc
        if instant > self.clock() + timedelta(seconds=self.services.settings.clock_skew_seconds):
            raise validation_failed("A timestamp is in the future.", field, "in_future")

    def _validate_state(
        self, fields: dict[str, Any], actor: Actor, programme_id: uuid.UUID
    ) -> None:
        """Rules the contract schema cannot express, applied to the complete draft."""
        issues: list[dict[str, str]] = []
        category = fields["category"]
        if category == "mixed_scrap" and fields.get("record_kind") != "batch":
            issues.append({"field": "record_kind", "reason": "mixed_scrap_must_be_batch"})
        if category == "mixed_scrap" and not fields.get("approximate_weight"):
            issues.append({"field": "approximate_weight", "reason": "required_for_mixed_scrap"})

        confirmation = fields["category_confirmation"]
        if confirmation["confirmed_category"] != category:
            issues.append(
                {
                    "field": "category_confirmation.confirmed_category",
                    "reason": "must_match_category",
                }
            )
        confirmed_by = confirmation["confirmed_by"]
        if confirmed_by.get("actor_id") != str(actor.user_id) or confirmed_by.get(
            "programme_id", str(programme_id)
        ) != str(programme_id):
            issues.append(
                {
                    "field": "category_confirmation.confirmed_by",
                    "reason": "must_be_signed_in_collector",
                }
            )

        vision = fields.get("vision_result")
        source = confirmation["source"]
        if vision is not None:
            issues.extend(refinements.vision_result(vision))
        if source == "accepted_prediction" and (
            vision is None or vision["suggested_category"] != category or vision["low_confidence"]
        ):
            # Low-confidence predictions need manual confirmation (FR-VIS-005, FR-VIS-007).
            issues.append(
                {"field": "category_confirmation.source", "reason": "prediction_not_acceptable"}
            )
        if source == "human_correction" and (
            vision is None or vision["suggested_category"] == category
        ):
            issues.append(
                {"field": "category_confirmation.source", "reason": "no_prediction_corrected"}
            )

        price = fields.get("estimated_price")
        if price is not None:
            issues.extend(refinements.price_estimate(price))
            if price["category"] != category:
                issues.append(
                    {"field": "estimated_price.category", "reason": "must_match_category"}
                )
        guide = fields.get("safety_guide")
        if guide is not None and guide["category"] != category:
            issues.append({"field": "safety_guide.category", "reason": "must_match_category"})
        if issues:
            raise ApiError(
                status_code=422,
                code="VALIDATION_FAILED",
                message="The record is not valid.",
                field_issues=issues,
            )
        self.ensure_not_future(fields["captured_at"], "captured_at")
        self.ensure_not_future(confirmation["confirmed_at"], "category_confirmation.confirmed_at")
        if vision is not None:
            self.ensure_not_future(vision["inferred_at"], "vision_result.inferred_at")

    async def _destination(
        self, location_id: str | None, programme_id: uuid.UUID
    ) -> tuple[uuid.UUID | None, dict[str, Any] | None]:
        if location_id is None:
            return None, None
        location = await self.identity.get_location(uuid.UUID(location_id))
        if (
            location is None
            or not location.is_active
            or location.facility.programme_id != programme_id
            or location.verification_status == "suspended"
        ):
            raise validation_failed(
                "The selected destination is not an available participating location.",
                "destination_location_id",
                "unknown_location",
            )
        return location.id, {
            "location_id": str(location.id),
            "facility_type": location.facility_type,
            "verification_status": location.verification_status,
            "selected_at": format_timestamp(self.clock()),
        }

    # Commands ------------------------------------------------------------------------------

    async def create_draft(
        self,
        actor: Actor,
        metadata: dict[str, Any],
        image: SanitizedImage,
        upload_digest: str,
        idempotency_key: str,
    ) -> CommandResult:
        authorizer = self.services.authorizer
        await authorizer.require_role_permission(
            actor, "recovery_record:create", self.context, "recovery_record", None
        )
        programme_id = actor.programme_id
        if programme_id is None:
            raise permission_denied("The account has no single programme assignment.")
        record_kind = metadata.get("record_kind") or (
            "batch" if metadata["category"] == "mixed_scrap" else "item"
        )
        fields = {**metadata, "record_kind": record_kind}
        self._validate_state(fields, actor, programme_id)
        provenance = metadata["original_image"]
        self.ensure_not_future(provenance["captured_at"], "original_image.captured_at")

        record_id = uuid.UUID(metadata["record_id"]) if metadata.get("record_id") else uuid7()
        evidence_id = (
            uuid.UUID(provenance["evidence_id"]) if provenance.get("evidence_id") else uuid7()
        )
        scope = IdempotencyScope(
            actor_id=actor.user_id,
            operation="create_record",
            resource_scope=metadata.get("record_id", ""),
            key=idempotency_key,
            request_digest=sha256_canonical_json({"record": metadata, "image": upload_digest}),
        )
        guard = IdempotencyGuard(
            self.session, self.clock, self.services.settings.idempotency_retention_days
        )
        async with self.session.begin():
            replay = await guard.replay(scope)
        if replay is not None:
            return CommandResult(replay.status_code, replay.body, replayed=True)

        storage = self.services.evidence_storage
        object_key = object_key_for(record_id, evidence_id)
        stored = await storage.put(object_key, image.content, image.mime_type)
        try:
            async with self.session.begin():
                replay = await guard.replay(scope)
                if replay is not None:
                    await storage.delete(object_key)
                    return CommandResult(replay.status_code, replay.body, replayed=True)
                if await self.session.get(RecoveryRecord, record_id) is not None:
                    raise ApiError(
                        status_code=409,
                        code="DUPLICATE_RECORD",
                        message="A record with this identifier already exists.",
                    )
                result = await self._insert_draft(
                    actor, programme_id, record_id, evidence_id, fields, stored, image
                )
                guard.remember(scope, 201, result)
        except BaseException:
            await storage.delete(object_key)
            raise
        return CommandResult(201, result, revision=result["revision"])

    async def _unique_reference(self) -> str:
        for _ in range(8):
            reference = new_human_reference()
            if not await self.records.human_reference_exists(reference):
                return reference
        raise ApiError(
            status_code=503,
            code="DEPENDENCY_UNAVAILABLE",
            message="A record reference could not be allocated. Try again.",
            retryable=True,
        )

    async def _insert_draft(
        self,
        actor: Actor,
        programme_id: uuid.UUID,
        record_id: uuid.UUID,
        evidence_id: uuid.UUID,
        fields: dict[str, Any],
        stored: StoredObject,
        image: SanitizedImage,
    ) -> dict[str, Any]:
        now = self.clock()
        destination_id, destination = await self._destination(
            fields.get("destination_location_id"), programme_id
        )
        weight = fields.get("approximate_weight")
        record = RecoveryRecord(
            id=record_id,
            human_reference=await self._unique_reference(),
            programme_id=programme_id,
            collector_id=actor.user_id,
            record_kind=fields["record_kind"],
            category=fields["category"],
            item_count=fields.get("item_count"),
            approximate_weight_value=weight["value"] if weight else None,
            approximate_weight_unit=weight["unit"] if weight else None,
            condition=fields["condition"],
            captured_at=parse_timestamp(fields["captured_at"]),
            capture_location=fields.get("capture_location"),
            approximate_area=fields["approximate_area"],
            vision_result=fields.get("vision_result"),
            category_confirmation=fields["category_confirmation"],
            estimated_price=fields.get("estimated_price"),
            safety_guide=fields.get("safety_guide"),
            destination=destination,
            destination_location_id=destination_id,
            business_state="draft",
            handoff_state="not_started",
            processing_state="not_started",
            device_instance_id=uuid.UUID(fields["device_instance_id"]),
            created_at=now,
            updated_at=now,
        )
        self.records.add(record)
        await self.session.flush()

        provenance = fields["original_image"]
        vision = fields.get("vision_result")
        confirmation = fields["category_confirmation"]
        self.records.add_evidence(
            Evidence(
                id=evidence_id,
                record_id=record.id,
                evidence_type="original_item_photo",
                storage_provider=stored.provider,
                object_key=stored.object_key,
                object_version=stored.object_version,
                mime_type=image.mime_type,
                file_size_bytes=len(image.content),
                content_digest=sha256_bytes(image.content),
                image_width=image.width,
                image_height=image.height,
                metadata_stripped=True,
                capture_source=provenance["capture_source"],
                captured_by_id=actor.user_id,
                captured_by_programme_id=programme_id,
                device_instance_id=record.device_instance_id,
                captured_at=parse_timestamp(provenance["captured_at"]),
                server_received_at=now,
                coordinates=fields.get("capture_location"),
                application_version=provenance["application_version"],
                connectivity=provenance["connectivity"],
                ai_observation=_ai_observation(vision),
                human_correction=_human_correction(vision, confirmation),
                validation_status="accepted",
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.flush()
        record.original_image_evidence_id = evidence_id
        self.records.add_qr_token(self.services.qr_tokens.new_token(record))
        lifecycle = Lifecycle(self.session, self.clock, self.context)
        lifecycle.record_fact(
            record, "draft_created", actor_role="collector", actor=actor, evidence_id=evidence_id
        )
        if vision is not None:
            lifecycle.record_fact(record, "appraisal_recorded", actor_role="collector", actor=actor)
        self._category_fact(lifecycle, record, actor, confirmation)
        self.services.audit.add(
            self.session,
            self.services.audit.event(
                action="recovery-record.created",
                outcome="succeeded",
                context=self.context,
                actor=actor,
                target_type="recovery_record",
                target_id=record.id,
                programme_id=programme_id,
                details={"category": record.category, "record_kind": record.record_kind},
            ),
        )
        await self.session.flush()
        loaded = await self.records.get(record.id)
        assert loaded is not None
        return self.represent(loaded, actor)

    @staticmethod
    def _category_fact(
        lifecycle: Lifecycle, record: RecoveryRecord, actor: Actor, confirmation: dict[str, Any]
    ) -> None:
        """`category_corrected` when the collector overrode the prediction, otherwise
        `category_confirmed` (an accepted prediction or a manual selection)."""
        event = (
            "category_corrected"
            if confirmation["source"] == "human_correction"
            else "category_confirmed"
        )
        lifecycle.record_fact(
            record,
            event,
            actor_role="collector",
            actor=actor,
            reason=confirmation.get("correction_reason"),
        )

    async def _apply_patch(
        self,
        record: RecoveryRecord,
        actor: Actor,
        patch: dict[str, Any],
        action: str,
        details: dict[str, Any],
    ) -> CommandResult:
        """Applies a validated partial update to a locked draft inside the caller's transaction."""
        if "vision_result" in patch and record.vision_result is not None:
            raise validation_failed(
                "The original prediction is kept as received and cannot be replaced.",
                "vision_result",
                "immutable_original_prediction",
            )
        current = mappers.integrity_payload(record)
        fields: dict[str, Any] = {
            "record_kind": record.record_kind,
            "category": record.category,
            "captured_at": current["captured_at"],
            "category_confirmation": record.category_confirmation,
            "vision_result": record.vision_result,
            "estimated_price": record.estimated_price,
            "safety_guide": record.safety_guide,
            "approximate_weight": current.get("approximate_weight"),
        }
        fields.update(patch)
        if patch.get("category") == "mixed_scrap" and "record_kind" not in patch:
            fields["record_kind"] = "batch"
        self._validate_state(fields, actor, record.programme_id)

        record.record_kind = fields["record_kind"]
        for name in (
            "category",
            "condition",
            "item_count",
            "capture_location",
            "approximate_area",
            "vision_result",
            "category_confirmation",
            "estimated_price",
            "safety_guide",
        ):
            if name in patch:
                setattr(record, name, patch[name])
        if "approximate_weight" in patch:
            weight = patch["approximate_weight"]
            record.approximate_weight_value = weight["value"] if weight else None
            record.approximate_weight_unit = weight["unit"] if weight else None
        if "captured_at" in patch:
            record.captured_at = parse_timestamp(patch["captured_at"])
        if "destination_location_id" in patch:
            record.destination_location_id, record.destination = await self._destination(
                patch["destination_location_id"], record.programme_id
            )
        if "vision_result" in patch and record.original_image_evidence_id is not None:
            # Associating a prediction with a draft records it on the photograph's provenance
            # once; an existing observation is never replaced.
            original = await self.records.get_evidence(record.original_image_evidence_id)
            if original is not None and original.ai_observation is None:
                original.ai_observation = _ai_observation(patch["vision_result"])
        lifecycle = Lifecycle(self.session, self.clock, self.context)
        if "vision_result" in patch:
            lifecycle.record_fact(record, "appraisal_recorded", actor_role="collector", actor=actor)
        if "category_confirmation" in patch:
            self._category_fact(lifecycle, record, actor, patch["category_confirmation"])
        record.updated_at = self.clock()
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
                details=details,
            ),
        )
        await self.session.flush()
        loaded = await self.records.get(record.id)
        assert loaded is not None
        return CommandResult(200, self.represent(loaded, actor), revision=loaded.revision)

    async def update_draft(
        self, record_id: uuid.UUID, actor: Actor, patch: dict[str, Any], expected_revision: int
    ) -> CommandResult:
        async with self.session.begin():
            record = await self.load_own_draft(record_id, actor, expected_revision)
            return await self._apply_patch(
                record, actor, patch, "recovery-record.draft-updated", {"fields": sorted(patch)}
            )

    async def confirm_category(
        self,
        record_id: uuid.UUID,
        actor: Actor,
        confirmation: dict[str, Any],
        expected_revision: int,
    ) -> CommandResult:
        """Records the collector's confirmed or corrected category (FR-VIS-005, FR-VIS-006).
        The original prediction is preserved unchanged. The new confirmation (who, when,
        source, reason) replaces the previous one, whose values stay in the audit trail."""
        patch: dict[str, Any] = {
            "category": confirmation["confirmed_category"],
            "category_confirmation": confirmation,
        }
        async with self.session.begin():
            record = await self.load_own_draft(record_id, actor, expected_revision)
            details = {
                "previous_category": record.category,
                "previous_source": str(record.category_confirmation.get("source")),
                "confirmed_category": confirmation["confirmed_category"],
                "source": confirmation["source"],
            }
            return await self._apply_patch(
                record, actor, patch, "recovery-record.category-confirmed", details
            )

    async def submit(
        self, record_id: uuid.UUID, actor: Actor, expected_revision: int | None
    ) -> CommandResult:
        authorizer = self.services.authorizer
        await authorizer.require_role_permission(
            actor, "recovery_record:create", self.context, "recovery_record", record_id
        )
        async with self.session.begin():
            record = await self.records.get(record_id, for_update=True)
            if record is None:
                raise not_found()
            await authorizer.require(
                actor,
                "recovery_record:view_own",
                context_for(actor, RecordScope.of(record)),
                self.context,
                target_type="recovery_record",
                target_id=record.id,
            )
            if record.business_state in ("submitted", "awaiting_handoff"):
                # Submitting the same draft again is one logical mutation (BR-007).
                return CommandResult(
                    200,
                    {
                        "outcome": "submitted",
                        "record": self.represent(record, actor),
                        "replayed": True,
                        "flag_codes": list(record.review_case.flag_codes)
                        if record.review_case
                        else [],
                    },
                    replayed=True,
                    revision=record.revision,
                )
            if expected_revision is not None and expected_revision != record.revision:
                raise version_conflict()
            if record.business_state != "draft":
                raise invalid_transition(
                    "This record has already moved beyond submission.", reason="NOT_A_DRAFT"
                )

            lifecycle = Lifecycle(self.session, self.clock, self.context)
            await lifecycle.apply(record, "submit_record", actor_role="collector", actor=actor)
            await lifecycle.apply(record, "publish_for_handoff", actor_role="system")
            record.handoff_state = "awaiting"
            record.submitted_at = self.clock()
            # The record is now eligible for handoff, so its lookup token becomes resolvable.
            token = self.services.qr_tokens.current(record)
            self.services.qr_tokens.activate(token)
            self.services.qr_tokens.ensure_transfer_code(token)
            lifecycle.record_fact(record, "qr_issued", actor_role="system")
            self.services.audit.add(
                self.session,
                self.services.audit.event(
                    action="qr-token.issued",
                    outcome="succeeded",
                    context=self.context,
                    actor_role="system",
                    target_type="recovery_record",
                    target_id=record.id,
                    programme_id=record.programme_id,
                    details={"token_id": str(token.id)},
                ),
            )

            flags: list[str] = []
            original = (
                await self.records.get_evidence(record.original_image_evidence_id)
                if record.original_image_evidence_id is not None
                else None
            )
            if original is not None and await self.records.digest_used_elsewhere(
                [original.content_digest], record.id, DUPLICATE_SOURCE_TYPES
            ):
                # Exact image reuse is a review signal, not an automatic decision (FR-REC-007).
                flags.append("DUPLICATE_EVIDENCE_DIGEST")
                await raise_flags(
                    self.session,
                    record,
                    flags,
                    opened_by_role="system",
                    actor=None,
                    facility_id=None,
                    clock=self.clock,
                    audit=self.services.audit,
                    context=self.context,
                )
            self.services.audit.add(
                self.session,
                self.services.audit.event(
                    action="recovery-record.submitted",
                    outcome="succeeded",
                    context=self.context,
                    actor=actor,
                    target_type="recovery_record",
                    target_id=record.id,
                    programme_id=record.programme_id,
                    details={"flag_codes": flags},
                ),
            )
            await self.session.flush()
            loaded = await self.records.get(record.id)
            assert loaded is not None
            return CommandResult(
                200,
                {
                    "outcome": "duplicate_image" if flags else "submitted",
                    "record": self.represent(loaded, actor),
                    "replayed": False,
                    "flag_codes": flags,
                },
                revision=loaded.revision,
            )

    async def _load_owned(
        self, record_id: uuid.UUID, actor: Actor, *, for_update: bool = False
    ) -> RecoveryRecord:
        """The caller's own record; other records are concealed as not found."""
        await self.services.authorizer.require_role_permission(
            actor, "recovery_record:correct_own", self.context, "recovery_record", record_id
        )
        record = await self.records.get(record_id, for_update=for_update)
        if record is None:
            raise not_found()
        await self.services.authorizer.require(
            actor,
            "recovery_record:correct_own",
            context_for(actor, RecordScope.of(record)),
            self.context,
            target_type="recovery_record",
            target_id=record.id,
        )
        return record

    def _credentials(self, record: RecoveryRecord) -> dict[str, Any]:
        data = self.services.qr_tokens.credentials(record)
        self.services.contracts.check_response("qr_credentials", data)
        return data

    async def qr_credentials(self, record_id: uuid.UUID, actor: Actor) -> dict[str, Any]:
        """The owning collector's QR payload and manual transfer code (ADR-009)."""
        async with self.session.begin():
            record = await self._load_owned(record_id, actor)
            data = self._credentials(record)
            self.services.audit.add(
                self.session,
                self.services.audit.event(
                    action="qr-credentials.viewed",
                    outcome="succeeded",
                    context=self.context,
                    actor=actor,
                    target_type="recovery_record",
                    target_id=record.id,
                    programme_id=record.programme_id,
                    details={"status": str(data["status"])},
                ),
            )
            await self.session.flush()
        return data

    async def rotate_qr_token(self, record_id: uuid.UUID, actor: Actor) -> dict[str, Any]:
        """Revokes the record's current QR token and manual code together and issues new ones
        (lost or shared QR, or expired credentials). Only the owning collector may rotate, and
        only before handoff."""
        async with self.session.begin():
            record = await self._load_owned(record_id, actor, for_update=True)
            if record.business_state != "awaiting_handoff":
                raise invalid_transition(
                    "A QR code can be reissued only while the record awaits handoff.",
                    reason="NOT_AWAITING_HANDOFF",
                )
            replacement = self.services.qr_tokens.rotate(record)
            await self.session.flush()  # the revocation must precede the new active token
            record.qr_tokens.append(replacement)
            self.services.audit.add(
                self.session,
                self.services.audit.event(
                    action="qr-token.rotated",
                    outcome="succeeded",
                    context=self.context,
                    actor=actor,
                    target_type="recovery_record",
                    target_id=record.id,
                    programme_id=record.programme_id,
                    details={"token_id": str(replacement.id)},
                ),
            )
            Lifecycle(self.session, self.clock, self.context).record_fact(
                record, "qr_rotated", actor_role="collector", actor=actor
            )
            await self.session.flush()
            return self._credentials(record)


def _ai_observation(vision: dict[str, Any] | None) -> dict[str, Any] | None:
    if vision is None:
        return None
    return {
        "model_name": vision["model_name"],
        "model_version": vision["model_version"],
        "original_prediction": vision["suggested_category"],
        "confidence": vision["confidence"],
    }


def _human_correction(
    vision: dict[str, Any] | None, confirmation: dict[str, Any]
) -> dict[str, Any] | None:
    if vision is None or confirmation["source"] != "human_correction":
        return None
    correction = {
        "original_value": vision["suggested_category"],
        "corrected_value": confirmation["confirmed_category"],
        "corrected_by": confirmation["confirmed_by"],
        "corrected_at": confirmation["confirmed_at"],
    }
    if confirmation.get("correction_reason"):
        correction["reason"] = confirmation["correction_reason"]
    return correction
