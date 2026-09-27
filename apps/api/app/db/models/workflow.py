"""Handoff, processing and programme-review persistence."""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from apps.api.app.db.base import Base, Timestamps, enum_column
from apps.api.app.db.models.records import RecoveryRecord
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import utc_now
from apps.api.app.domain.vocabulary import (
    EWASTE_CATEGORIES,
    ITEM_CONDITIONS,
    PROCESSING_METHODS,
    RECOVERY_RECORD_STATES,
    REVIEW_DECISIONS,
    REVIEW_STATES,
    TRANSITION_ACTOR_ROLES,
    WEIGHT_UNITS,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

HANDOFF_OUTCOMES = ("accepted", "discrepancy")
PROCESSING_STATUSES = ("draft", "submitted")
REVIEW_CASE_STATUSES = ("open", "awaiting_information", "approved", "rejected")


class Handoff(Timestamps, Base):
    """The recycler's receipt. At most one per record; append-only (triggers reject UPDATE and
    DELETE), so a later scan can never overwrite the first confirmation."""

    __tablename__ = "handoffs"
    __table_args__ = (
        sa.CheckConstraint("measured_weight_value > 0", name="measured_weight_positive"),
        sa.CheckConstraint("final_price_amount >= 0", name="final_price_nonnegative"),
        sa.CheckConstraint("length(final_price_currency) = 3", name="currency_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    recycler_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    recycler_programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    recycler_facility_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    collector_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    receiving_location_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("facility_locations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    confirmed_category: Mapped[str] = enum_column(
        "handoff_confirmed_category", EWASTE_CATEGORIES, nullable=False
    )
    confirmed_condition: Mapped[str] = enum_column(
        "handoff_confirmed_condition", ITEM_CONDITIONS, nullable=False
    )
    measured_weight_value: Mapped[float] = mapped_column(
        sa.Numeric(14, 4, asdecimal=False), nullable=False
    )
    measured_weight_unit: Mapped[str] = enum_column(
        "measured_weight_unit", WEIGHT_UNITS, nullable=False
    )
    final_price_amount: Mapped[float] = mapped_column(
        sa.Numeric(14, 2, asdecimal=False), nullable=False
    )
    final_price_currency: Mapped[str] = mapped_column(sa.String(3), nullable=False)
    handed_off_at: Mapped[datetime] = mapped_column(nullable=False)
    server_received_at: Mapped[datetime] = mapped_column(nullable=False)
    evidence_ids: Mapped[list[str]] = mapped_column(nullable=False)
    outcome: Mapped[str] = enum_column("handoff_outcome", HANDOFF_OUTCOMES, nullable=False)
    flag_codes: Mapped[list[str]] = mapped_column(nullable=False)

    record: Mapped[RecoveryRecord] = relationship(back_populates="handoff", lazy="raise")


class ProcessingRecord(Timestamps, Base):
    """Processing information. Editable while `draft`; fixed once `submitted`."""

    __tablename__ = "processing_records"
    __table_args__ = (
        sa.CheckConstraint(
            "status = 'draft' OR (processing_method IS NOT NULL AND result IS NOT NULL "
            "AND processed_at IS NOT NULL AND submitted_at IS NOT NULL)",
            name="submitted_is_complete",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    recycler_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    recycler_programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    status: Mapped[str] = enum_column("processing_status", PROCESSING_STATUSES, nullable=False)
    processing_method: Mapped[str | None] = enum_column(
        "processing_method", PROCESSING_METHODS, nullable=True
    )
    result: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.String(1000), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    evidence_ids: Mapped[list[str]] = mapped_column(nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    version: Mapped[int] = mapped_column(nullable=False)

    # DeclarativeBase types this as an instance attribute, so ClassVar is not applicable.
    __mapper_args__ = {"version_id_col": version}  # noqa: RUF012

    record: Mapped[RecoveryRecord] = relationship(back_populates="processing", lazy="raise")
    material_entries: Mapped[list[RecoveredMaterialEntry]] = relationship(
        back_populates="processing_record",
        lazy="raise",
        order_by="(RecoveredMaterialEntry.position, RecoveredMaterialEntry.id)",
    )


class RecoveredMaterialEntry(Timestamps, Base):
    __tablename__ = "recovered_material_entries"
    __table_args__ = (
        sa.CheckConstraint("weight_value > 0", name="weight_positive"),
        sa.CheckConstraint("length(material) > 0", name="material_not_empty"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    processing_record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("processing_records.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    material: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    weight_value: Mapped[float] = mapped_column(sa.Numeric(14, 4, asdecimal=False), nullable=False)
    weight_unit: Mapped[str] = enum_column("material_weight_unit", WEIGHT_UNITS, nullable=False)
    position: Mapped[int] = mapped_column(nullable=False)

    processing_record: Mapped[ProcessingRecord] = relationship(
        back_populates="material_entries", lazy="raise"
    )


class ReviewCase(Timestamps, Base):
    """The review condition for one record: named flags, scope and current review state."""

    __tablename__ = "review_cases"
    __table_args__ = (
        sa.Index(
            "ix_review_cases_programme_id_status_opened_at", "programme_id", "status", "opened_at"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    programme_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=False
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    status: Mapped[str] = enum_column("review_case_status", REVIEW_CASE_STATUSES, nullable=False)
    flag_codes: Mapped[list[str]] = mapped_column(nullable=False)
    opened_at: Mapped[datetime] = mapped_column(nullable=False)
    opened_by_role: Mapped[str] = enum_column(
        "opened_by_role", TRANSITION_ACTOR_ROLES, nullable=False
    )
    opened_by_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    assigned_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    version: Mapped[int] = mapped_column(nullable=False)

    # DeclarativeBase types this as an instance attribute, so ClassVar is not applicable.
    __mapper_args__ = {"version_id_col": version}  # noqa: RUF012

    record: Mapped[RecoveryRecord] = relationship(back_populates="review_case", lazy="raise")
    decisions: Mapped[list[ReviewDecision]] = relationship(
        back_populates="review_case",
        lazy="raise",
        order_by="(ReviewDecision.recorded_at, ReviewDecision.id)",
    )


class ReviewDecision(Base):
    """An attributable reviewer decision. Append-only (triggers reject UPDATE and DELETE)."""

    __tablename__ = "review_decisions"
    __table_args__ = (
        sa.CheckConstraint(
            "decision <> 'request_correction' OR requested_correction IS NOT NULL",
            name="correction_request_has_details",
        ),
        sa.Index("ix_review_decisions_review_case_id_recorded_at", "review_case_id", "recorded_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)
    review_case_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("review_cases.id", ondelete="RESTRICT"), nullable=False
    )
    record_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recovery_records.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewer_programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    decision: Mapped[str] = enum_column("review_decision", REVIEW_DECISIONS, nullable=False)
    reason_code: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    reviewer_note: Mapped[str] = mapped_column(sa.String(1000), nullable=False)
    requested_correction: Mapped[str | None] = mapped_column(sa.String(1000), nullable=True)
    review_reason_codes: Mapped[list[str]] = mapped_column(nullable=False)
    evidence_considered: Mapped[list[str]] = mapped_column(nullable=False)
    decision_evidence_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("evidence.id", ondelete="RESTRICT"), nullable=False
    )
    decision_timestamp: Mapped[datetime] = mapped_column(nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    previous_review_state: Mapped[str] = enum_column(
        "previous_review_state", REVIEW_STATES, nullable=False
    )
    resulting_review_state: Mapped[str] = enum_column(
        "resulting_review_state", REVIEW_STATES, nullable=False
    )
    previous_record_state: Mapped[str] = enum_column(
        "previous_record_state", RECOVERY_RECORD_STATES, nullable=False
    )
    resulting_record_state: Mapped[str] = enum_column(
        "resulting_record_state", RECOVERY_RECORD_STATES, nullable=False
    )

    review_case: Mapped[ReviewCase] = relationship(back_populates="decisions", lazy="raise")
