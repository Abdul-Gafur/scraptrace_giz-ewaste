"""Validation against committed schemas generated from TypeScript/Zod.

`packages/contracts` is the source of truth. The API never re-describes a contract shape: it
loads the committed Draft 2020-12 JSON Schemas and validates requests and responses against
them. Zod refinements that JSON Schema cannot express are re-checked in
`apps.api.app.contracts.refinements`.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

CONTRACT_SCHEMA_NAMES = (
    "error_envelope",
    "evidence",
    "handoff_request",
    "handoff_response",
    "processing_request",
    "processing_response",
    "programme_review_request",
    "programme_review_response",
    "qr_payload",
    "recovery_record",
    "recovery_record_event",
    "vision_appraisal_response",
)


class ContractValidationError(RuntimeError):
    """Raised when server output drifts from the generated shared contract."""


class ContractValidator:
    def __init__(self, schema_path: Path) -> None:
        try:
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            Draft202012Validator.check_schema(schema)
        except Exception as exc:
            raise ContractValidationError("A generated contract schema cannot be loaded.") from exc
        self.schema = schema
        self.validator = Draft202012Validator(schema)

    def validate(self, payload: Any) -> None:
        errors = sorted(self.validator.iter_errors(payload), key=lambda item: list(item.path))
        if errors:
            raise ContractValidationError("The response failed shared-contract validation.")


def load_schema(path: Path) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


def _field_path(error: ValidationError) -> str:
    parts = [str(part) for part in error.absolute_path]
    if error.validator == "required" and isinstance(error.message, str):
        # "'name' is a required property" names the missing field.
        missing = error.message.split("'")[1] if "'" in error.message else ""
        parts.append(missing)
    if error.validator == "additionalProperties" and isinstance(error.message, str):
        unexpected = error.message.split("'")[1] if "'" in error.message else ""
        parts.append(unexpected)
    return ".".join(part for part in parts if part) or "body"


def _reason(error: ValidationError) -> str:
    return {
        "required": "required",
        "additionalProperties": "unexpected_field",
        "enum": "unsupported_value",
        "const": "unsupported_value",
        "pattern": "invalid_format",
        "type": "invalid_type",
        "minLength": "too_short",
        "maxLength": "too_long",
        "minimum": "below_minimum",
        "exclusiveMinimum": "below_minimum",
        "maximum": "above_maximum",
        "minItems": "too_few_items",
        "maxItems": "too_many_items",
    }.get(str(error.validator), "invalid")


def field_issues(errors: Iterable[ValidationError]) -> list[dict[str, str]]:
    """Allow-listed field issues. Validator messages are not returned because they can echo
    submitted values."""
    issues: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for error in sorted(errors, key=lambda item: [str(part) for part in item.absolute_path]):
        # For unions, report the most specific branch failure rather than the whole union.
        leaf = error
        if error.context:
            leaf = min(error.context, key=lambda item: -len(list(item.absolute_path)))
        key = (_field_path(leaf)[:200], _reason(leaf))
        if key not in seen:
            seen.add(key)
            issues.append({"field": key[0], "reason": key[1]})
        if len(issues) >= 100:
            break
    return issues


class ContractRegistry:
    """Loads every committed contract schema once and validates payloads against a whole schema
    or against one of its subschemas (resolving `$defs` through the parent schema)."""

    def __init__(self, schema_directory: Path) -> None:
        self.schemas: dict[str, dict[str, Any]] = {}
        self._validators: dict[str, Draft202012Validator] = {}
        for name in CONTRACT_SCHEMA_NAMES:
            path = schema_directory / f"{name}.schema.json"
            try:
                schema = load_schema(path)
                Draft202012Validator.check_schema(schema)
            except Exception as exc:
                raise ContractValidationError(
                    f"The generated contract schema '{name}' cannot be loaded."
                ) from exc
            self.schemas[name] = schema
            self._validators[name] = Draft202012Validator(schema)

    def _validator(self, name: str, pointer: tuple[str, ...] = ()) -> Draft202012Validator:
        validator = self._validators[name]
        if not pointer:
            return validator
        subschema: Any = self.schemas[name]
        for part in pointer:
            subschema = subschema[part]
        return validator.evolve(schema=subschema)

    def errors(
        self, name: str, payload: Any, pointer: tuple[str, ...] = ()
    ) -> list[ValidationError]:
        return list(self._validator(name, pointer).iter_errors(payload))

    def check_response(self, name: str, payload: Any, pointer: tuple[str, ...] = ()) -> None:
        errors = self.errors(name, payload, pointer)
        if errors:
            locations = sorted({_field_path(error) for error in errors})[:5]
            raise ContractValidationError(
                f"Outgoing '{name}' failed contract validation at: {', '.join(locations)}"
            )

    def request_issues(
        self, name: str, payload: Any, pointer: tuple[str, ...] = (), prefix: str = ""
    ) -> list[dict[str, str]]:
        issues = field_issues(self.errors(name, payload, pointer))
        if prefix:
            for issue in issues:
                issue["field"] = (
                    f"{prefix}.{issue['field']}" if issue["field"] != "body" else prefix
                )
        return issues
