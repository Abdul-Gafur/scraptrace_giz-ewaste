"""Programme review (FR-REV-003 to FR-REV-009).

Reviewers see review cases within their programme that are unassigned or assigned to them.
A decision is exactly one of the contract's three outcomes. Each is applied through its own
contract transition (`approve_review` and `reject_review` are terminal; `request_correction`
keeps the record under review and returns work to the responsible actor). The decision, the
generated `reviewer_decision` evidence, the case update, the lifecycle event, the idempotency
outcome and the audit event commit together. A record that already holds a terminal decision
cannot be decided again.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import sqlalchemy as sa
from apps.api.app.container import AppServices
from apps.api.app.contracts import mappers
from apps.api.app.contracts.transport import check_response
from apps.api.app.core.errors import (
    ApiError,
    invalid_transition,
    not_found,
    permission_denied,
    validation_failed,
    version_conflict,
)
from apps.api.app.db.models import Evidence, RecoveryRecord, ReviewCase, ReviewDecision
from apps.api.app.domain.time import format_timestamp, parse_timestamp
from apps.api.app.domain.vocabulary import (
    MANUAL_REVIEW_REASON,
    REASON_CODES_BY_DECISION,
    REVIEW_FLAG_CODES,
    TERMINAL_RECOVERY_RECORD_STATES,
)
from apps.api.app.repositories.records import RecoveryRecordRepository
from apps.api.app.repositories.workflow import WorkflowRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.authorization import Actor, RecordScope, context_for
from apps.api.app.services.evidence import EvidenceService
from apps.api.app.services.idempotency import IdempotencyGuard, IdempotencyScope
from apps.api.app.services.lifecycle import Lifecycle
from apps.api.app.services.pagination import decode_cursor, encode_cursor, keyset, page_meta
from apps.api.app.services.records import RecordService
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

DECISION_EVENT = {
    "approve": "approve_review",
    "reject": "reject_review",
    "request_correction": "request_correction",
}
RESULTING_REVIEW_STATE = {
    "approve": "approved",
    "reject": "rejected",
    "request_correction": "awaiting_information",
}
DECISION_PERMISSION = {
    "approve": "review:approve",
    "reject": "review:reject",
    "request_correction": "review:request_correction",
}
DEFAULT_QUEUE_STATUSES = ("open", "awaiting_information")
# One operation name per command (`IDEMPOTENT_OPERATIONS.recordReviewDecision`).
REVIEW_OPERATION = "record_review_decision"


@dataclass(frozen=True)
class ReviewQuery:
    statuses: tuple[str, ...] = DEFAULT_QUEUE_STATUSES
    flag_code: str | None = None
    opened_from: date | None = None
    opened_to: date | None = None
    facility_id: uuid.UUID | None = None
    sort: str = "opened_at"
    cursor: str | None = None
    limit: int = 25


@dataclass(frozen=True)
class DecisionOutcome:
    status_code: int
    body: dict[str, Any]


def case_summary(case: ReviewCase, record: RecoveryRecord) -> dict[str, Any]:
    """`ReviewCaseSummary`. Absent optional fields are omitted, never `null`."""
    latest = case.decisions[-1] if case.decisions else None
    summary: dict[str, Any] = {
        "case_id": str(case.id),
        "record_id": str(record.id),
        "human_reference": record.human_reference,
        "category": record.category,
        "status": case.status,
        "flag_codes": list(case.flag_codes),
        "opened_at": format_timestamp(case.opened_at),
        "record_business_state": record.business_state,
        "decision_eligible": record.business_state == "under_review",
    }
    if case.facility_id is not None:
        summary["facility_id"] = str(case.facility_id)
    if case.assigned_reviewer_id is not None:
        summary["assigned_reviewer_id"] = str(case.assigned_reviewer_id)
    if latest is not None:
        summary["latest_decision"] = {
            "decision": latest.decision,
            "reason_code": latest.reason_code,
            "decided_at": format_timestamp(latest.decision_timestamp),
        }
    return summary


def decision_view(decision: ReviewDecision) -> dict[str, Any]:
    view = {
        "decision_id": str(decision.id),
        "reviewer": mappers.actor_reference(decision.reviewer_id, decision.reviewer_programme_id),
        "decision": decision.decision,
        "reason_code": decision.reason_code,
        "reviewer_note": decision.reviewer_note,
        "review_reason_codes": list(decision.review_reason_codes),
        "evidence_considered": list(decision.evidence_considered),
        "decision_evidence_id": str(decision.decision_evidence_id),
        "decision_timestamp": format_timestamp(decision.decision_timestamp),
        "recorded_at": format_timestamp(decision.recorded_at),
        "previous_review_state": decision.previous_review_state,
        "resulting_review_state": decision.resulting_review_state,
        "previous_record_state": decision.previous_record_state,
        "resulting_record_state": decision.resulting_record_state,
    }
    if decision.requested_correction:
        view["requested_correction"] = decision.requested_correction
    return view


class ReviewService:
    def __init__(self, session: AsyncSession, services: AppServices, context: RequestContext):
        self.session = session
        self.services = services
        self.context = context
        self.records = RecoveryRecordRepository(session)
        self.workflow = WorkflowRepository(session)
        self.record_service = RecordService(session, services, context)
        self.clock = services.clock

    async def _authorize(self, actor: Actor, record: RecoveryRecord, permission: str) -> None:
        await self.services.authorizer.require(
            actor,
            permission,
            context_for(actor, RecordScope.of(record)),
            self.context,
            target_type="recovery_record",
            target_id=record.id,
        )

    # Queue and detail -----------------------------------------------------------------------

    async def queue(self, actor: Actor, query: ReviewQuery) -> dict[str, Any]:
        await self.services.authorizer.require_role_permission(
            actor, "review:evidence", self.context, "review_case", None
        )
        descending = query.sort.startswith("-")
        statement = sa.select(ReviewCase).where(
            ReviewCase.programme_id.in_(actor.programme_ids),
            ReviewCase.status.in_(query.statuses),
            sa.or_(
                ReviewCase.assigned_reviewer_id.is_(None),
                ReviewCase.assigned_reviewer_id == actor.user_id,
            ),
        )
        if query.facility_id is not None:
            statement = statement.where(ReviewCase.facility_id == query.facility_id)
        if query.flag_code is not None:
            statement = statement.where(self._has_flag(query.flag_code))
        if query.opened_from is not None:
            statement = statement.where(
                ReviewCase.opened_at >= datetime.combine(query.opened_from, time.min, timezone.utc)
            )
        if query.opened_to is not None:
            end = datetime.combine(query.opened_to, time.min, timezone.utc) + timedelta(days=1)
            statement = statement.where(ReviewCase.opened_at < end)
        statement = keyset(
            statement,
            ReviewCase.opened_at,
            ReviewCase.id,
            descending,
            decode_cursor(query.cursor, query.sort),
        ).limit(query.limit + 1)
        async with self.session.begin():
            cases = list(await self.workflow.execute_review_listing(statement))
            page = cases[: query.limit]
            records = {
                record.id: record
                for record in await self.records.execute_listing(
                    sa.select(RecoveryRecord).where(
                        RecoveryRecord.id.in_([case.record_id for case in page])
                    )
                )
            }
            items = [case_summary(case, records[case.record_id]) for case in page]
            next_cursor = None
            if len(cases) > query.limit:
                last = page[-1]
                next_cursor = encode_cursor(query.sort, last.opened_at, last.id)
        page_body = {"items": items, "pagination": page_meta(next_cursor)}
        check_response("review_case_page", page_body)
        return page_body

    def _has_flag(self, flag_code: str) -> sa.ColumnElement[bool]:
        """JSON-array membership, expressed natively per dialect."""
        if self.session.get_bind().dialect.name == "postgresql":
            return sa.type_coerce(ReviewCase.flag_codes, JSONB).contains([flag_code])
        element = sa.func.json_each(ReviewCase.flag_codes).table_valued("value")
        return sa.exists(sa.select(1).select_from(element).where(element.c.value == flag_code))

    async def detail(self, case_id: uuid.UUID, actor: Actor) -> dict[str, Any]:
        await self.services.authorizer.require_role_permission(
            actor, "review:evidence", self.context, "review_case", case_id
        )
        async with self.session.begin():
            case = await self.workflow.get_review_case(case_id)
            if case is None:
                raise not_found()
            record = await self.records.get(case.record_id)
            assert record is not None
            await self._authorize(actor, record, "review:evidence")
            evidence = EvidenceService(self.session, self.services, self.context)
            items = await self.records.list_evidence(record.id)
            events = await self.records.list_events(record.id)
            self.services.audit.add(
                self.session,
                self.services.audit.event(
                    action="review-case.accessed",
                    outcome="succeeded",
                    context=self.context,
                    actor=actor,
                    target_type="review_case",
                    target_id=case.id,
                    programme_id=case.programme_id,
                ),
            )
            result = {
                "case": case_summary(case, record),
                "record": self.record_service.represent(record, actor),
                "evidence": [evidence.represent(item, actor, record) for item in items],
                "timeline": [mappers.recovery_record_event(event) for event in events],
                "decisions": [decision_view(decision) for decision in case.decisions],
            }
        check_response("review_case_detail", result)
        return result

    # Decisions ------------------------------------------------------------------------------

    def _validate_request(self, actor: Actor, request: dict[str, Any]) -> None:
        decision = request["decision"]
        issues = []
        scope = request["idempotency"]["scope"]
        if scope["actor_id"] != str(actor.user_id):
            issues.append(
                {"field": "idempotency.scope.actor_id", "reason": "must_be_signed_in_user"}
            )
        if scope["operation"] != REVIEW_OPERATION:
            issues.append(
                {"field": "idempotency.scope.operation", "reason": "must_be_record_review_decision"}
            )
        if scope.get("resource_id") != request["recovery_record_id"]:
            issues.append({"field": "idempotency.scope.resource_id", "reason": "must_match_record"})
        if request["reason_code"] not in REASON_CODES_BY_DECISION[decision]:
            issues.append({"field": "reason_code", "reason": "not_valid_for_decision"})
        if not request["reviewer_note"].strip():
            issues.append({"field": "reviewer_note", "reason": "required"})
        if (
            decision == "request_correction"
            and not (request.get("requested_correction") or "").strip()
        ):
            issues.append({"field": "requested_correction", "reason": "required"})
        allowed_reasons = {*REVIEW_FLAG_CODES, MANUAL_REVIEW_REASON}
        if any(code not in allowed_reasons for code in request["review_reason_codes"]):
            issues.append({"field": "review_reason_codes", "reason": "unsupported_value"})
        if issues:
            raise ApiError(
                status_code=422,
                code="VALIDATION_FAILED",
                message="The review decision is not valid.",
                field_issues=issues,
            )
        reviewer = request["assigned_reviewer"]
        programme = reviewer.get("programme_id")
        if reviewer["actor_id"] != str(actor.user_id) or (
            programme is not None and uuid.UUID(programme) not in actor.programme_ids
        ):
            raise permission_denied("A decision can only be recorded by the signed-in reviewer.")

    async def decide(self, actor: Actor, request: dict[str, Any]) -> DecisionOutcome:
        decision = request["decision"]
        permission = DECISION_PERMISSION[decision]
        await self.services.authorizer.require_role_permission(
            actor, permission, self.context, "recovery_record", request["recovery_record_id"]
        )
        self._validate_request(actor, request)
        record_id = uuid.UUID(request["recovery_record_id"])
        idempotency = request["idempotency"]
        scope = IdempotencyScope(
            actor_id=actor.user_id,
            operation=idempotency["scope"]["operation"],
            resource_scope=str(record_id),
            key=idempotency["idempotency_key"],
            request_digest=idempotency["request_digest"],
        )
        guard = IdempotencyGuard(
            self.session, self.clock, self.services.settings.idempotency_retention_days
        )
        evidence_service = EvidenceService(self.session, self.services, self.context)
        generated: list[Evidence] = []
        try:
            async with self.session.begin():
                replay = await guard.replay(scope)
                if replay is not None:
                    return DecisionOutcome(200, {**replay.body, "replayed": True})
                record = await self.records.get(record_id, for_update=True)
                if record is None or record.review_case is None:
                    raise not_found()
                await self._authorize(actor, record, permission)
                outcome = await self._apply(
                    actor, record, record.review_case, request, evidence_service, generated
                )
                self.services.contracts.check_response("programme_review_response", outcome.body)
                guard.remember(scope, outcome.status_code, outcome.body)
                return outcome
        except BaseException:
            await evidence_service.discard_generated(generated)
            raise

    async def _apply(
        self,
        actor: Actor,
        record: RecoveryRecord,
        case: ReviewCase,
        request: dict[str, Any],
        evidence_service: EvidenceService,
        generated: list[Evidence],
    ) -> DecisionOutcome:
        decision = request["decision"]
        if record.business_state in TERMINAL_RECOVERY_RECORD_STATES:
            raise invalid_transition(
                "This record already holds a final decision and cannot be decided again.",
                reason="ALREADY_DECIDED",
            )
        if record.business_state != "under_review":
            raise invalid_transition(
                "Only a record under review can receive a decision.", reason="NOT_UNDER_REVIEW"
            )
        if (
            request["previous_record_state"] != record.business_state
            or request["previous_review_state"] != case.status
        ):
            raise version_conflict(
                "The review changed since it was read. Refresh the case before deciding."
            )
        record_evidence = {str(item.id) for item in await self.records.list_evidence(record.id)}
        if not set(request["evidence_considered"]) <= record_evidence:
            raise validation_failed(
                "Considered evidence must belong to the record.",
                "evidence_considered",
                "invalid_reference",
            )
        decided_at = parse_timestamp(request["decision_timestamp"])
        skew = timedelta(seconds=self.services.settings.clock_skew_seconds)
        if decided_at > self.clock() + skew or decided_at < case.opened_at - skew:
            raise validation_failed(
                "The decision time must fall between the case opening and now.",
                "decision_timestamp",
                "out_of_range",
            )

        now = self.clock()
        decision_evidence = await evidence_service.store_generated(
            record,
            actor,
            "reviewer_decision",
            {
                "record_id": str(record.id),
                "review_case_id": str(case.id),
                "decision": decision,
                "reason_code": request["reason_code"],
                "reviewer_note": request["reviewer_note"].strip(),
                "requested_correction": (request.get("requested_correction") or "").strip() or None,
                "review_reason_codes": request["review_reason_codes"],
                "decision_timestamp": request["decision_timestamp"],
                "recorded_at": format_timestamp(now),
            },
        )
        generated.append(decision_evidence)
        await self.session.flush()

        previous_review_state = case.status
        previous_record_state = record.business_state
        await Lifecycle(self.session, self.clock, self.context).apply(
            record,
            DECISION_EVENT[decision],
            actor_role="programme_reviewer",
            actor=actor,
            reason=f"{request['reason_code']}: {request['reviewer_note'].strip()}",
        )
        case.status = RESULTING_REVIEW_STATE[decision]
        case.assigned_reviewer_id = actor.user_id
        if decision in ("approve", "reject"):
            case.closed_at = now
        case.updated_at = now
        self.workflow.add(
            ReviewDecision(
                review_case_id=case.id,
                record_id=record.id,
                reviewer_id=actor.user_id,
                reviewer_programme_id=actor.programme_id,
                decision=decision,
                reason_code=request["reason_code"],
                reviewer_note=request["reviewer_note"].strip(),
                requested_correction=(request.get("requested_correction") or "").strip() or None,
                review_reason_codes=request["review_reason_codes"],
                evidence_considered=request["evidence_considered"],
                decision_evidence_id=decision_evidence.id,
                decision_timestamp=decided_at,
                recorded_at=now,
                previous_review_state=previous_review_state,
                resulting_review_state=case.status,
                previous_record_state=previous_record_state,
                resulting_record_state=record.business_state,
            )
        )
        self.services.audit.add(
            self.session,
            self.services.audit.event(
                action="review-decision.recorded",
                outcome="succeeded",
                context=self.context,
                actor=actor,
                target_type="recovery_record",
                target_id=record.id,
                programme_id=record.programme_id,
                facility_id=case.facility_id,
                details={
                    "decision": decision,
                    "reason_code": request["reason_code"],
                    "resulting_record_state": record.business_state,
                    # Only approved-and-completed records count toward verified totals (BR-010).
                    "reporting_eligible": record.business_state == "approved_and_completed",
                },
            ),
        )
        await self.session.flush()
        return DecisionOutcome(
            201,
            {
                "recovery_record_id": str(record.id),
                "previous_review_state": previous_review_state,
                "resulting_review_state": case.status,
                "previous_record_state": previous_record_state,
                "resulting_record_state": record.business_state,
                "decision_timestamp": request["decision_timestamp"],
                "replayed": False,
            },
        )
