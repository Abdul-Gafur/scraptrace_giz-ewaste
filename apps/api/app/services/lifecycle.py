"""The only code path that changes a recovery record's business state.

`apply` evaluates the contract state machine with persisted evidence and flags, appends the
lifecycle event and refreshes the integrity digest, all inside the caller's transaction.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from apps.api.app.contracts.mappers import integrity_payload
from apps.api.app.core.errors import ApiError
from apps.api.app.db.models import RecoveryRecord, RecoveryRecordEvent
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.integrity import recovery_record_digest
from apps.api.app.domain.time import Clock
from apps.api.app.domain.transitions import TransitionInput, transition
from apps.api.app.domain.vocabulary import EVENT_SCHEMA_VERSION, RECORD_FACT_EVENT_TYPES
from apps.api.app.repositories.records import RecoveryRecordRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.authorization import Actor
from sqlalchemy.ext.asyncio import AsyncSession

UNRESOLVED_REVIEW_STATES = frozenset({"open", "awaiting_information"})


def has_unresolved_flags(record: RecoveryRecord) -> bool:
    case = record.review_case
    return case is not None and bool(case.flag_codes) and case.status in UNRESOLVED_REVIEW_STATES


class Lifecycle:
    def __init__(self, session: AsyncSession, clock: Clock, context: RequestContext) -> None:
        self._session = session
        self._records = RecoveryRecordRepository(session)
        self._clock = clock
        self._context = context

    async def apply(
        self,
        record: RecoveryRecord,
        event_type: str,
        *,
        actor_role: str,
        actor: Actor | None = None,
        reason: str | None = None,
        is_offline: bool = False,
    ) -> RecoveryRecordEvent:
        # Evidence added earlier in the same transaction must count toward the rule.
        await self._session.flush()
        result = transition(
            TransitionInput(
                current_state=record.business_state,
                event=event_type,
                actor_role=actor_role,
                available_evidence=await self._records.evidence_types(record.id),
                is_offline=is_offline,
                has_unresolved_flags=has_unresolved_flags(record),
            )
        )
        if not result.ok or result.next_state is None or result.previous_state is None:
            details: dict[str, str | int | float | bool | None] = {"reason": result.code}
            if result.missing_evidence:
                details["missing_evidence"] = ",".join(result.missing_evidence)
            raise ApiError(
                status_code=409,
                code="INVALID_STATE_TRANSITION",
                message=result.message or "The transition is not allowed.",
                safe_details=details,
            )

        occurred_at = self._clock()
        record.business_state = result.next_state
        record.updated_at = occurred_at
        # The integrity payload is immutable after submission, so the digest is stable; the
        # previous value is kept alongside it as ADR-004 requires.
        if record.integrity_digest is not None:
            record.previous_integrity_digest = record.integrity_digest
        record.integrity_digest = recovery_record_digest(integrity_payload(record))

        event = RecoveryRecordEvent(
            id=uuid7(),
            record_id=record.id,
            event_schema_version=EVENT_SCHEMA_VERSION,
            event_type=event_type,
            actor_id=actor.user_id if actor is not None else None,
            actor_programme_id=actor.programme_id if actor is not None else None,
            actor_facility_id=actor.facility_id if actor is not None else None,
            actor_role=actor_role,
            occurred_at=occurred_at,
            previous_state=result.previous_state,
            resulting_state=result.next_state,
            reason=reason[:1000] if reason else None,
            correlation_id=self._context.correlation_id,
        )
        self._records.add_event(event)
        return event

    def record_fact(
        self,
        record: RecoveryRecord,
        event_type: str,
        *,
        actor_role: str,
        actor: Actor | None = None,
        reason: str | None = None,
        evidence_id: uuid.UUID | None = None,
        flag_codes: list[str] | None = None,
    ) -> RecoveryRecordEvent:
        event = fact_event(
            record,
            event_type,
            occurred_at=self._clock(),
            context=self._context,
            actor_role=actor_role,
            actor=actor,
            reason=reason,
            evidence_id=evidence_id,
            flag_codes=flag_codes,
        )
        self._records.add_event(event)
        return event


def fact_event(
    record: RecoveryRecord,
    event_type: str,
    *,
    occurred_at: datetime,
    context: RequestContext,
    actor_role: str,
    actor: Actor | None = None,
    reason: str | None = None,
    evidence_id: uuid.UUID | None = None,
    flag_codes: list[str] | None = None,
) -> RecoveryRecordEvent:
    """A persisted record fact (`RECORD_FACT_EVENT_TYPES`): it describes a change inside the
    caller's transaction without moving the business state, so the previous and resulting
    states are both the current state. The caller adds it to the session."""
    if event_type not in RECORD_FACT_EVENT_TYPES:
        raise ValueError(f"'{event_type}' is not a record fact event.")
    return RecoveryRecordEvent(
        id=uuid7(),
        record_id=record.id,
        event_schema_version=EVENT_SCHEMA_VERSION,
        event_type=event_type,
        actor_id=actor.user_id if actor is not None else None,
        actor_programme_id=actor.programme_id if actor is not None else None,
        actor_facility_id=actor.facility_id if actor is not None else None,
        actor_role=actor_role,
        occurred_at=occurred_at,
        previous_state=record.business_state,
        resulting_state=record.business_state,
        reason=reason[:1000] if reason else None,
        evidence_id=evidence_id,
        flag_codes=list(flag_codes) if flag_codes else None,
        correlation_id=context.correlation_id,
    )
