"""Opening and extending review cases.

A flag is a request for human judgement, never proof of wrongdoing (BR-009, FR-REV-009). Named
flags accumulate on the record's single review case in the same transaction as the event that
raised them.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable

from apps.api.app.db.models import RecoveryRecord, ReviewCase
from apps.api.app.domain.time import Clock
from apps.api.app.services.audit import AuditTrail, RequestContext
from apps.api.app.services.authorization import Actor
from apps.api.app.services.lifecycle import fact_event
from sqlalchemy.ext.asyncio import AsyncSession


def merge_flags(existing: Iterable[str], new: Iterable[str]) -> list[str]:
    return list(dict.fromkeys([*existing, *new]))


async def raise_flags(
    session: AsyncSession,
    record: RecoveryRecord,
    flags: Iterable[str],
    *,
    opened_by_role: str,
    actor: Actor | None,
    facility_id: uuid.UUID | None,
    clock: Clock,
    audit: AuditTrail,
    context: RequestContext,
) -> ReviewCase | None:
    """Opens the record's review case, or adds flags to it and reopens it for review. Either
    way the record's timeline gains a `review_opened` event naming the new flags."""
    new_flags = list(dict.fromkeys(flags))
    if not new_flags:
        return record.review_case
    session.add(
        fact_event(
            record,
            "review_opened",
            occurred_at=clock(),
            context=context,
            actor_role=opened_by_role if actor is None else actor.role,
            actor=actor,
            flag_codes=new_flags,
        )
    )
    case = record.review_case
    if case is None:
        case = ReviewCase(
            record_id=record.id,
            programme_id=record.programme_id,
            facility_id=facility_id,
            status="open",
            flag_codes=new_flags,
            opened_at=clock(),
            opened_by_role=opened_by_role,
            opened_by_id=actor.user_id if actor is not None else None,
        )
        session.add(case)
        record.review_case = case
        action = "review-case.opened"
    else:
        case.flag_codes = merge_flags(case.flag_codes, new_flags)
        if case.status not in ("open", "awaiting_information"):
            case.status = "open"
            case.closed_at = None
        if case.facility_id is None:
            case.facility_id = facility_id
        action = "review-case.flags-added"
    audit.add(
        session,
        audit.event(
            action=action,
            outcome="succeeded",
            context=context,
            actor=actor,
            actor_role=opened_by_role if actor is None else None,
            target_type="recovery_record",
            target_id=record.id,
            programme_id=record.programme_id,
            facility_id=facility_id,
            details={"flag_codes": new_flags},
        ),
    )
    return case
