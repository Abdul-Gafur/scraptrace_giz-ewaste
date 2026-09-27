"""Transport schemas composed from contract subschemas.

`packages/contracts` defines the `RecoveryRecord` aggregate but no request for creating or
editing a draft (see `docs/contract-gaps.md`). These documents are therefore assembled from the
contract's own field definitions, so every field keeps its exact contract constraints. They are
loaded once from the committed schemas and serve both request validation and OpenAPI.
"""

from __future__ import annotations

from typing import Any

from apps.api.app.contracts.validation import ContractRegistry, field_issues
from apps.api.app.core.config import CONTRACT_SCHEMA_DIRECTORY
from apps.api.app.core.errors import ApiError
from jsonschema import Draft202012Validator

REGISTRY = ContractRegistry(CONTRACT_SCHEMA_DIRECTORY)


def _record(field: str) -> dict[str, Any]:
    return REGISTRY.resolved("recovery_record", "properties", field)


def _provenance(field: str) -> dict[str, Any]:
    return REGISTRY.resolved("evidence", "properties", "provenance", "properties", field)


def _nullable(schema: dict[str, Any]) -> dict[str, Any]:
    return {"anyOf": [schema, {"type": "null"}]}


LOCATION_ID = REGISTRY.resolved(
    "recovery_record", "properties", "destination", "properties", "location_id"
)
UUID_V7 = _record("record_id")

ORIGINAL_IMAGE_PROVENANCE: dict[str, Any] = {
    "type": "object",
    "description": "Provenance of the original item photograph uploaded in the same request.",
    "properties": {
        "evidence_id": REGISTRY.resolved("evidence", "properties", "evidence_id"),
        "captured_at": _provenance("captured_at"),
        "capture_source": {
            **_provenance("capture_source"),
            "enum": ["in_app_camera", "approved_demo_fixture"],
        },
        "connectivity": _provenance("connectivity"),
        "application_version": _provenance("application_version"),
    },
    "required": ["captured_at", "capture_source", "connectivity", "application_version"],
    "additionalProperties": False,
}

DRAFT_CREATE_SCHEMA: dict[str, Any] = {
    "title": "RecoveryRecordDraftCreate",
    "type": "object",
    "properties": {
        "record_id": {
            **UUID_V7,
            "description": "Optional client-generated UUIDv7 for offline-created records.",
        },
        "device_instance_id": _provenance("device_instance_id"),
        "record_kind": _record("record_kind"),
        "category": _record("category"),
        "condition": _record("condition"),
        "item_count": _record("item_count"),
        "approximate_weight": _record("approximate_weight"),
        "captured_at": _record("captured_at"),
        "capture_location": _record("capture_location"),
        "approximate_area": _record("approximate_area"),
        "vision_result": _record("vision_result"),
        "category_confirmation": _record("category_confirmation"),
        "estimated_price": _record("estimated_price"),
        "safety_guide": _record("safety_guide"),
        "destination_location_id": LOCATION_ID,
        "original_image": ORIGINAL_IMAGE_PROVENANCE,
    },
    "required": [
        "device_instance_id",
        "category",
        "condition",
        "captured_at",
        "approximate_area",
        "category_confirmation",
        "original_image",
    ],
    "additionalProperties": False,
}

DRAFT_UPDATE_SCHEMA: dict[str, Any] = {
    "title": "RecoveryRecordDraftUpdate",
    "description": (
        "Partial update of an editable draft. `null` clears an optional field. An existing "
        "vision result cannot be replaced: the original prediction is never overwritten."
    ),
    "type": "object",
    "properties": {
        "record_kind": _record("record_kind"),
        "category": _record("category"),
        "condition": _record("condition"),
        "item_count": _nullable(_record("item_count")),
        "approximate_weight": _nullable(_record("approximate_weight")),
        "captured_at": _record("captured_at"),
        "capture_location": _nullable(_record("capture_location")),
        "approximate_area": _record("approximate_area"),
        "vision_result": _record("vision_result"),
        "category_confirmation": _record("category_confirmation"),
        "estimated_price": _nullable(_record("estimated_price")),
        "safety_guide": _nullable(_record("safety_guide")),
        "destination_location_id": _nullable(LOCATION_ID),
    },
    "minProperties": 1,
    "additionalProperties": False,
}

# `VisionHumanCorrectionSchema = CategoryConfirmationSchema` in the vision contract.
CATEGORY_CONFIRMATION_SCHEMA: dict[str, Any] = {
    "title": "CategoryConfirmation",
    **_record("category_confirmation"),
}

UPLOADABLE_EVIDENCE_TYPES = [
    "additional_item_photo",
    "handoff_photo",
    "weight_measurement",
    "processing_completion",
]

# Multipart text fields accompanying an evidence file, taken from the Evidence contract.
EVIDENCE_UPLOAD_FIELDS_SCHEMA: dict[str, Any] = {
    "title": "EvidenceUploadFields",
    "type": "object",
    "properties": {
        "evidence_type": {
            **REGISTRY.resolved("evidence", "properties", "evidence_type"),
            "enum": UPLOADABLE_EVIDENCE_TYPES,
        },
        "evidence_id": {
            **REGISTRY.resolved("evidence", "properties", "evidence_id"),
            "description": "Optional client-generated UUIDv7; makes the upload retry-safe.",
        },
        "captured_at": _provenance("captured_at"),
        "capture_source": _provenance("capture_source"),
        "device_instance_id": _provenance("device_instance_id"),
        "connectivity": _provenance("connectivity"),
        "application_version": _provenance("application_version"),
    },
    "required": [
        "evidence_type",
        "captured_at",
        "capture_source",
        "device_instance_id",
        "connectivity",
        "application_version",
    ],
    "additionalProperties": False,
}

_QR = REGISTRY.resolved("qr_payload")

# Exactly one presentation form. The QR payload's version is checked by the service (not by
# `const` here) so an unsupported version returns `UNSUPPORTED_CONTRACT_VERSION`.
HANDOFF_LOOKUP_SCHEMA: dict[str, Any] = {
    "title": "HandoffLookupRequest",
    "type": "object",
    "properties": {
        "qr_payload": {
            "type": "object",
            "description": "The decoded `QrPayload` object.",
            "properties": {
                "contract_version": {"type": "string", "maxLength": 32},
                "record_id": _QR["properties"]["record_id"],
                "lookup_token": _QR["properties"]["lookup_token"],
            },
            "required": ["contract_version", "record_id", "lookup_token"],
            "additionalProperties": False,
        },
        "qr_text": {
            "type": "string",
            "maxLength": 400,
            "description": "QR symbol text: SCRAPTRACE:<contract version>:<record id>:<token>.",
        },
        "lookup_token": _QR["properties"]["lookup_token"],
        "transfer_code": {
            "type": "string",
            "maxLength": 40,
            "description": "The human reference (ST-...) typed instead of scanning.",
        },
    },
    "minProperties": 1,
    "maxProperties": 1,
    "additionalProperties": False,
}

HANDOFF_PREVIEW_SCHEMA: dict[str, Any] = {
    "title": "HandoffPreview",
    "type": "object",
    "description": "The minimised view a recycler receives before accepting a handoff.",
    "properties": {
        "record_id": _record("record_id"),
        "human_reference": _record("human_reference"),
        "record_kind": _record("record_kind"),
        "category": _record("category"),
        "item_count": _record("item_count"),
        "approximate_weight": _record("approximate_weight"),
        "condition": _record("condition"),
        "approximate_area": _record("approximate_area"),
        "captured_at": _record("captured_at"),
        "collector": _record("collector"),
        "original_image_evidence_id": _record("original_image_evidence_id"),
        "destination": _record("destination"),
        "business_state": _record("business_state"),
        "handoff_state": _record("handoff_state"),
    },
    "required": [
        "record_id",
        "human_reference",
        "record_kind",
        "category",
        "condition",
        "approximate_area",
        "captured_at",
        "collector",
        "original_image_evidence_id",
        "business_state",
        "handoff_state",
    ],
    "additionalProperties": False,
}

HANDOFF_LOOKUP_RESPONSE_SCHEMA: dict[str, Any] = {
    "title": "HandoffLookupResult",
    "type": "object",
    "properties": {
        "outcome": {"enum": ["ready", "not_ready", "already_received", "other_facility"]},
        "record": HANDOFF_PREVIEW_SCHEMA,
        "received_at": _record("created_at"),
        "lookup_token": _QR["properties"]["lookup_token"],
    },
    "required": ["outcome"],
    "additionalProperties": False,
}

_VALIDATORS = {
    id(schema): Draft202012Validator(schema)
    for schema in (
        DRAFT_CREATE_SCHEMA,
        DRAFT_UPDATE_SCHEMA,
        CATEGORY_CONFIRMATION_SCHEMA,
        EVIDENCE_UPLOAD_FIELDS_SCHEMA,
        HANDOFF_LOOKUP_SCHEMA,
        HANDOFF_LOOKUP_RESPONSE_SCHEMA,
    )
}


def check_transport_response(schema: dict[str, Any], payload: Any) -> None:
    from apps.api.app.contracts.validation import ContractValidationError

    if any(True for _ in _VALIDATORS[id(schema)].iter_errors(payload)):
        raise ContractValidationError(f"Outgoing '{schema['title']}' failed validation.")


def validate_transport(schema: dict[str, Any], payload: Any, prefix: str = "") -> None:
    """Raises `VALIDATION_FAILED` (422) with allow-listed field issues."""
    issues = field_issues(_VALIDATORS[id(schema)].iter_errors(payload))
    if issues:
        if prefix:
            for issue in issues:
                issue["field"] = (
                    f"{prefix}.{issue['field']}" if issue["field"] != "body" else prefix
                )
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The request does not match the contract.",
            field_issues=issues,
        )


def validate_contract_request(name: str, payload: Any) -> None:
    issues = REGISTRY.request_issues(name, payload)
    if issues:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The request does not match the contract.",
            field_issues=issues,
        )
