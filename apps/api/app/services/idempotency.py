"""Scoped idempotency (ADR-005, BR-007, FR-OFF-005).

The same actor, operation, resource and key with the same request digest replays the stored
logical result; the same scoped key with a different digest is `IDEMPOTENCY_CONFLICT` (409).
The outcome is stored in the transaction that performs the mutation, so a result is never
recorded for work that rolled back.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from apps.api.app.core.errors import ApiError
from apps.api.app.db.models import IdempotencyRecord
from apps.api.app.domain.identifiers import IDEMPOTENCY_KEY_PATTERN
from apps.api.app.domain.time import Clock
from apps.api.app.repositories.operations import IdempotencyRepository
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class IdempotencyScope:
    actor_id: uuid.UUID
    operation: str
    resource_scope: str
    key: str
    request_digest: str


@dataclass(frozen=True)
class Replay:
    status_code: int
    body: dict[str, Any]


def idempotency_conflict() -> ApiError:
    return ApiError(
        status_code=409,
        code="IDEMPOTENCY_CONFLICT",
        message="This idempotency key was already used for a different request.",
    )


def require_header_key(value: str | None) -> str:
    if value is None:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="An Idempotency-Key header is required for this operation.",
            field_issues=[{"field": "Idempotency-Key", "reason": "required"}],
        )
    if IDEMPOTENCY_KEY_PATTERN.fullmatch(value) is None:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The Idempotency-Key header is not valid.",
            field_issues=[{"field": "Idempotency-Key", "reason": "invalid_format"}],
        )
    return value


class IdempotencyGuard:
    def __init__(self, session: AsyncSession, clock: Clock, retention_days: int) -> None:
        self._repository = IdempotencyRepository(session)
        self._clock = clock
        self._retention = timedelta(days=retention_days)

    async def replay(self, scope: IdempotencyScope) -> Replay | None:
        stored = await self._repository.find(
            scope.actor_id, scope.operation, scope.resource_scope, scope.key
        )
        if stored is None:
            return None
        if stored.request_digest != scope.request_digest:
            raise idempotency_conflict()
        return Replay(status_code=stored.response_status, body=dict(stored.response_body))

    def remember(self, scope: IdempotencyScope, status_code: int, body: dict[str, Any]) -> None:
        now = self._clock()
        self._repository.add(
            IdempotencyRecord(
                actor_id=scope.actor_id,
                operation=scope.operation,
                resource_scope=scope.resource_scope,
                idempotency_key=scope.key,
                request_digest=scope.request_digest,
                response_status=status_code,
                response_body=body,
                created_at=now,
                expires_at=now + self._retention,
            )
        )
