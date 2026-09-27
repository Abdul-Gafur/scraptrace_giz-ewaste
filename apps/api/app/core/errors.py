"""Standard ScrapTrace error envelopes and exception handlers."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from services.vision.predictor import format_utc_timestamp
from starlette.exceptions import HTTPException as StarletteHttpException


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    retryable: bool = False
    field_issues: list[dict[str, str]] | None = None
    safe_details: dict[str, str | int | float | bool | None] | None = None


def error_envelope(request: Request, error: ApiError) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "success": False,
        "contract_version": "1.0.0",
        "error": {
            "code": error.code,
            "message": error.message,
            "retryable": error.retryable,
        },
        "meta": {
            "correlation_id": request.state.request_id,
            "timestamp": format_utc_timestamp(),
        },
    }
    if error.field_issues:
        payload["error"]["field_issues"] = error.field_issues
    if error.safe_details:
        payload["error"]["safe_details"] = error.safe_details
    return payload


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError) -> JSONResponse:
        request.state.error_code = error.code
        return JSONResponse(error_envelope(request, error), status_code=error.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        issues = [
            {"field": ".".join(str(part) for part in item["loc"]), "reason": item["type"]}
            for item in error.errors()[:100]
        ]
        api_error = ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The request is invalid.",
            field_issues=issues,
        )
        request.state.error_code = api_error.code
        return JSONResponse(error_envelope(request, api_error), status_code=api_error.status_code)

    @app.exception_handler(StarletteHttpException)
    async def handle_http_error(request: Request, error: StarletteHttpException) -> JSONResponse:
        if error.status_code == 404:
            api_error = ApiError(
                status_code=404,
                code="RESOURCE_NOT_FOUND",
                message="The requested resource was not found.",
            )
        elif error.status_code < 500:
            api_error = ApiError(
                status_code=error.status_code,
                code="VALIDATION_FAILED",
                message="The HTTP request is invalid.",
            )
        else:
            api_error = ApiError(
                status_code=500,
                code="INTERNAL_FAILURE",
                message="The request could not be completed.",
            )
        request.state.error_code = api_error.code
        return JSONResponse(error_envelope(request, api_error), status_code=api_error.status_code)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        logging.getLogger("scraptrace.errors").exception(
            "unhandled_request_error",
            exc_info=(type(error), error, error.__traceback__),
            extra={"context": {"request_id": request.state.request_id}},
        )
        api_error = ApiError(
            status_code=500,
            code="INTERNAL_FAILURE",
            message="The request could not be completed.",
            retryable=False,
        )
        request.state.error_code = api_error.code
        return JSONResponse(error_envelope(request, api_error), status_code=500)
