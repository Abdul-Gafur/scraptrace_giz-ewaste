"""Recovery records, their lifecycle events, evidence metadata and QR lookup tokens."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from apps.api.app.db.base import Base, Timestamps, enum_column
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import utc_now
from apps.api.app.domain.vocabulary import (
    CAPTURE_SOURCES,
    CONNECTIVITY_STATES,
    EVIDENCE_TYPES,
    EVIDENCE_VALIDATION_STATUSES,
    EWASTE_CATEGORIES,
    HANDOFF_STATES,
    ITEM_CONDITIONS,
    PROCESSING_STATES,
    RECORD_KINDS,
    RECOVERY_RECORD_EVENT_TYPES,
    RECOVERY_RECORD_STATES,
    TRANSITION_ACTOR_ROLES,
    WEIGHT_UNITS,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from apps.api.app.db.models.workflow import Handoff, ProcessingRecord, ReviewCase


class RecoveryRecord(Timestamps, Base):
    """The aggregate root. `revision` is an optimistic-concurrency version: every UPDATE is
    conditional on the revision that was read."""

    __tablename__ = "recovery_records"
    __table_args__ = (
        sa.CheckConstraint("item_count IS NULL OR item_count > 0", name="item_count_positive"),
        sa.CheckConstraint(
            "approximate_weight_value IS NULL OR approximate_weight_value > 0",
            name="approximate_weight_positive",
        ),
        sa.CheckConstraint(
            "(approximate_weight_value IS NULL) = (approximate_weight_unit IS NULL)",
            name="approximate_weight_has_unit",
        ),
        sa.CheckConstraint(
            "category <> 'mixed_scrap' "
            "OR (record_kind = 'batch' AND approximate_weight_value IS NOT NULL)",
            name="mixed_scrap_is_weighed_batch",
        ),
        sa.Index("ix_recovery_records_collector_id_created_at", "collector_id", "created_at"),
        sa.Index(
            "ix_recovery_records_programme_id_business_state", "programme_id", "business_state"
        ),
        sa.Index("ix_recovery_records_business_state_updated_at", "business_state", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    human_reference: Mapped[str] = mapped_column(sa.String(20), nullable=False, unique=True)
    programme_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=False
    )
    collector_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    record_kind: Mapped[str] = enum_column("record_kind", RECORD_KINDS, nullable=False)
    category: Mapped[str] = enum_column("ewaste_category", EWASTE_CATEGORIES, nullable=False)
    item_count: Mapped[int | None] = mapped_column(nullable=True)
    approximate_weight_value: Mapped[float | None] = mapped_column(
        sa.Numeric(14, 4, asdecimal=False), nullable=True
    )
    approximate_weight_unit: Mapped[str | None] = enum_column(
        "approximate_weight_unit", WEIGHT_UNITS, nullable=True
    )
    condition: Mapped[str] = enum_column("item_condition", ITEM_CONDITIONS, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(nullable=False)
    # Consented coordinates only; returned solely to roles holding `personal_data:view`.
    capture_location: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    approximate_area: Mapped[dict[str, Any]] = mapped_column(nullable=False)
    # The original prediction is kept as received and never overwritten by a correction.
    vision_result: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    category_confirmation: Mapped[dict[str, Any]] = mapped_column(nullable=False)
    estimated_price: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    safety_guide: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    destination: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    destination_location_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("facility_locations.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    # Evidence references its record, so this side of the cycle is added after both tables
    # exist (`use_alter`) and is filled in the same transaction that stores the photograph.
    original_image_evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey(
            "evidence.id",
            ondelete="RESTRICT",
            use_alter=True,
            name="fk_recovery_records_original_image_evidence_id_evidence",
        ),
        nullable=True,
        unique=True,
    )
    business_state: Mapped[str] = enum_column(
        "business_state", RECOVERY_RECORD_STATES, nullable=False
    )
    handoff_state: Mapped[str] = enum_column("handoff_state", HANDOFF_STATES, nullable=False)
    processing_state: Mapped[str] = enum_column(
        "processing_state", PROCESSING_STATES, nullable=False
    )
    device_instance_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    integrity_digest: Mapped[str | None] = mapped_column(sa.String(71), nullable=True)
    previous_integrity_digest: Mapped[str | None] = mapped_column(sa.String(71), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    revision: Mapped[int] = mapped_column(nullable=False)

    # DeclarativeBase types this as an instance attribute, so ClassVar is not applicable.
    __mapper_args__ = {"version_id_col": revision}  # noqa: RUF012

    evidence: Mapped[list[Evidence]] = relationship(
        back_populates="record",
        foreign_keys="Evidence.record_id",
        lazy="raise",
        order_by="Evidence.created_at",
    )
    events: Mapped[list[RecoveryRecordEvent]] = relationship(
        back_populates="record", lazy="raise", order_by="RecoveryRecordEvent.occurred_at"
    )
    qr_tokens: Mapped[list[QrLookupToken]] = relationship(back_populates="record", lazy="raise")
    handoff: Mapped[Handoff | None] = relationship(back_populates="record", lazy="raise")
    processing: Mapped[ProcessingRecord | None] = relationship(
        back_populates="record", lazy="raise"
    )
    review_case: Mapped[ReviewCase | None] = relationship(back_populates="record", lazy="raise")


class RecoveryRecordEvent(Base):
    """Append-only lifecycle history. Database triggers reject UPDATE and DELETE."""

    __tablename__ = "recovery_record_events"
    __table_args__ = (
        sa.CheckConstraint(
            "actor_role = 'system' OR actor_id IS NOT NULL", name="user_event_has_actor"
        ),
        sa.Index("ix_recovery_record_events_record_id_occurred_at", "record_id", "occurred_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False
    )
    event_schema_version: Mapped[str] = mapped_column(sa.String(20), nullable=False)
    event_type: Mapped[str] = enum_column("event_type", RECOVERY_RECORD_EVENT_TYPES, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    actor_programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    actor_facility_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=True
    )
    actor_role: Mapped[str] = enum_column(
        "event_actor_role", TRANSITION_ACTOR_ROLES, nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(nullable=False)
    previous_state: Mapped[str] = enum_column(
        "event_previous_state", RECOVERY_RECORD_STATES, nullable=False
    )
    resulting_state: Mapped[str] = enum_column(
        "event_resulting_state", RECOVERY_RECORD_STATES, nullable=False
    )
    reason: Mapped[str | None] = mapped_column(sa.String(1000), nullable=True)
    # The evidence an `evidence_added` event describes, and the flags a review-opening event
    # raised. Both are empty for other events.
    evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("evidence.id", ondelete="RESTRICT"), nullable=True
    )
    flag_codes: Mapped[list[str] | None] = mapped_column(nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)

    record: Mapped[RecoveryRecord] = relationship(back_populates="events", lazy="raise")


class Evidence(Timestamps, Base):
    """Evidence metadata. Binary content lives in evidence storage under `object_key`; rows
    cannot be deleted (trigger), and `validation_status` is the only field expected to change."""

    __tablename__ = "evidence"
    __table_args__ = (
        sa.CheckConstraint("file_size_bytes > 0", name="file_size_positive"),
        sa.Index("ix_evidence_record_id_evidence_type", "record_id", "evidence_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False
    )
    evidence_type: Mapped[str] = enum_column("evidence_type", EVIDENCE_TYPES, nullable=False)
    storage_provider: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    object_key: Mapped[str] = mapped_column(sa.String(1024), nullable=False, unique=True)
    object_version: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    mime_type: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(nullable=False)
    content_digest: Mapped[str] = mapped_column(sa.String(71), nullable=False, index=True)
    image_width: Mapped[int | None] = mapped_column(nullable=True)
    image_height: Mapped[int | None] = mapped_column(nullable=True)
    metadata_stripped: Mapped[bool] = mapped_column(default=False, nullable=False)
    capture_source: Mapped[str] = enum_column("capture_source", CAPTURE_SOURCES, nullable=False)
    captured_by_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    captured_by_programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    captured_by_facility_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=True
    )
    device_instance_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    captured_at: Mapped[datetime] = mapped_column(nullable=False)
    server_received_at: Mapped[datetime] = mapped_column(nullable=False)
    coordinates: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    application_version: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    connectivity: Mapped[str] = enum_column("connectivity", CONNECTIVITY_STATES, nullable=False)
    ai_observation: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    human_correction: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    validation_status: Mapped[str] = enum_column(
        "validation_status", EVIDENCE_VALIDATION_STATUSES, nullable=False
    )

    record: Mapped[RecoveryRecord] = relationship(
        back_populates="evidence", foreign_keys=[record_id], lazy="raise"
    )


class QrLookupToken(Timestamps, Base):
    """An opaque handoff lookup token. Only its SHA-256 digest and derivation nonce are stored;
    the plaintext is never written to the database."""

    __tablename__ = "qr_lookup_tokens"
    __table_args__ = (
        sa.Index(
            "uq_qr_lookup_tokens_record_id_active",
            "record_id",
            unique=True,
            postgresql_where=sa.text("revoked_at IS NULL"),
            sqlite_where=sa.text("revoked_at IS NULL"),
        ),
        sa.Index("uq_qr_lookup_tokens_transfer_code_digest", "transfer_code_digest", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    token_digest: Mapped[str] = mapped_column(sa.String(64), nullable=False, unique=True)
    # Keyed digest of the manual transfer code issued with this token (ADR-009). The code
    # itself is never stored; it is re-derived for the owning collector.
    transfer_code_digest: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    nonce: Mapped[bytes] = mapped_column(sa.LargeBinary(16), nullable=False)
    activated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(nullable=True)

    record: Mapped[RecoveryRecord] = relationship(back_populates="qr_tokens", lazy="raise")
