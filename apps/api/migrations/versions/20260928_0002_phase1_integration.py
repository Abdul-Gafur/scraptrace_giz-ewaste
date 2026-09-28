"""Phase 1 integration: manual transfer codes, record fact events and aligned result length.

- `qr_lookup_tokens.transfer_code_digest`: keyed digest of the manual transfer code that is
  issued, rotated, expired and revoked together with the QR lookup token (ADR-009). Rows created
  before this revision receive their digest the next time the owner reads the credentials.
- `recovery_record_events`: the event vocabulary gains the persisted record fact events, plus
  the evidence they describe and the flags a review-opening event raised.
- `processing_records.result`: aligned with the 1,000-character processing notes it records.

Downgrading fails if any record fact event exists, because the history is append-only and the
earlier vocabulary cannot represent it.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-28 08:00:00.000000+00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON_DOCUMENT = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

LIFECYCLE_EVENTS = (
    "submit_record",
    "publish_for_handoff",
    "record_handoff",
    "record_processing",
    "mark_processing_complete",
    "flag_for_review",
    "approve_unflagged_completion",
    "approve_review",
    "request_correction",
    "reject_review",
)
FACT_EVENTS = (
    "draft_created",
    "evidence_added",
    "appraisal_recorded",
    "category_confirmed",
    "category_corrected",
    "qr_issued",
    "qr_rotated",
    "review_opened",
)
EVENT_CHECK = "ck_recovery_record_events_event_type"
EVENT_EVIDENCE_FK = "fk_recovery_record_events_evidence_id_evidence"
TRANSFER_CODE_INDEX = "uq_qr_lookup_tokens_transfer_code_digest"
EVENT_TABLE_TRIGGERS = ("update", "delete")


def _event_condition(values: Sequence[str]) -> str:
    return "event_type IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def _sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _drop_sqlite_event_guards() -> None:
    for operation in EVENT_TABLE_TRIGGERS:
        op.execute(f"DROP TRIGGER IF EXISTS recovery_record_events_no_{operation}")


def _create_sqlite_event_guards() -> None:
    # A batch rebuild replaces the table, so its append-only guards are installed again.
    for operation in EVENT_TABLE_TRIGGERS:
        op.execute(
            f"CREATE TRIGGER recovery_record_events_no_{operation} BEFORE {operation.upper()} "
            "ON recovery_record_events "
            "BEGIN SELECT RAISE(ABORT, 'scraptrace: history is append-only'); END"
        )


def _replace_event_check(values: Sequence[str]) -> None:
    if _sqlite():
        _drop_sqlite_event_guards()
        with op.batch_alter_table("recovery_record_events", recreate="always") as batch:
            batch.drop_constraint(op.f(EVENT_CHECK), type_="check")
            batch.create_check_constraint(op.f(EVENT_CHECK), _event_condition(values))
        _create_sqlite_event_guards()
        return
    op.drop_constraint(op.f(EVENT_CHECK), "recovery_record_events", type_="check")
    op.create_check_constraint(
        op.f(EVENT_CHECK), "recovery_record_events", _event_condition(values)
    )


def upgrade() -> None:
    with op.batch_alter_table("qr_lookup_tokens") as batch:
        batch.add_column(sa.Column("transfer_code_digest", sa.String(length=64), nullable=True))
    op.create_index(TRANSFER_CODE_INDEX, "qr_lookup_tokens", ["transfer_code_digest"], unique=True)

    with op.batch_alter_table("processing_records") as batch:
        batch.alter_column(
            "result",
            existing_type=sa.String(length=500),
            type_=sa.String(length=1000),
            existing_nullable=True,
        )

    if _sqlite():
        _drop_sqlite_event_guards()
    with op.batch_alter_table("recovery_record_events") as batch:
        batch.add_column(sa.Column("evidence_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("flag_codes", JSON_DOCUMENT, nullable=True))
        batch.create_foreign_key(
            op.f(EVENT_EVIDENCE_FK), "evidence", ["evidence_id"], ["id"], ondelete="RESTRICT"
        )
    if _sqlite():
        _create_sqlite_event_guards()
    _replace_event_check((*LIFECYCLE_EVENTS, *FACT_EVENTS))


def downgrade() -> None:
    _replace_event_check(LIFECYCLE_EVENTS)
    if _sqlite():
        _drop_sqlite_event_guards()
    with op.batch_alter_table("recovery_record_events") as batch:
        batch.drop_constraint(op.f(EVENT_EVIDENCE_FK), type_="foreignkey")
        batch.drop_column("flag_codes")
        batch.drop_column("evidence_id")
    if _sqlite():
        _create_sqlite_event_guards()

    op.execute("UPDATE processing_records SET result = substr(result, 1, 500)")
    with op.batch_alter_table("processing_records") as batch:
        batch.alter_column(
            "result",
            existing_type=sa.String(length=1000),
            type_=sa.String(length=500),
            existing_nullable=True,
        )

    op.drop_index(TRANSFER_CODE_INDEX, table_name="qr_lookup_tokens")
    with op.batch_alter_table("qr_lookup_tokens") as batch:
        batch.drop_column("transfer_code_digest")
