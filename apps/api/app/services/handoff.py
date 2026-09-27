"""QR lookup and recycler handoff (FR-HND-001 to FR-HND-007).

Lookup resolves a presented QR payload, QR text, opaque token or human transfer code to a
minimised preview: only what a recycler needs to compare the delivery (no coordinates, no
contact, no collector identity beyond the opaque actor reference the handoff contract needs).
Invalid, unknown, inactive, revoked or expired tokens all return the same `404`, so nothing is
revealed about unrelated records.

Handoff applies the contract rules in one transaction: facility and identity validation, the
presented token, evidence checks, server-generated QR-scan and receipt evidence, named flags,
the `record_handoff` transition, the review case, the idempotency outcome and audit events.
A repeated identical request replays the first response; a second scan of a received record
returns `duplicate_scan` with the original receipt time and never creates another handoff.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from apps.api.app.container import AppServices
from apps.api.app.contracts import mappers
from apps.api.app.core.errors import (
    ApiError,
    not_found,
    permission_denied,
    validation_failed,
)
from apps.api.app.core.rate_limit import SlidingWindowRateLimiter
from apps.api.app.db.models import Evidence, Handoff, RecoveryRecord
from apps.api.app.domain.flags import Weight, evaluate_handoff_flags
from apps.api.app.domain.identifiers import HUMAN_REFERENCE_PATTERN, normalize_transfer_code
from apps.api.app.domain.time import format_timestamp, parse_timestamp
from apps.api.app.repositories.identity import IdentityRepository
from apps.api.app.repositories.records import RecoveryRecordRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.authorization import Actor, RecordScope, context_for
from apps.api.app.services.evidence import EvidenceService
from apps.api.app.services.idempotency import IdempotencyGuard, IdempotencyScope
from apps.api.app.services.lifecycle import Lifecycle
from apps.api.app.services.qr_tokens import (
    MalformedQr,
    Presented,
    UnsupportedQrVersion,
    parse_qr_payload,
    parse_qr_text,
)
from apps.api.app.services.review_cases import raise_flags
from sqlalchemy.ext.asyncio import AsyncSession

HANDOFF_OPERATION = "record_handoff"
CLIENT_HANDOFF_EVIDENCE = frozenset({"handoff_photo", "weight_measurement"})
DUPLICATE_CHECK_TYPES = ("handoff_photo", "weight_measurement")


@dataclass(frozen=True)
class HandoffOutcome:
    status_code: int
    body: dict[str, Any]


def unsupported_version() -> ApiError:
    return ApiError(
        status_code=422,
        code="UNSUPPORTED_CONTRACT_VERSION",
        message="This QR code was produced by an unsupported contract version.",
    )


def unknown_code() -> ApiError:
    return not_found("No record matches this code.")


def handoff_preview(record: RecoveryRecord) -> dict[str, Any]:
    """What a recycler may see before accepting a handoff (FR-HND-002)."""
    core = mappers.integrity_payload(record)
    preview: dict[str, Any] = {
        "record_id": core["record_id"],
        "human_reference": record.human_reference,
        "record_kind": record.record_kind,
        "category": record.category,
        "condition": record.condition,
        "approximate_area": {
            key: value
            for key, value in record.approximate_area.items()
            if key in ("label", "administrative_area", "country_code")
        },
        "captured_at": core["captured_at"],
        "collector": core["collector"],
        "original_image_evidence_id": core["original_image_evidence_id"],
        "business_state": record.business_state,
        "handoff_state": record.handoff_state,
    }
    for field in ("item_count", "approximate_weight"):
        if field in core:
            preview[field] = core[field]
    if record.destination is not None:
        preview["destination"] = record.destination
    return preview


class HandoffService:
    def __init__(
        self,
        session: AsyncSession,
        services: AppServices,
        context: RequestContext,
        limiter: SlidingWindowRateLimiter,
    ) -> None:
        self.session = session
        self.services = services
        self.context = context
        self.limiter = limiter
        self.records = RecoveryRecordRepository(session)
        self.identity = IdentityRepository(session)
        self.clock = services.clock

    async def _audit_failure(self, actor: Actor, action: str, reason: str) -> None:
        await self.services.audit.record_now(
            self.services.audit.event(
                action=action,
                outcome="failed",
                context=self.context,
                actor=actor,
                details={"reason": reason},
            )
        )

    def _throttle(self, actor: Actor) -> None:
        key = SlidingWindowRateLimiter.key("handoff-lookup", str(actor.user_id))
        retry_after = self.limiter.retry_after(key)
        if retry_after:
            raise ApiError(
                status_code=429,
                code="RATE_LIMIT_REACHED",
                message="Too many code lookups. Try again shortly.",
                retryable=True,
                safe_details={"retry_after_seconds": retry_after},
                headers={"Retry-After": str(retry_after)},
            )
        self.limiter.hit(key)

    async def _resolve_token(self, presented: Presented) -> RecoveryRecord | None:
        token = await self.records.get_qr_token_by_digest(
            self.services.qr_tokens.digest(presented.lookup_token)
        )
        if token is None or not self.services.qr_tokens.usable(token):
            return None
        if presented.record_id is not None and presented.record_id != token.record_id:
            return None
        return await self.records.get(token.record_id)

    # Lookup ----------------------------------------------------------------------------------

    async def lookup(self, actor: Actor, request: dict[str, Any]) -> dict[str, Any]:
        await self.services.authorizer.require_role_permission(
            actor, "handoff:accept", self.context, "recovery_record", None
        )
        self._throttle(actor)
        try:
            if "qr_payload" in request:
                payload = request["qr_payload"]
                presented: Presented | None = parse_qr_payload(
                    str(payload.get("contract_version")),
                    str(payload.get("record_id")),
                    str(payload.get("lookup_token")),
                )
            elif "qr_text" in request:
                presented = parse_qr_text(request["qr_text"])
            elif "lookup_token" in request:
                presented = Presented(lookup_token=request["lookup_token"], record_id=None)
            else:
                presented = None
        except UnsupportedQrVersion as exc:
            await self._audit_failure(actor, "qr-lookup.failed", "unsupported_contract_version")
            raise unsupported_version() from exc
        except MalformedQr as exc:
            await self._audit_failure(actor, "qr-lookup.failed", "malformed")
            raise unknown_code() from exc

        token_value: str | None
        async with self.session.begin():
            if presented is not None:
                record = await self._resolve_token(presented)
                token_value = presented.lookup_token
            else:
                code = normalize_transfer_code(str(request["transfer_code"]))
                record = (
                    await self.records.get_by_human_reference(code)
                    if HUMAN_REFERENCE_PATTERN.fullmatch(code)
                    else None
                )
                # A typed code proves presentation like a scan, so the handoff request can
                # carry the record's current token.
                token_value = (
                    self.services.qr_tokens.lookup_token_for(record)
                    if record is not None
                    and self.services.qr_tokens.usable(self.services.qr_tokens.current(record))
                    else None
                )
                if token_value is None:
                    record = None
            if record is None or record.programme_id not in actor.programme_ids:
                failure = "unknown_code"
            else:
                failure = None
                result = self._lookup_result(actor, record, token_value)
                self.services.audit.add(
                    self.session,
                    self.services.audit.event(
                        action="qr-lookup.resolved",
                        outcome="succeeded",
                        context=self.context,
                        actor=actor,
                        target_type="recovery_record",
                        target_id=record.id,
                        programme_id=record.programme_id,
                        facility_id=actor.facility_id,
                        details={"outcome": result["outcome"]},
                    ),
                )
        if failure is not None:
            await self._audit_failure(actor, "qr-lookup.failed", failure)
            raise unknown_code()
        return result

    def _lookup_result(
        self, actor: Actor, record: RecoveryRecord, token_value: str | None
    ) -> dict[str, Any]:
        scope = RecordScope.of(record)
        in_scope = context_for(actor, scope, facility_mode="lenient").assigned_facility
        if not in_scope:
            # The holder of the code learns only that it belongs to another facility.
            return {"outcome": "other_facility"}
        if record.handoff is not None:
            return {
                "outcome": "already_received",
                "received_at": format_timestamp(record.handoff.server_received_at),
                "record": handoff_preview(record),
            }
        if record.business_state != "awaiting_handoff":
            return {"outcome": "not_ready", "record": handoff_preview(record)}
        result: dict[str, Any] = {"outcome": "ready", "record": handoff_preview(record)}
        if token_value is not None:
            result["lookup_token"] = token_value
        return result

    # Handoff ---------------------------------------------------------------------------------

    def _validate_identity(self, actor: Actor, request: dict[str, Any]) -> None:
        scope = request["idempotency"]["scope"]
        issues = []
        if scope["actor_id"] != str(actor.user_id):
            issues.append(
                {"field": "idempotency.scope.actor_id", "reason": "must_be_signed_in_user"}
            )
        if scope["operation"] != HANDOFF_OPERATION:
            issues.append(
                {"field": "idempotency.scope.operation", "reason": "must_be_record_handoff"}
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
            raise permission_denied("A handoff can only be recorded by the signed-in recycler.")

    async def record(self, actor: Actor, request: dict[str, Any]) -> HandoffOutcome:
        authorizer = self.services.authorizer
        for permission in ("handoff:record", "handoff:accept"):
            await authorizer.require_role_permission(
                actor, permission, self.context, "recovery_record", request["recovery_record_id"]
            )
        self._validate_identity(actor, request)
        record_id = uuid.UUID(request["recovery_record_id"])
        location_id = uuid.UUID(request["receiving_location_id"])
        idempotency = request["idempotency"]
        scope = IdempotencyScope(
            actor_id=actor.user_id,
            operation=HANDOFF_OPERATION,
            resource_scope=str(record_id),
            key=idempotency["idempotency_key"],
            request_digest=idempotency["request_digest"],
        )
        guard = IdempotencyGuard(
            self.session, self.clock, self.services.settings.idempotency_retention_days
        )
        generated: list[Evidence] = []
        evidence_service = EvidenceService(self.session, self.services, self.context)
        try:
            async with self.session.begin():
                record = await self.records.get(record_id, for_update=True)
                replay = await guard.replay(scope)
                if replay is not None:
                    body = dict(replay.body)
                    if "replayed" in body:
                        body["replayed"] = True
                    return HandoffOutcome(200, body)
                token_record = await self._resolve_token(
                    Presented(lookup_token=request["lookup_token"], record_id=record_id)
                )
                if (
                    record is None
                    or token_record is None
                    or record.programme_id not in actor.programme_ids
                ):
                    await self._audit_failure(actor, "handoff.failed", "unknown_code")
                    raise unknown_code()
                location = await self._validate_location(actor, record, location_id)

                if record.handoff is not None:
                    outcome = HandoffOutcome(
                        200,
                        {
                            "outcome": "duplicate_scan",
                            "original_received_at": format_timestamp(
                                record.handoff.server_received_at
                            ),
                            "original_logical_result": record.handoff.outcome,
                        },
                    )
                elif record.business_state != "awaiting_handoff":
                    outcome = HandoffOutcome(
                        200,
                        {
                            "outcome": "rejected",
                            "reason_code": "RECORD_NOT_AWAITING_HANDOFF",
                            "message": "This record is not awaiting handoff, so a receipt "
                            "cannot be recorded.",
                            "replayed": False,
                        },
                    )
                else:
                    outcome = await self._accept(
                        actor, record, request, location.facility_id, generated, evidence_service
                    )
                self.services.contracts.check_response("handoff_response", outcome.body)
                guard.remember(scope, outcome.status_code, outcome.body)
                if outcome.body["outcome"] in ("duplicate_scan", "rejected"):
                    self.services.audit.add(
                        self.session,
                        self.services.audit.event(
                            action=f"handoff.{outcome.body['outcome'].replace('_', '-')}",
                            outcome="failed",
                            context=self.context,
                            actor=actor,
                            target_type="recovery_record",
                            target_id=record.id,
                            programme_id=record.programme_id,
                            facility_id=location.facility_id,
                        ),
                    )
                return outcome
        except BaseException:
            await evidence_service.discard_generated(generated)
            raise

    async def _validate_location(
        self, actor: Actor, record: RecoveryRecord, location_id: uuid.UUID
    ) -> Any:
        location = await self.identity.get_location(location_id)
        if (
            location is None
            or not location.is_active
            or location.verification_status in ("suspended", "expired")
            or location.facility.programme_id != record.programme_id
        ):
            raise validation_failed(
                "The receiving location is not an active participating location.",
                "receiving_location_id",
                "unknown_location",
            )
        if location_id not in actor.location_ids:
            await self.services.authorizer.deny_scope(
                actor,
                "handoff:record",
                self.context,
                target_type="facility_location",
                target_id=location_id,
                conceal=False,
                reason="facility_scope",
            )
        scope = RecordScope.of(record)
        if not context_for(actor, scope, facility_mode="lenient").assigned_facility:
            await self.services.authorizer.deny_scope(
                actor,
                "handoff:record",
                self.context,
                target_type="recovery_record",
                target_id=record.id,
                conceal=False,
                reason="other_facility",
            )
        return location

    async def _client_evidence(
        self, actor: Actor, record: RecoveryRecord, evidence_ids: list[str]
    ) -> list[Evidence]:
        if len(set(evidence_ids)) != len(evidence_ids):
            raise validation_failed(
                "Evidence identifiers repeat.", "evidence_ids", "duplicate_items"
            )
        items = []
        for value in evidence_ids:
            item = await self.records.get_evidence(uuid.UUID(value))
            if (
                item is None
                or item.record_id != record.id
                or item.evidence_type not in CLIENT_HANDOFF_EVIDENCE
                or item.captured_by_id != actor.user_id
                or item.validation_status != "accepted"
            ):
                raise validation_failed(
                    "Every evidence identifier must be a handoff or weight photograph this "
                    "recycler uploaded for the record.",
                    "evidence_ids",
                    "invalid_reference",
                )
            items.append(item)
        missing = CLIENT_HANDOFF_EVIDENCE - {item.evidence_type for item in items}
        if missing:
            # FR-HND-004: a handoff photograph and readable scale evidence are both required.
            raise validation_failed(
                "A handoff photograph and a weight photograph are required.",
                "evidence_ids",
                "missing_" + "_and_".join(sorted(missing)),
            )
        return items

    async def _accept(
        self,
        actor: Actor,
        record: RecoveryRecord,
        request: dict[str, Any],
        facility_id: uuid.UUID,
        generated: list[Evidence],
        evidence_service: EvidenceService,
    ) -> HandoffOutcome:
        now = self.clock()
        skew = timedelta(seconds=self.services.settings.clock_skew_seconds)
        handed_off_at = parse_timestamp(request["handoff_time"])
        if handed_off_at > now + skew or handed_off_at < record.captured_at - skew:
            raise validation_failed(
                "The handoff time must fall between capture and now.",
                "handoff_time",
                "out_of_range",
            )
        collector = request["collector_reference"]
        if collector["actor_id"] != str(record.collector_id) or collector.get(
            "programme_id", str(record.programme_id)
        ) != str(record.programme_id):
            raise validation_failed(
                "The collector reference does not match the record.",
                "collector_reference",
                "must_match_record",
            )
        programme = await self.identity.get_programme(record.programme_id)
        if programme is None:
            raise not_found()
        if request["final_price"]["currency"] != programme.currency:
            raise validation_failed(
                "The final price must use the programme currency.",
                "final_price.currency",
                "must_match_programme_currency",
            )
        client_items = await self._client_evidence(actor, record, request["evidence_ids"])

        scan = await evidence_service.store_generated(
            record,
            actor,
            "handoff_qr_scan",
            {
                "record_id": str(record.id),
                "token_id": str(self.services.qr_tokens.current(record).id),
                "verified_at": format_timestamp(now),
                "receiving_location_id": request["receiving_location_id"],
            },
        )
        generated.append(scan)
        receipt = await evidence_service.store_generated(
            record,
            actor,
            "recycler_receipt",
            {
                "record_id": str(record.id),
                "recycler": actor.reference(),
                "receiving_location_id": request["receiving_location_id"],
                "confirmed_category": request["confirmed_category"],
                "confirmed_condition": request["confirmed_condition"],
                "measured_weight": request["measured_weight"],
                "final_price": request["final_price"],
                "handoff_time": request["handoff_time"],
                "recorded_at": format_timestamp(now),
            },
        )
        generated.append(receipt)
        await self.session.flush()

        digests = [item.content_digest for item in client_items]
        flags = evaluate_handoff_flags(
            declared_weight=Weight(record.approximate_weight_value, record.approximate_weight_unit)
            if record.approximate_weight_value is not None and record.approximate_weight_unit
            else None,
            measured_weight=Weight(
                request["measured_weight"]["value"], request["measured_weight"]["unit"]
            ),
            declared_category=record.category,
            confirmed_category=request["confirmed_category"],
            threshold_percentage=programme.weight_discrepancy_threshold_percentage,
            duplicate_evidence_digest=await self.records.digest_used_elsewhere(
                digests, record.id, DUPLICATE_CHECK_TYPES
            ),
            available_evidence=await self.records.evidence_types(record.id),
        )

        handoff = Handoff(
            record_id=record.id,
            recycler_id=actor.user_id,
            recycler_programme_id=actor.programme_id,
            recycler_facility_id=facility_id,
            collector_id=record.collector_id,
            receiving_location_id=uuid.UUID(request["receiving_location_id"]),
            confirmed_category=request["confirmed_category"],
            confirmed_condition=request["confirmed_condition"],
            measured_weight_value=request["measured_weight"]["value"],
            measured_weight_unit=request["measured_weight"]["unit"],
            final_price_amount=request["final_price"]["amount"],
            final_price_currency=request["final_price"]["currency"],
            handed_off_at=handed_off_at,
            server_received_at=now,
            evidence_ids=[*request["evidence_ids"], str(scan.id), str(receipt.id)],
            outcome="discrepancy" if flags else "accepted",
            flag_codes=flags,
            created_at=now,
            updated_at=now,
        )
        self.session.add(handoff)
        record.handoff = handoff
        await Lifecycle(self.session, self.clock, self.context).apply(
            record, "record_handoff", actor_role="recycler", actor=actor
        )
        record.handoff_state = "disputed" if flags else "received"
        self.services.qr_tokens.current(record).used_at = now
        if flags:
            await raise_flags(
                self.session,
                record,
                flags,
                opened_by_role="system",
                actor=None,
                facility_id=facility_id,
                clock=self.clock,
                audit=self.services.audit,
                context=self.context,
            )
        self.services.audit.add(
            self.session,
            self.services.audit.event(
                action="handoff.recorded",
                outcome="succeeded",
                context=self.context,
                actor=actor,
                target_type="recovery_record",
                target_id=record.id,
                programme_id=record.programme_id,
                facility_id=facility_id,
                details={"outcome": handoff.outcome, "flag_codes": flags},
            ),
        )
        await self.session.flush()
        received_at = format_timestamp(now)
        if flags:
            body: dict[str, Any] = {
                "outcome": "discrepancy",
                "flag_codes": flags,
                "received_at": received_at,
                "replayed": False,
            }
        else:
            body = {
                "outcome": "accepted",
                "recovery_record_id": str(record.id),
                "received_at": received_at,
                "replayed": False,
            }
        return HandoffOutcome(201, body)
