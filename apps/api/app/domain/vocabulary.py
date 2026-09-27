"""Closed vocabularies from `packages/contracts`.

The values are copied, not invented: `tests/test_contract_parity.py` compares every tuple here
with the enums in the committed JSON Schemas (and, where a vocabulary is not exported as a
schema, with the TypeScript source) and fails on any difference.
"""

from __future__ import annotations

from typing import Final, Literal

CONTRACT_SCHEMA_VERSION: Final = "1.0.0"
EVENT_SCHEMA_VERSION: Final = "1.0.0"

UserRole = Literal[
    "collector",
    "recycler",
    "programme_reviewer",
    "programme_manager",
    "safety_content_administrator",
    "data_ml_reviewer",
]
USER_ROLES: Final[tuple[UserRole, ...]] = (
    "collector",
    "recycler",
    "programme_reviewer",
    "programme_manager",
    "safety_content_administrator",
    "data_ml_reviewer",
)
SYSTEM_ACTOR: Final = "system"
TRANSITION_ACTOR_ROLES: Final[tuple[str, ...]] = (*USER_ROLES, SYSTEM_ACTOR)

PERMISSIONS: Final[tuple[str, ...]] = (
    "recovery_record:create",
    "recovery_record:correct_own",
    "recovery_record:view_own",
    "recovery_record:view_operational",
    "handoff:record",
    "handoff:accept",
    "processing:record",
    "processing:complete",
    "review:flag",
    "review:evidence",
    "review:approve",
    "review:reject",
    "review:request_correction",
    "safety_content:manage",
    "model_correction:review",
    "model_performance:view",
    "programme_report:view",
    "programme_data:export",
    "personal_data:view",
)

RECOVERY_RECORD_STATES: Final[tuple[str, ...]] = (
    "draft",
    "submitted",
    "awaiting_handoff",
    "received",
    "processing_recorded",
    "completed",
    "under_review",
    "approved_and_completed",
    "rejected",
)
TERMINAL_RECOVERY_RECORD_STATES: Final[frozenset[str]] = frozenset(
    {"approved_and_completed", "rejected"}
)
HANDOFF_STATES: Final[tuple[str, ...]] = ("not_started", "awaiting", "received", "disputed")
PROCESSING_STATES: Final[tuple[str, ...]] = (
    "not_started",
    "in_progress",
    "evidence_recorded",
    "completed",
)
REVIEW_STATES: Final[tuple[str, ...]] = (
    "not_required",
    "open",
    "awaiting_information",
    "approved",
    "rejected",
)
SYNCHRONIZATION_STATES: Final[tuple[str, ...]] = (
    "offline",
    "pending_synchronization",
    "synchronizing",
    "synchronized",
    "action_required",
)

RECOVERY_RECORD_EVENT_TYPES: Final[tuple[str, ...]] = (
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

EWASTE_CATEGORIES: Final[tuple[str, ...]] = (
    "refrigerators",
    "laptops_and_desktop_computers",
    "televisions",
    "microwaves",
    "air_conditioners",
    "compressors",
    "mixed_scrap",
)
RECORD_KINDS: Final[tuple[str, ...]] = ("item", "batch")
ITEM_CONDITIONS: Final[tuple[str, ...]] = ("working", "repairable", "damaged", "unknown")
WEIGHT_UNITS: Final[tuple[str, ...]] = ("kg", "g")

EVIDENCE_TYPES: Final[tuple[str, ...]] = (
    "original_item_photo",
    "additional_item_photo",
    "handoff_qr_scan",
    "recycler_receipt",
    "handoff_photo",
    "weight_measurement",
    "processing_completion",
    "reviewer_decision",
)
CAPTURE_SOURCES: Final[tuple[str, ...]] = (
    "in_app_camera",
    "recycler_camera",
    "document_scanner",
    "approved_demo_fixture",
    "system_generated",
)
EVIDENCE_VALIDATION_STATUSES: Final[tuple[str, ...]] = (
    "pending",
    "accepted",
    "rejected",
    "quarantined",
)
CONNECTIVITY_STATES: Final[tuple[str, ...]] = ("offline", "online")

FACILITY_TYPES: Final[tuple[str, ...]] = ("scrapyard", "collection_centre", "recycler")
FACILITY_VERIFICATION_STATUSES: Final[tuple[str, ...]] = (
    "unverified",
    "programme_verified",
    "expired",
    "suspended",
)

PROCESSING_METHODS: Final[tuple[str, ...]] = (
    "reuse_referral",
    "repair_referral",
    "material_recovery",
    "safe_storage",
    "other_reviewed",
)
REVIEW_DECISIONS: Final[tuple[str, ...]] = ("approve", "reject", "request_correction")

ERROR_CODES: Final[tuple[str, ...]] = (
    "VALIDATION_FAILED",
    "AUTHENTICATION_REQUIRED",
    "PERMISSION_DENIED",
    "RESOURCE_NOT_FOUND",
    "INVALID_STATE_TRANSITION",
    "VERSION_CONFLICT",
    "DUPLICATE_RECORD",
    "IDEMPOTENCY_CONFLICT",
    "INTEGRITY_FAILURE",
    "UNSUPPORTED_CONTRACT_VERSION",
    "UNSUPPORTED_LANGUAGE",
    "MISSING_APPROVED_SAFETY_GUIDANCE",
    "RATE_LIMIT_REACHED",
    "DEPENDENCY_UNAVAILABLE",
    "INTERNAL_FAILURE",
)

SUPPORTED_LANGUAGES: Final[tuple[str, ...]] = ("en", "fr", "ar", "pt")

# Named review flags and reviewer reason codes. The contracts carry them as bounded strings;
# the stable values below are the ones the web application's domain layer
# (`apps/web/src/services/domain/flags.ts`) already produces and displays. They are reused
# verbatim rather than invented, and the gap is recorded in `docs/contract-gaps.md`.
REVIEW_FLAG_CODES: Final[tuple[str, ...]] = (
    "WEIGHT_DISCREPANCY",
    "CATEGORY_DISAGREEMENT",
    "DUPLICATE_EVIDENCE_DIGEST",
    "INCOMPLETE_EVIDENCE",
    "MISSING_MATERIAL_WEIGHTS",
    "PROCESSED_WEIGHT_ABOVE_RECEIVED",
)
MANUAL_REVIEW_REASON: Final = "MANUAL_REVIEW"
REASON_CODES_BY_DECISION: Final[dict[str, tuple[str, ...]]] = {
    "approve": ("EVIDENCE_SUFFICIENT", "WEIGHT_EXPLAINED"),
    "reject": ("EVIDENCE_INSUFFICIENT", "CATEGORY_INCORRECT", "WEIGHT_UNEXPLAINED"),
    "request_correction": ("ADDITIONAL_EVIDENCE_REQUIRED", "EVIDENCE_INSUFFICIENT"),
}

# Evidence a client may upload as a file. The remaining types (QR scan, recycler receipt and
# reviewer decision) are generated by the server inside the transaction that needs them.
CLIENT_UPLOADABLE_EVIDENCE_TYPES: Final[frozenset[str]] = frozenset(
    {
        "original_item_photo",
        "additional_item_photo",
        "handoff_photo",
        "weight_measurement",
        "processing_completion",
    }
)
