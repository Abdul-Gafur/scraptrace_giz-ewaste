"""Validation against committed schemas generated from TypeScript/Zod."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from jsonschema import Draft202012Validator


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
