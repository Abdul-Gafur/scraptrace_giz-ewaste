"""Idempotency outcomes and the append-only audit trail."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from apps.api.app.db.base import Base, enum_column
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import utc_now
from apps.api.app.domain.vocabulary import TRANSITION_ACTOR_ROLES
from sqlalchemy.orm import Mapped, mapped_column

AUDIT_OUTCOMES = ("succeeded", "denied", "failed")


class IdempotencyRecord(Base):
    """The stored logical result of one scoped mutation (ADR-005). The same actor, operation,
    resource and key with the same request digest replays this result; a different digest is an
    `IDEMPOTENCY_CONFLICT`."""

    __tablename__ = "idempotency_records"
    __table_args__ = (
        sa.UniqueConstraint("actor_id", "operation", "resource_scope", "idempotency_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    operation: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    # The scoped resource identifier, or an empty string for unscoped operations. A NOT NULL
    # column keeps the uniqueness constraint effective on PostgreSQL, where NULLs are distinct.
    resource_scope: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    request_digest: Mapped[str] = mapped_column(sa.String(71), nullable=False)
    response_status: Mapped[int] = mapped_column(nullable=False)
    response_body: Mapped[dict[str, Any]] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(nullable=False, index=True)


class AuditEvent(Base):
    """Attributable business and security events. Append-only (triggers reject UPDATE and
    DELETE). `details` holds allow-listed, non-personal context only."""

    __tablename__ = "audit_events"
    __table_args__ = (
        sa.Index("ix_audit_events_target_type_target_id", "target_type", "target_id"),
        sa.Index("ix_audit_events_actor_id_occurred_at", "actor_id", "occurred_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    occurred_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False, index=True)
    action: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    outcome: Mapped[str] = enum_column("audit_outcome", AUDIT_OUTCOMES, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    actor_role: Mapped[str | None] = enum_column(
        "audit_actor_role", TRANSITION_ACTOR_ROLES, nullable=True
    )
    target_type: Mapped[str | None] = mapped_column(sa.String(60), nullable=True)
    target_id: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=True
    )
    correlation_id: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(nullable=False)
