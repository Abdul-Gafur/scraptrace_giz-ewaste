"""Audit trail (business and security events).

`add` joins the caller's transaction, so a business event commits or rolls back with the change
it describes. `record_now` commits independently; it is used for denials and failures, whose
evidence must survive the rollback of the operation they describe. Details are allow-listed
primitives chosen by code, never request bodies, tokens, usernames or coordinates.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

from apps.api.app.db.models import AuditEvent
from apps.api.app.db.session import Database
from apps.api.app.domain.time import Clock
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from apps.api.app.services.authorization import Actor

LOGGER = logging.getLogger("scraptrace.audit")

DetailValue = str | int | float | bool | None | list[str]


@dataclass(frozen=True)
class RequestContext:
    correlation_id: str


class AuditTrail:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._database = database
        self._clock = clock

    def event(
        self,
        *,
        action: str,
        outcome: str,
        context: RequestContext,
        actor: Actor | None = None,
        actor_role: str | None = None,
        actor_id: uuid.UUID | None = None,
        target_type: str | None = None,
        target_id: str | uuid.UUID | None = None,
        programme_id: uuid.UUID | None = None,
        facility_id: uuid.UUID | None = None,
        details: dict[str, DetailValue] | None = None,
    ) -> AuditEvent:
        return AuditEvent(
            occurred_at=self._clock(),
            action=action,
            outcome=outcome,
            actor_id=actor.user_id if actor is not None else actor_id,
            actor_role=actor.role if actor is not None else actor_role,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            programme_id=programme_id,
            facility_id=facility_id,
            correlation_id=context.correlation_id,
            details=dict(details or {}),
        )

    def add(self, session: AsyncSession, event: AuditEvent) -> None:
        session.add(event)

    async def record_now(self, event: AuditEvent) -> None:
        try:
            async with self._database.session_scope() as session, session.begin():
                session.add(event)
        except SQLAlchemyError:
            # A failing audit write must not replace the response it describes; the gap is
            # visible in operational logs instead.
            LOGGER.warning(
                "audit_write_failed",
                extra={"context": {"action": event.action, "request_id": event.correlation_id}},
            )
