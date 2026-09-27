"""Bounded request-body parsing that fails with standard error envelopes."""

from __future__ import annotations

import json
from typing import Any

from apps.api.app.core.errors import ApiError
from fastapi import Request
from starlette.datastructures import FormData, UploadFile

MAXIMUM_JSON_BYTES = 256 * 1024


def _unsupported_media_type(expected: str) -> ApiError:
    return ApiError(
        status_code=415,
        code="VALIDATION_FAILED",
        message=f"The request body must be {expected}.",
        field_issues=[{"field": "Content-Type", "reason": "unsupported_media_type"}],
    )


def _media_type(request: Request) -> str:
    return request.headers.get("content-type", "").split(";")[0].strip().lower()


def parse_json_text(text: str, field: str) -> dict[str, Any]:
    try:
        value = json.loads(text)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The request body is not valid JSON.",
            field_issues=[{"field": field, "reason": "invalid_json"}],
        ) from exc
    if not isinstance(value, dict):
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The request body must be a JSON object.",
            field_issues=[{"field": field, "reason": "invalid_type"}],
        )
    return value


async def read_json_object(request: Request) -> dict[str, Any]:
    if _media_type(request) != "application/json":
        raise _unsupported_media_type("application/json")
    body = await request.body()
    if len(body) > MAXIMUM_JSON_BYTES:
        raise ApiError(
            status_code=413,
            code="VALIDATION_FAILED",
            message="The request body is too large.",
            safe_details={"maximum_bytes": MAXIMUM_JSON_BYTES},
        )
    return parse_json_text(body.decode("utf-8", errors="strict") if body else "", "body")


async def read_form(request: Request, *, maximum_fields: int) -> FormData:
    if _media_type(request) != "multipart/form-data":
        raise _unsupported_media_type("multipart/form-data")
    return await request.form(max_files=1, max_fields=maximum_fields)


def form_text(form: FormData, name: str, *, required: bool = True) -> str | None:
    value = form.get(name)
    if value is None or (isinstance(value, str) and value == ""):
        if required:
            raise ApiError(
                status_code=422,
                code="VALIDATION_FAILED",
                message="A required form field is missing.",
                field_issues=[{"field": name, "reason": "required"}],
            )
        return None
    if not isinstance(value, str):
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="A form field has the wrong type.",
            field_issues=[{"field": name, "reason": "invalid_type"}],
        )
    return value


def form_file(form: FormData, name: str) -> UploadFile:
    value = form.get(name)
    if not isinstance(value, UploadFile):
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="A required file is missing.",
            field_issues=[{"field": name, "reason": "required"}],
        )
    return value
