"""The authenticated actor and server-side authorisation (ADR-006, FR-ACC-002).

Every decision defers to `is_permission_allowed`, the port of the contract helper, with a
context computed here from persisted facts: ownership, programme assignment, facility
(receiving-location) assignment and review assignment. Role-level refusals return 403;
object-level refusals return 404 when revealing that the object exists would leak information.
Both are recorded as audit events.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from apps.api.app.contracts.mappers import actor_reference
from apps.api.app.core.errors import not_found, permission_denied
from apps.api.app.db.models import RecoveryRecord
from apps.api.app.domain.permissions import (
    ROLE_PERMISSIONS,
    AuthorizationContext,
    is_permission_allowed,
    role_has_permission,
)
from apps.api.app.services.audit import AuditTrail, RequestContext

FacilityMode = Literal["strict", "lenient"]


def _sole(values: frozenset[uuid.UUID]) -> uuid.UUID | None:
    return next(iter(values)) if len(values) == 1 else None


@dataclass(frozen=True)
class Actor:
    user_id: uuid.UUID
    username: str
    display_name: str
    role: str
    programme_ids: frozenset[uuid.UUID]
    facility_ids: frozenset[uuid.UUID]
    location_ids: frozenset[uuid.UUID]
    session_version: int
    preferred_language: str

    @property
    def programme_id(self) -> uuid.UUID | None:
        return _sole(self.programme_ids)

    @property
    def facility_id(self) -> uuid.UUID | None:
        return _sole(self.facility_ids)

    @property
    def permissions(self) -> list[str]:
        return sorted(ROLE_PERMISSIONS.get(self.role, frozenset()))

    def has_permission(self, permission: str) -> bool:
        return role_has_permission(self.role, permission)

    def reference(self) -> dict[str, str]:
        """The contract `ActorReference` for records, events and evidence."""
        return actor_reference(self.user_id, self.programme_id, self.facility_id)


@dataclass(frozen=True)
class RecordScope:
    """The persisted facts that decide who may act on one recovery record."""

    record_id: uuid.UUID
    collector_id: uuid.UUID
    programme_id: uuid.UUID
    location_id: uuid.UUID | None
    business_state: str
    assigned_reviewer_id: uuid.UUID | None = None

    @classmethod
    def of(cls, record: RecoveryRecord) -> RecordScope:
        handoff = record.handoff
        review_case = record.review_case
        return cls(
            record_id=record.id,
            collector_id=record.collector_id,
            programme_id=record.programme_id,
            # A received record belongs to the facility that received it; before that, to the
            # destination the collector selected (if any).
            location_id=handoff.receiving_location_id
            if handoff is not None
            else record.destination_location_id,
            business_state=record.business_state,
            assigned_reviewer_id=review_case.assigned_reviewer_id
            if review_case is not None
            else None,
        )


def context_for(
    actor: Actor,
    scope: RecordScope,
    *,
    facility_mode: FacilityMode = "strict",
    personal_data_required: bool = False,
) -> AuthorizationContext:
    """`strict` facility scope requires the record to be destined for or received at one of the
    actor's locations. `lenient` also admits records with no selected destination; it is used
    only for handoff, where the QR token proves the recycler was presented the item."""
    assigned_programme = scope.programme_id in actor.programme_ids
    if facility_mode == "strict":
        location_match = scope.location_id is not None and scope.location_id in actor.location_ids
    else:
        location_match = scope.location_id is None or scope.location_id in actor.location_ids
    return AuthorizationContext(
        owns_resource=scope.collector_id == actor.user_id,
        assigned_programme=assigned_programme,
        assigned_facility=bool(actor.location_ids) and assigned_programme and location_match,
        assigned_review=actor.role == "programme_reviewer"
        and (scope.assigned_reviewer_id is None or scope.assigned_reviewer_id == actor.user_id),
        personal_data_required=personal_data_required,
    )


def view_permission(actor: Actor) -> str:
    return (
        "recovery_record:view_own"
        if actor.role == "collector"
        else "recovery_record:view_operational"
    )


class Authorizer:
    def __init__(self, audit: AuditTrail) -> None:
        self._audit = audit

    async def _deny(
        self,
        actor: Actor,
        permission: str | None,
        context: RequestContext,
        target_type: str | None,
        target_id: str | uuid.UUID | None,
        reason: str,
    ) -> None:
        await self._audit.record_now(
            self._audit.event(
                action="authorization.denied",
                outcome="denied",
                context=context,
                actor=actor,
                target_type=target_type,
                target_id=target_id,
                details={"permission": permission, "reason": reason}
                if permission
                else {"reason": reason},
            )
        )

    async def require_role_permission(
        self,
        actor: Actor,
        permission: str,
        context: RequestContext,
        target_type: str | None = None,
        target_id: str | uuid.UUID | None = None,
    ) -> None:
        """Role-level gate: the role must hold the permission at all (403 otherwise)."""
        if not actor.has_permission(permission):
            await self._deny(actor, permission, context, target_type, target_id, "role")
            raise permission_denied()

    async def require(
        self,
        actor: Actor,
        permission: str,
        authorization: AuthorizationContext,
        context: RequestContext,
        *,
        target_type: str,
        target_id: str | uuid.UUID,
        conceal: bool = True,
    ) -> None:
        """Role and scope gate. Out-of-scope objects are concealed as 404 by default."""
        await self.require_role_permission(actor, permission, context, target_type, target_id)
        if not is_permission_allowed(actor.role, permission, authorization):
            await self._deny(actor, permission, context, target_type, target_id, "scope")
            raise not_found() if conceal else permission_denied()

    async def deny_scope(
        self,
        actor: Actor,
        permission: str | None,
        context: RequestContext,
        *,
        target_type: str,
        target_id: str | uuid.UUID,
        conceal: bool = True,
        reason: str = "scope",
    ) -> None:
        """Records and raises a scope denial decided by the caller."""
        await self._deny(actor, permission, context, target_type, target_id, reason)
        raise not_found() if conceal else permission_denied()
