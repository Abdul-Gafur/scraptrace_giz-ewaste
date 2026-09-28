"""Request validation against the generated shared contracts.

Every request and response shape that crosses the API boundary is defined in
`packages/contracts` and generated to `packages/contracts/schemas`. The API loads those schemas
once, validates each request body against its named schema, re-checks the Zod refinements that
JSON Schema cannot express (`apps.api.app.contracts.refinements`), and reports failures as the
standard `VALIDATION_FAILED` envelope with allow-listed field issues only.
"""

from __future__ import annotations

from typing import Any

from apps.api.app.contracts import refinements
from apps.api.app.contracts.validation import ContractRegistry
from apps.api.app.core.config import CONTRACT_SCHEMA_DIRECTORY
from apps.api.app.core.errors import ApiError

REGISTRY = ContractRegistry(CONTRACT_SCHEMA_DIRECTORY)


def validation_error(issues: list[dict[str, str]]) -> ApiError:
    return ApiError(
        status_code=422,
        code="VALIDATION_FAILED",
        message="The request does not match the contract.",
        field_issues=issues[:100],
    )


def validate_request(name: str, payload: Any, prefix: str = "") -> None:
    """Raises `VALIDATION_FAILED` (422) unless `payload` satisfies the named contract."""
    issues = REGISTRY.request_issues(name, payload)
    if not issues and isinstance(payload, dict):
        issues = refinements.request_issues(name, payload)
    if issues:
        if prefix:
            for issue in issues:
                issue["field"] = (
                    f"{prefix}.{issue['field']}" if issue["field"] != "body" else prefix
                )
        raise validation_error(issues)


def check_response(name: str, payload: Any) -> None:
    """Raises `ContractValidationError` when outgoing data drifts from the named contract."""
    REGISTRY.check_response(name, payload)
