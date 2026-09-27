"""Initial persistence foundation.

Creates every Phase 1 table, the deferred recovery-record -> original-evidence foreign key, and
database triggers that make audit, lifecycle, decision and handoff history append-only and
evidence/recovery-record rows undeletable.

Revision ID: 0001
Revises:
Create Date: 2026-09-27 21:29:39.753414+00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON_DOCUMENT = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")

ORIGINAL_EVIDENCE_FK = "fk_recovery_records_original_image_evidence_id_evidence"
APPEND_ONLY_TABLES = ("audit_events", "recovery_record_events", "review_decisions", "handoffs")
UNDELETABLE_TABLES = ("evidence", "recovery_records")
POSTGRES_GUARD_FUNCTION = "scraptrace_reject_history_change"


def _install_history_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(
            f"""
            CREATE FUNCTION {POSTGRES_GUARD_FUNCTION}() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'scraptrace: % on % is not permitted; history is append-only',
                    TG_OP, TG_TABLE_NAME
                    USING ERRCODE = 'restrict_violation';
            END;
            $$
            """
        )
        for table in APPEND_ONLY_TABLES:
            op.execute(
                f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {table} "
                f"FOR EACH ROW EXECUTE FUNCTION {POSTGRES_GUARD_FUNCTION}()"
            )
        for table in UNDELETABLE_TABLES:
            op.execute(
                f"CREATE TRIGGER {table}_undeletable BEFORE DELETE ON {table} "
                f"FOR EACH ROW EXECUTE FUNCTION {POSTGRES_GUARD_FUNCTION}()"
            )
        return
    # SQLite test substitute: RAISE(ABORT) surfaces as a constraint (integrity) failure.
    for table in APPEND_ONLY_TABLES:
        for operation in ("UPDATE", "DELETE"):
            op.execute(
                f"CREATE TRIGGER {table}_no_{operation.lower()} BEFORE {operation} ON {table} "
                "BEGIN SELECT RAISE(ABORT, 'scraptrace: history is append-only'); END"
            )
    for table in UNDELETABLE_TABLES:
        op.execute(
            f"CREATE TRIGGER {table}_no_delete BEFORE DELETE ON {table} "
            "BEGIN SELECT RAISE(ABORT, 'scraptrace: history is append-only'); END"
        )


def _remove_history_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        for table in APPEND_ONLY_TABLES:
            op.execute(f"DROP TRIGGER IF EXISTS {table}_append_only ON {table}")
        for table in UNDELETABLE_TABLES:
            op.execute(f"DROP TRIGGER IF EXISTS {table}_undeletable ON {table}")
        op.execute(f"DROP FUNCTION IF EXISTS {POSTGRES_GUARD_FUNCTION}()")
        return
    for table in APPEND_ONLY_TABLES:
        for operation in ("update", "delete"):
            op.execute(f"DROP TRIGGER IF EXISTS {table}_no_{operation}")
    for table in UNDELETABLE_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS {table}_no_delete")


def upgrade() -> None:
    op.create_table(
        "programmes",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column(
            "weight_discrepancy_threshold_percentage",
            sa.Numeric(precision=5, scale=2, asdecimal=False),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "length(country_code) = 2", name=op.f("ck_programmes_country_code_length")
        ),
        sa.CheckConstraint("length(currency) = 3", name=op.f("ck_programmes_currency_length")),
        sa.CheckConstraint(
            "weight_discrepancy_threshold_percentage >= 1 AND weight_discrepancy_threshold_percentage <= 100",
            name=op.f("ck_programmes_threshold_range"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_programmes")),
    )
    op.create_table(
        "users",
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "preferred_language",
            sa.Enum(
                "en",
                "fr",
                "ar",
                "pt",
                name="preferred_language",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("session_version", sa.Integer(), nullable=False),
        sa.Column("last_signed_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "session_version >= 0", name=op.f("ck_users_session_version_nonnegative")
        ),
        sa.CheckConstraint("username = lower(username)", name=op.f("ck_users_username_lowercase")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
    )
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("operation", sa.String(length=120), nullable=False),
        sa.Column("resource_scope", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_digest", sa.String(length=71), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", JSON_DOCUMENT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("fk_idempotency_records_actor_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_idempotency_records")),
        sa.UniqueConstraint(
            "actor_id",
            "operation",
            "resource_scope",
            "idempotency_key",
            name=op.f("uq_idempotency_records_actor_id_operation_resource_scope_idempotency_key"),
        ),
    )
    op.create_index(
        op.f("ix_idempotency_records_expires_at"),
        "idempotency_records",
        ["expires_at"],
        unique=False,
    )
    op.create_table(
        "recycler_facilities",
        sa.Column("programme_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_recycler_facilities_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recycler_facilities")),
    )
    op.create_index(
        op.f("ix_recycler_facilities_programme_id"),
        "recycler_facilities",
        ["programme_id"],
        unique=False,
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column(
            "outcome",
            sa.Enum(
                "succeeded",
                "denied",
                "failed",
                name="audit_outcome",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column(
            "actor_role",
            sa.Enum(
                "collector",
                "recycler",
                "programme_reviewer",
                "programme_manager",
                "safety_content_administrator",
                "data_ml_reviewer",
                "system",
                name="audit_actor_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column("target_type", sa.String(length=60), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("programme_id", sa.Uuid(), nullable=True),
        sa.Column("facility_id", sa.Uuid(), nullable=True),
        sa.Column("correlation_id", sa.String(length=128), nullable=True),
        sa.Column("details", JSON_DOCUMENT, nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("fk_audit_events_actor_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_audit_events_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_audit_events_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_events")),
    )
    op.create_index(
        "ix_audit_events_actor_id_occurred_at",
        "audit_events",
        ["actor_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_events_occurred_at"), "audit_events", ["occurred_at"], unique=False
    )
    op.create_index(
        "ix_audit_events_target_type_target_id",
        "audit_events",
        ["target_type", "target_id"],
        unique=False,
    )
    op.create_table(
        "facility_locations",
        sa.Column("facility_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "facility_type",
            sa.Enum(
                "scrapyard",
                "collection_centre",
                "recycler",
                name="facility_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "verification_status",
            sa.Enum(
                "unverified",
                "programme_verified",
                "expired",
                "suspended",
                name="verification_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("verification_date", sa.Date(), nullable=True),
        sa.Column("accepted_categories", JSON_DOCUMENT, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_facility_locations_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_facility_locations")),
    )
    op.create_index(
        op.f("ix_facility_locations_facility_id"),
        "facility_locations",
        ["facility_id"],
        unique=False,
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "collector",
                "recycler",
                "programme_reviewer",
                "programme_manager",
                "safety_content_administrator",
                "data_ml_reviewer",
                name="user_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("programme_id", sa.Uuid(), nullable=True),
        sa.Column("facility_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "role <> 'recycler' OR facility_id IS NOT NULL",
            name=op.f("ck_user_roles_recycler_requires_facility"),
        ),
        sa.CheckConstraint(
            "role IN ('safety_content_administrator', 'data_ml_reviewer') OR programme_id IS NOT NULL",
            name=op.f("ck_user_roles_programme_scope_required"),
        ),
        sa.ForeignKeyConstraint(
            ["facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_user_roles_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_user_roles_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_roles_user_id_users"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_roles")),
        sa.UniqueConstraint(
            "user_id",
            "role",
            "programme_id",
            "facility_id",
            name=op.f("uq_user_roles_user_id_role_programme_id_facility_id"),
        ),
    )
    op.create_index(op.f("ix_user_roles_user_id"), "user_roles", ["user_id"], unique=False)
    op.create_table(
        "recovery_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("human_reference", sa.String(length=20), nullable=False),
        sa.Column("programme_id", sa.Uuid(), nullable=False),
        sa.Column("collector_id", sa.Uuid(), nullable=False),
        sa.Column(
            "record_kind",
            sa.Enum("item", "batch", name="record_kind", native_enum=False, create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.Enum(
                "refrigerators",
                "laptops_and_desktop_computers",
                "televisions",
                "microwaves",
                "air_conditioners",
                "compressors",
                "mixed_scrap",
                name="ewaste_category",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("item_count", sa.Integer(), nullable=True),
        sa.Column(
            "approximate_weight_value",
            sa.Numeric(precision=14, scale=4, asdecimal=False),
            nullable=True,
        ),
        sa.Column(
            "approximate_weight_unit",
            sa.Enum(
                "kg", "g", name="approximate_weight_unit", native_enum=False, create_constraint=True
            ),
            nullable=True,
        ),
        sa.Column(
            "condition",
            sa.Enum(
                "working",
                "repairable",
                "damaged",
                "unknown",
                name="item_condition",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("capture_location", JSON_DOCUMENT, nullable=True),
        sa.Column("approximate_area", JSON_DOCUMENT, nullable=False),
        sa.Column("vision_result", JSON_DOCUMENT, nullable=True),
        sa.Column("category_confirmation", JSON_DOCUMENT, nullable=False),
        sa.Column("estimated_price", JSON_DOCUMENT, nullable=True),
        sa.Column("safety_guide", JSON_DOCUMENT, nullable=True),
        sa.Column("destination", JSON_DOCUMENT, nullable=True),
        sa.Column("destination_location_id", sa.Uuid(), nullable=True),
        sa.Column("original_image_evidence_id", sa.Uuid(), nullable=True),
        sa.Column(
            "business_state",
            sa.Enum(
                "draft",
                "submitted",
                "awaiting_handoff",
                "received",
                "processing_recorded",
                "completed",
                "under_review",
                "approved_and_completed",
                "rejected",
                name="business_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "handoff_state",
            sa.Enum(
                "not_started",
                "awaiting",
                "received",
                "disputed",
                name="handoff_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "processing_state",
            sa.Enum(
                "not_started",
                "in_progress",
                "evidence_recorded",
                "completed",
                name="processing_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("device_instance_id", sa.Uuid(), nullable=False),
        sa.Column("integrity_digest", sa.String(length=71), nullable=True),
        sa.Column("previous_integrity_digest", sa.String(length=71), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "category <> 'mixed_scrap' OR (record_kind = 'batch' AND approximate_weight_value IS NOT NULL)",
            name=op.f("ck_recovery_records_mixed_scrap_is_weighed_batch"),
        ),
        sa.CheckConstraint(
            "(approximate_weight_value IS NULL) = (approximate_weight_unit IS NULL)",
            name=op.f("ck_recovery_records_approximate_weight_has_unit"),
        ),
        sa.CheckConstraint(
            "approximate_weight_value IS NULL OR approximate_weight_value > 0",
            name=op.f("ck_recovery_records_approximate_weight_positive"),
        ),
        sa.CheckConstraint(
            "item_count IS NULL OR item_count > 0",
            name=op.f("ck_recovery_records_item_count_positive"),
        ),
        sa.ForeignKeyConstraint(
            ["collector_id"],
            ["users.id"],
            name=op.f("fk_recovery_records_collector_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["destination_location_id"],
            ["facility_locations.id"],
            name=op.f("fk_recovery_records_destination_location_id_facility_locations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_recovery_records_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recovery_records")),
        sa.UniqueConstraint("human_reference", name=op.f("uq_recovery_records_human_reference")),
        sa.UniqueConstraint(
            "original_image_evidence_id",
            name=op.f("uq_recovery_records_original_image_evidence_id"),
        ),
    )
    op.create_index(
        "ix_recovery_records_business_state_updated_at",
        "recovery_records",
        ["business_state", "updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_recovery_records_collector_id_created_at",
        "recovery_records",
        ["collector_id", "created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_recovery_records_destination_location_id"),
        "recovery_records",
        ["destination_location_id"],
        unique=False,
    )
    op.create_index(
        "ix_recovery_records_programme_id_business_state",
        "recovery_records",
        ["programme_id", "business_state"],
        unique=False,
    )
    op.create_table(
        "evidence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column(
            "evidence_type",
            sa.Enum(
                "original_item_photo",
                "additional_item_photo",
                "handoff_qr_scan",
                "recycler_receipt",
                "handoff_photo",
                "weight_measurement",
                "processing_completion",
                "reviewer_decision",
                name="evidence_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("storage_provider", sa.String(length=80), nullable=False),
        sa.Column("object_key", sa.String(length=1024), nullable=False),
        sa.Column("object_version", sa.String(length=200), nullable=True),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("content_digest", sa.String(length=71), nullable=False),
        sa.Column("image_width", sa.Integer(), nullable=True),
        sa.Column("image_height", sa.Integer(), nullable=True),
        sa.Column("metadata_stripped", sa.Boolean(), nullable=False),
        sa.Column(
            "capture_source",
            sa.Enum(
                "in_app_camera",
                "recycler_camera",
                "document_scanner",
                "approved_demo_fixture",
                "system_generated",
                name="capture_source",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("captured_by_id", sa.Uuid(), nullable=False),
        sa.Column("captured_by_programme_id", sa.Uuid(), nullable=True),
        sa.Column("captured_by_facility_id", sa.Uuid(), nullable=True),
        sa.Column("device_instance_id", sa.Uuid(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("server_received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("coordinates", JSON_DOCUMENT, nullable=True),
        sa.Column("application_version", sa.String(length=64), nullable=False),
        sa.Column(
            "connectivity",
            sa.Enum(
                "offline", "online", name="connectivity", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column("ai_observation", JSON_DOCUMENT, nullable=True),
        sa.Column("human_correction", JSON_DOCUMENT, nullable=True),
        sa.Column(
            "validation_status",
            sa.Enum(
                "pending",
                "accepted",
                "rejected",
                "quarantined",
                name="validation_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("file_size_bytes > 0", name=op.f("ck_evidence_file_size_positive")),
        sa.ForeignKeyConstraint(
            ["captured_by_facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_evidence_captured_by_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["captured_by_id"],
            ["users.id"],
            name=op.f("fk_evidence_captured_by_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["captured_by_programme_id"],
            ["programmes.id"],
            name=op.f("fk_evidence_captured_by_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_evidence_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence")),
        sa.UniqueConstraint("object_key", name=op.f("uq_evidence_object_key")),
    )
    op.create_index(
        op.f("ix_evidence_content_digest"), "evidence", ["content_digest"], unique=False
    )
    op.create_index(
        "ix_evidence_record_id_evidence_type",
        "evidence",
        ["record_id", "evidence_type"],
        unique=False,
    )
    op.create_table(
        "handoffs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column("recycler_id", sa.Uuid(), nullable=False),
        sa.Column("recycler_programme_id", sa.Uuid(), nullable=True),
        sa.Column("recycler_facility_id", sa.Uuid(), nullable=False),
        sa.Column("collector_id", sa.Uuid(), nullable=False),
        sa.Column("receiving_location_id", sa.Uuid(), nullable=False),
        sa.Column(
            "confirmed_category",
            sa.Enum(
                "refrigerators",
                "laptops_and_desktop_computers",
                "televisions",
                "microwaves",
                "air_conditioners",
                "compressors",
                "mixed_scrap",
                name="handoff_confirmed_category",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "confirmed_condition",
            sa.Enum(
                "working",
                "repairable",
                "damaged",
                "unknown",
                name="handoff_confirmed_condition",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "measured_weight_value",
            sa.Numeric(precision=14, scale=4, asdecimal=False),
            nullable=False,
        ),
        sa.Column(
            "measured_weight_unit",
            sa.Enum(
                "kg", "g", name="measured_weight_unit", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column(
            "final_price_amount", sa.Numeric(precision=14, scale=2, asdecimal=False), nullable=False
        ),
        sa.Column("final_price_currency", sa.String(length=3), nullable=False),
        sa.Column("handed_off_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("server_received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evidence_ids", JSON_DOCUMENT, nullable=False),
        sa.Column(
            "outcome",
            sa.Enum(
                "accepted",
                "discrepancy",
                name="handoff_outcome",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("flag_codes", JSON_DOCUMENT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "final_price_amount >= 0", name=op.f("ck_handoffs_final_price_nonnegative")
        ),
        sa.CheckConstraint(
            "length(final_price_currency) = 3", name=op.f("ck_handoffs_currency_length")
        ),
        sa.CheckConstraint(
            "measured_weight_value > 0", name=op.f("ck_handoffs_measured_weight_positive")
        ),
        sa.ForeignKeyConstraint(
            ["collector_id"],
            ["users.id"],
            name=op.f("fk_handoffs_collector_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["receiving_location_id"],
            ["facility_locations.id"],
            name=op.f("fk_handoffs_receiving_location_id_facility_locations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_handoffs_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recycler_facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_handoffs_recycler_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recycler_id"],
            ["users.id"],
            name=op.f("fk_handoffs_recycler_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recycler_programme_id"],
            ["programmes.id"],
            name=op.f("fk_handoffs_recycler_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_handoffs")),
        sa.UniqueConstraint("record_id", name=op.f("uq_handoffs_record_id")),
    )
    op.create_index(
        op.f("ix_handoffs_receiving_location_id"),
        "handoffs",
        ["receiving_location_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_handoffs_recycler_facility_id"), "handoffs", ["recycler_facility_id"], unique=False
    )
    op.create_table(
        "processing_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column("facility_id", sa.Uuid(), nullable=False),
        sa.Column("recycler_id", sa.Uuid(), nullable=False),
        sa.Column("recycler_programme_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "submitted",
                name="processing_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "processing_method",
            sa.Enum(
                "reuse_referral",
                "repair_referral",
                "material_recovery",
                "safe_storage",
                "other_reviewed",
                name="processing_method",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=True,
        ),
        sa.Column("result", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence_ids", JSON_DOCUMENT, nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status = 'draft' OR (processing_method IS NOT NULL AND result IS NOT NULL AND processed_at IS NOT NULL AND submitted_at IS NOT NULL)",
            name=op.f("ck_processing_records_submitted_is_complete"),
        ),
        sa.ForeignKeyConstraint(
            ["facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_processing_records_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_processing_records_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recycler_id"],
            ["users.id"],
            name=op.f("fk_processing_records_recycler_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recycler_programme_id"],
            ["programmes.id"],
            name=op.f("fk_processing_records_recycler_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_processing_records")),
        sa.UniqueConstraint("record_id", name=op.f("uq_processing_records_record_id")),
    )
    op.create_index(
        op.f("ix_processing_records_facility_id"),
        "processing_records",
        ["facility_id"],
        unique=False,
    )
    op.create_table(
        "qr_lookup_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("nonce", sa.LargeBinary(length=16), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_qr_lookup_tokens_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_qr_lookup_tokens")),
        sa.UniqueConstraint("token_digest", name=op.f("uq_qr_lookup_tokens_token_digest")),
    )
    op.create_index(
        op.f("ix_qr_lookup_tokens_record_id"), "qr_lookup_tokens", ["record_id"], unique=False
    )
    op.create_index(
        "uq_qr_lookup_tokens_record_id_active",
        "qr_lookup_tokens",
        ["record_id"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
        sqlite_where=sa.text("revoked_at IS NULL"),
    )
    op.create_table(
        "recovery_record_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column("event_schema_version", sa.String(length=20), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
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
                name="event_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_programme_id", sa.Uuid(), nullable=True),
        sa.Column("actor_facility_id", sa.Uuid(), nullable=True),
        sa.Column(
            "actor_role",
            sa.Enum(
                "collector",
                "recycler",
                "programme_reviewer",
                "programme_manager",
                "safety_content_administrator",
                "data_ml_reviewer",
                "system",
                name="event_actor_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "previous_state",
            sa.Enum(
                "draft",
                "submitted",
                "awaiting_handoff",
                "received",
                "processing_recorded",
                "completed",
                "under_review",
                "approved_and_completed",
                "rejected",
                name="event_previous_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "resulting_state",
            sa.Enum(
                "draft",
                "submitted",
                "awaiting_handoff",
                "received",
                "processing_recorded",
                "completed",
                "under_review",
                "approved_and_completed",
                "rejected",
                name="event_resulting_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=1000), nullable=True),
        sa.Column("correlation_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "actor_role = 'system' OR actor_id IS NOT NULL",
            name=op.f("ck_recovery_record_events_user_event_has_actor"),
        ),
        sa.ForeignKeyConstraint(
            ["actor_facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_recovery_record_events_actor_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("fk_recovery_record_events_actor_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["actor_programme_id"],
            ["programmes.id"],
            name=op.f("fk_recovery_record_events_actor_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_recovery_record_events_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recovery_record_events")),
    )
    op.create_index(
        "ix_recovery_record_events_record_id_occurred_at",
        "recovery_record_events",
        ["record_id", "occurred_at"],
        unique=False,
    )
    op.create_table(
        "review_cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column("programme_id", sa.Uuid(), nullable=False),
        sa.Column("facility_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "open",
                "awaiting_information",
                "approved",
                "rejected",
                name="review_case_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("flag_codes", JSON_DOCUMENT, nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "opened_by_role",
            sa.Enum(
                "collector",
                "recycler",
                "programme_reviewer",
                "programme_manager",
                "safety_content_administrator",
                "data_ml_reviewer",
                "system",
                name="opened_by_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("opened_by_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_reviewer_id", sa.Uuid(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["assigned_reviewer_id"],
            ["users.id"],
            name=op.f("fk_review_cases_assigned_reviewer_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["facility_id"],
            ["recycler_facilities.id"],
            name=op.f("fk_review_cases_facility_id_recycler_facilities"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["opened_by_id"],
            ["users.id"],
            name=op.f("fk_review_cases_opened_by_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
            name=op.f("fk_review_cases_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_review_cases_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_review_cases")),
        sa.UniqueConstraint("record_id", name=op.f("uq_review_cases_record_id")),
    )
    op.create_index(
        op.f("ix_review_cases_assigned_reviewer_id"),
        "review_cases",
        ["assigned_reviewer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_review_cases_facility_id"), "review_cases", ["facility_id"], unique=False
    )
    op.create_index(
        "ix_review_cases_programme_id_status_opened_at",
        "review_cases",
        ["programme_id", "status", "opened_at"],
        unique=False,
    )
    op.create_table(
        "recovered_material_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("processing_record_id", sa.Uuid(), nullable=False),
        sa.Column("material", sa.String(length=120), nullable=False),
        sa.Column(
            "weight_value", sa.Numeric(precision=14, scale=4, asdecimal=False), nullable=False
        ),
        sa.Column(
            "weight_unit",
            sa.Enum(
                "kg", "g", name="material_weight_unit", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "length(material) > 0", name=op.f("ck_recovered_material_entries_material_not_empty")
        ),
        sa.CheckConstraint(
            "weight_value > 0", name=op.f("ck_recovered_material_entries_weight_positive")
        ),
        sa.ForeignKeyConstraint(
            ["processing_record_id"],
            ["processing_records.id"],
            name=op.f("fk_recovered_material_entries_processing_record_id_processing_records"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recovered_material_entries")),
    )
    op.create_index(
        op.f("ix_recovered_material_entries_processing_record_id"),
        "recovered_material_entries",
        ["processing_record_id"],
        unique=False,
    )
    op.create_table(
        "review_decisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("review_case_id", sa.Uuid(), nullable=False),
        sa.Column("record_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_programme_id", sa.Uuid(), nullable=True),
        sa.Column(
            "decision",
            sa.Enum(
                "approve",
                "reject",
                "request_correction",
                name="review_decision",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("reason_code", sa.String(length=80), nullable=False),
        sa.Column("reviewer_note", sa.String(length=1000), nullable=False),
        sa.Column("requested_correction", sa.String(length=1000), nullable=True),
        sa.Column("review_reason_codes", JSON_DOCUMENT, nullable=False),
        sa.Column("evidence_considered", JSON_DOCUMENT, nullable=False),
        sa.Column("decision_evidence_id", sa.Uuid(), nullable=False),
        sa.Column("decision_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "previous_review_state",
            sa.Enum(
                "not_required",
                "open",
                "awaiting_information",
                "approved",
                "rejected",
                name="previous_review_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "resulting_review_state",
            sa.Enum(
                "not_required",
                "open",
                "awaiting_information",
                "approved",
                "rejected",
                name="resulting_review_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "previous_record_state",
            sa.Enum(
                "draft",
                "submitted",
                "awaiting_handoff",
                "received",
                "processing_recorded",
                "completed",
                "under_review",
                "approved_and_completed",
                "rejected",
                name="previous_record_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "resulting_record_state",
            sa.Enum(
                "draft",
                "submitted",
                "awaiting_handoff",
                "received",
                "processing_recorded",
                "completed",
                "under_review",
                "approved_and_completed",
                "rejected",
                name="resulting_record_state",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.CheckConstraint(
            "decision <> 'request_correction' OR requested_correction IS NOT NULL",
            name=op.f("ck_review_decisions_correction_request_has_details"),
        ),
        sa.ForeignKeyConstraint(
            ["decision_evidence_id"],
            ["evidence.id"],
            name=op.f("fk_review_decisions_decision_evidence_id_evidence"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["record_id"],
            ["recovery_records.id"],
            name=op.f("fk_review_decisions_record_id_recovery_records"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["review_case_id"],
            ["review_cases.id"],
            name=op.f("fk_review_decisions_review_case_id_review_cases"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["users.id"],
            name=op.f("fk_review_decisions_reviewer_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_programme_id"],
            ["programmes.id"],
            name=op.f("fk_review_decisions_reviewer_programme_id_programmes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_review_decisions")),
    )
    op.create_index(
        op.f("ix_review_decisions_record_id"), "review_decisions", ["record_id"], unique=False
    )
    op.create_index(
        "ix_review_decisions_review_case_id_recorded_at",
        "review_decisions",
        ["review_case_id", "recorded_at"],
        unique=False,
    )
    # The record -> original-evidence reference closes a cycle, so it is added once both
    # tables exist. Batch mode keeps this portable to the SQLite test substitute.
    with op.batch_alter_table("recovery_records") as batch:
        batch.create_foreign_key(
            ORIGINAL_EVIDENCE_FK,
            "evidence",
            ["original_image_evidence_id"],
            ["id"],
            ondelete="RESTRICT",
        )
    _install_history_guards()


def downgrade() -> None:
    _remove_history_guards()
    with op.batch_alter_table("recovery_records") as batch:
        batch.drop_constraint(ORIGINAL_EVIDENCE_FK, type_="foreignkey")
    op.drop_index("ix_review_decisions_review_case_id_recorded_at", table_name="review_decisions")
    op.drop_index(op.f("ix_review_decisions_record_id"), table_name="review_decisions")
    op.drop_table("review_decisions")
    op.drop_index(
        op.f("ix_recovered_material_entries_processing_record_id"),
        table_name="recovered_material_entries",
    )
    op.drop_table("recovered_material_entries")
    op.drop_index("ix_review_cases_programme_id_status_opened_at", table_name="review_cases")
    op.drop_index(op.f("ix_review_cases_facility_id"), table_name="review_cases")
    op.drop_index(op.f("ix_review_cases_assigned_reviewer_id"), table_name="review_cases")
    op.drop_table("review_cases")
    op.drop_index(
        "ix_recovery_record_events_record_id_occurred_at", table_name="recovery_record_events"
    )
    op.drop_table("recovery_record_events")
    op.drop_index(
        "uq_qr_lookup_tokens_record_id_active",
        table_name="qr_lookup_tokens",
        postgresql_where=sa.text("revoked_at IS NULL"),
        sqlite_where=sa.text("revoked_at IS NULL"),
    )
    op.drop_index(op.f("ix_qr_lookup_tokens_record_id"), table_name="qr_lookup_tokens")
    op.drop_table("qr_lookup_tokens")
    op.drop_index(op.f("ix_processing_records_facility_id"), table_name="processing_records")
    op.drop_table("processing_records")
    op.drop_index(op.f("ix_handoffs_recycler_facility_id"), table_name="handoffs")
    op.drop_index(op.f("ix_handoffs_receiving_location_id"), table_name="handoffs")
    op.drop_table("handoffs")
    op.drop_index("ix_evidence_record_id_evidence_type", table_name="evidence")
    op.drop_index(op.f("ix_evidence_content_digest"), table_name="evidence")
    op.drop_table("evidence")
    op.drop_index("ix_recovery_records_programme_id_business_state", table_name="recovery_records")
    op.drop_index(
        op.f("ix_recovery_records_destination_location_id"), table_name="recovery_records"
    )
    op.drop_index("ix_recovery_records_collector_id_created_at", table_name="recovery_records")
    op.drop_index("ix_recovery_records_business_state_updated_at", table_name="recovery_records")
    op.drop_table("recovery_records")
    op.drop_index(op.f("ix_user_roles_user_id"), table_name="user_roles")
    op.drop_table("user_roles")
    op.drop_index(op.f("ix_facility_locations_facility_id"), table_name="facility_locations")
    op.drop_table("facility_locations")
    op.drop_index("ix_audit_events_target_type_target_id", table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_occurred_at"), table_name="audit_events")
    op.drop_index("ix_audit_events_actor_id_occurred_at", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index(op.f("ix_recycler_facilities_programme_id"), table_name="recycler_facilities")
    op.drop_table("recycler_facilities")
    op.drop_index(op.f("ix_idempotency_records_expires_at"), table_name="idempotency_records")
    op.drop_table("idempotency_records")
    op.drop_table("users")
    op.drop_table("programmes")
