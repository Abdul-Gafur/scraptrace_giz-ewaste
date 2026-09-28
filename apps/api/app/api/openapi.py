"""OpenAPI generation from the committed contract schemas.

Contract JSON Schemas are installed verbatim as OpenAPI 3.1 components. Their `$id` and
`$schema` keys are removed and internal `#/$defs/...` references are rewritten to point inside
the component, so the published document resolves without fetching remote schemas. Routes then
reference contract types instead of re-describing them.
"""

from __future__ import annotations

import copy
from typing import Any

from apps.api.app.contracts.validation import ContractRegistry
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

COMPONENT_NAMES = {
    "error_envelope": "ErrorEnvelope",
    "evidence": "Evidence",
    "handoff_request": "HandoffRequest",
    "handoff_response": "HandoffResponse",
    "processing_request": "ProcessingRequest",
    "processing_response": "ProcessingResponse",
    "programme_review_request": "ProgrammeReviewRequest",
    "programme_review_response": "ProgrammeReviewResponse",
    "qr_payload": "QrPayload",
    "recovery_record": "RecoveryRecord",
    "recovery_record_event": "RecoveryRecordEvent",
    "vision_appraisal_response": "VisionAppraisalResponse",
}

ERROR_DESCRIPTIONS = {
    400: "Malformed request",
    401: "Authentication required, or the session is invalid, expired or revoked",
    403: "The role may not perform this action",
    404: "Not found, or concealed because it is outside the caller's scope",
    409: "State, version, duplicate or idempotency conflict",
    413: "Upload exceeds the configured maximum",
    415: "Unsupported media type",
    422: "Validation failed",
    428: "A required precondition header is missing",
    429: "Rate limit reached",
    500: "Unexpected failure",
    503: "A dependency (database, storage or model) is unavailable",
}


def ref(schema_name: str) -> dict[str, str]:
    return {"$ref": f"#/components/schemas/{COMPONENT_NAMES[schema_name]}"}


def component_ref(component: str, *pointer: str) -> dict[str, str]:
    suffix = "".join(f"/{part}" for part in pointer)
    return {"$ref": f"#/components/schemas/{component}{suffix}"}


def success_envelope_schema(data: dict[str, Any]) -> dict[str, Any]:
    """`serviceSuccessSchema(data)` from the contracts, as JSON Schema."""
    return {
        "type": "object",
        "properties": {
            "success": {"const": True},
            "contract_version": {"const": "1.0.0"},
            "data": data,
            "meta": {
                "type": "object",
                "properties": {
                    "correlation_id": {"type": "string"},
                    "timestamp": {"type": "string"},
                },
                "required": ["correlation_id", "timestamp"],
                "additionalProperties": False,
            },
        },
        "required": ["success", "contract_version", "data", "meta"],
        "additionalProperties": False,
    }


def page_schema(item: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    properties: dict[str, Any] = {
        "items": {"type": "array", "items": item},
        "pagination": {
            "type": "object",
            "properties": {
                "next_cursor": {"type": ["string", "null"]},
                "has_more": {"type": "boolean"},
            },
            "required": ["next_cursor", "has_more"],
            "additionalProperties": False,
        },
    }
    properties.update(extra or {})
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def json_response(description: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {"description": description, "content": {"application/json": {"schema": schema}}}


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    return {
        status: json_response(ERROR_DESCRIPTIONS[status], ref("error_envelope"))
        for status in statuses
    }


def json_body(schema: dict[str, Any], description: str) -> dict[str, Any]:
    return {
        "requestBody": {
            "required": True,
            "description": description,
            "content": {"application/json": {"schema": schema}},
        }
    }


def _rewrite_refs(node: Any, component: str) -> Any:
    if isinstance(node, dict):
        rewritten = {}
        for key, value in node.items():
            if key in ("$id", "$schema"):
                continue
            if key == "$ref" and isinstance(value, str) and value.startswith("#/"):
                rewritten[key] = f"#/components/schemas/{component}/{value[2:]}"
            else:
                rewritten[key] = _rewrite_refs(value, component)
        return rewritten
    if isinstance(node, list):
        return [_rewrite_refs(item, component) for item in node]
    return node


def contract_components(registry: ContractRegistry) -> dict[str, Any]:
    return {
        component: _rewrite_refs(copy.deepcopy(registry.schemas[name]), component)
        for name, component in COMPONENT_NAMES.items()
    }


def install_openapi(application: FastAPI, registry: ContractRegistry) -> None:
    def generate() -> dict[str, Any]:
        if application.openapi_schema:
            return application.openapi_schema
        document = get_openapi(
            title=application.title,
            version=application.version,
            description=application.description,
            routes=application.routes,
        )
        schemas = document.setdefault("components", {}).setdefault("schemas", {})
        schemas.update(contract_components(registry))
        application.openapi_schema = document
        return document

    application.openapi = generate  # type: ignore[method-assign]
