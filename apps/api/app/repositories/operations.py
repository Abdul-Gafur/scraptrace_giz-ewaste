"""Idempotency outcomes and audit events."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from apps.api.app.db.models import AuditEvent, IdempotencyRecord
from sqlalchemy.ext.asyncio import AsyncSession


class IdempotencyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find(
        self, actor_id: uuid.UUID, operation: str, resource_scope: str, key: str
    ) -> IdempotencyRecord | None:
        result = await self.session.execute(
            sa.select(IdempotencyRecord).where(
                IdempotencyRecord.actor_id == actor_id,
                IdempotencyRecord.operation == operation,
                IdempotencyRecord.resource_scope == resource_scope,
                IdempotencyRecord.idempotency_key == key,
            )
        )
        return result.scalar_one_or_none()

    def add(self, record: IdempotencyRecord) -> None:
        self.session.add(record)

    async def purge_expired(self, now: datetime) -> int:
        result = await self.session.execute(
            sa.delete(IdempotencyRecord).where(IdempotencyRecord.expires_at <= now)
        )
        return int(getattr(result, "rowcount", 0) or 0)


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, event: AuditEvent) -> None:
        self.session.add(event)

    async def list_for_target(self, target_type: str, target_id: str) -> Sequence[AuditEvent]:
        result = await self.session.execute(
            sa.select(AuditEvent)
            .where(AuditEvent.target_type == target_type, AuditEvent.target_id == target_id)
            .order_by(AuditEvent.occurred_at, AuditEvent.id)
        )
        return result.scalars().all()

    async def list_by_action(self, action: str) -> Sequence[AuditEvent]:
        result = await self.session.execute(
            sa.select(AuditEvent)
            .where(AuditEvent.action == action)
            .order_by(AuditEvent.occurred_at, AuditEvent.id)
        )
        return result.scalars().all()
