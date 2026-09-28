"""Standard ScrapTrace error envelopes and exception handlers."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

import asyncpg
from apps.api.app.contracts.validation import ContractValidationError
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from services.vision.predictor import format_utc_timestamp
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as SqlAlchemyTimeoutError
from sqlalchemy.orm.exc import StaleDataError
from starlette.exceptions import HTTPException as StarletteHttpException

LOGGER = logging.getLogger("scraptrace.errors")


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    retryable: bool = False
    field_issues: list[dict[str, str]] | None = None
    safe_details: dict[str, str | int | float | bool | None] | None = None
    headers: dict[str, str] | None = None


def not_found(message: str = "The requested resource was not found.") -> ApiError:
    return ApiError(status_code=404, code="RESOURCE_NOT_FOUND", message=message)


def permission_denied(
    message: str = "The current role may not perform this action.",
) -> ApiError:
    return ApiError(status_code=403, code="PERMISSION_DENIED", message=message)


def authentication_required(
    message: str = "Sign in to continue.",
) -> ApiError:
    return ApiError(
        status_code=401,
        code="AUTHENTICATION_REQUIRED",
        message=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def validation_failed(
    message: str, field: str | None = None, reason: str | None = None
) -> ApiError:
    issues = [{"field": field, "reason": reason or "invalid"}] if field else None
    return ApiError(status_code=422, code="VALIDATION_FAILED", message=message, field_issues=issues)


def invalid_transition(message: str, reason: str | None = None) -> ApiError:
    return ApiError(
        status_code=409,
        code="INVALID_STATE_TRANSITION",
        message=message,
        safe_details={"reason": reason} if reason else None,
    )


def version_conflict(
    message: str = "The resource changed since it was read. Refresh and review before retrying.",
) -> ApiError:
    return ApiError(status_code=409, code="VERSION_CONFLICT", message=message)


def meta(request: Request) -> dict[str, str]:
    return {"correlation_id": request.state.request_id, "timestamp": format_utc_timestamp()}


def success_envelope(request: Request, data: Any) -> dict[str, Any]:
    """`serviceSuccessSchema` from `packages/contracts/src/common/errors.ts`."""
    return {"success": True, "contract_version": "1.0.0", "data": data, "meta": meta(request)}


def error_envelope(request: Request, error: ApiError) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "success": False,
        "contract_version": "1.0.0",
        "error": {
            "code": error.code,
            "message": error.message,
            "retryable": error.retryable,
        },
        "meta": meta(request),
    }
    if error.field_issues:
        payload["error"]["field_issues"] = error.field_issues[:100]
    if error.safe_details:
        payload["error"]["safe_details"] = error.safe_details
    return payload


def _is_unique_violation(error: IntegrityError) -> bool:
    original = error.orig
    name = type(original).__name__ if original is not None else ""
    text = str(original).lower() if original is not None else ""
    # asyncpg reports UniqueViolationError; SQLite reports "UNIQUE constraint failed".
    return "uniqueviolation" in name.lower() or "unique constraint" in text


def database_error_to_api_error(error: SQLAlchemyError) -> ApiError:
    """Maps persistence failures onto standard codes without exposing SQL or schema detail."""
    if isinstance(error, StaleDataError):
        return version_conflict()
    if isinstance(error, IntegrityError):
        if _is_unique_violation(error):
            return ApiError(
                status_code=409,
                code="DUPLICATE_RECORD",
                message="The request conflicts with data that already exists.",
            )
        return ApiError(
            status_code=409,
            code="INVALID_STATE_TRANSITION",
            message="The request conflicts with the current state of stored data.",
        )
    if isinstance(error, DBAPIError | SqlAlchemyTimeoutError):
        # Connectivity, pool exhaustion, timeouts and other driver-level failures.
        return ApiError(
            status_code=503,
            code="DEPENDENCY_UNAVAILABLE",
            message="The database is unavailable. Try again shortly.",
            retryable=True,
        )
    # Anything else is an owned defect (for example ORM misuse), not a retryable outage.
    return ApiError(
        status_code=500,
        code="INTERNAL_FAILURE",
        message="The request could not be completed.",
    )


def _respond(request: Request, error: ApiError) -> JSONResponse:
    request.state.error_code = error.code
    return JSONResponse(
        error_envelope(request, error), status_code=error.status_code, headers=error.headers
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError) -> JSONResponse:
        return _respond(request, error)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        issues = [
            {"field": ".".join(str(part) for part in item["loc"]), "reason": item["type"]}
            for item in error.errors()[:100]
        ]
        return _respond(
            request,
            ApiError(
                status_code=422,
                code="VALIDATION_FAILED",
                message="The request is invalid.",
                field_issues=issues,
            ),
        )

    @app.exception_handler(StarletteHttpException)
    async def handle_http_error(request: Request, error: StarletteHttpException) -> JSONResponse:
        if error.status_code == 404:
            api_error = not_found()
        elif error.status_code == 405:
            api_error = ApiError(
                status_code=405,
                code="VALIDATION_FAILED",
                message="The HTTP method is not supported for this resource.",
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
        return _respond(request, api_error)

    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
        api_error = database_error_to_api_error(error)
        if api_error.code == "INTERNAL_FAILURE":
            LOGGER.exception(
                "database_usage_error",
                exc_info=(type(error), error, error.__traceback__),
                extra={"context": {"request_id": request.state.request_id}},
            )
            return _respond(request, api_error)
        log = LOGGER.warning if api_error.status_code < 500 else LOGGER.error
        # The exception class is enough to diagnose; statements and parameters are not logged
        # because they can carry personal data.
        log(
            "database_error",
            extra={
                "context": {
                    "request_id": request.state.request_id,
                    "error_class": type(error).__name__,
                    "error_code": api_error.code,
                }
            },
        )
        return _respond(request, api_error)

    async def handle_dependency_error(request: Request, error: Exception) -> JSONResponse:
        # Driver-level connection failures are not always wrapped by SQLAlchemy (asyncpg can
        # raise ConnectionRefusedError or its own errors while connecting). They are outages.
        LOGGER.error(
            "dependency_unavailable",
            extra={
                "context": {
                    "request_id": request.state.request_id,
                    "error_class": type(error).__name__,
                }
            },
        )
        return _respond(
            request,
            ApiError(
                status_code=503,
                code="DEPENDENCY_UNAVAILABLE",
                message="A required service is unavailable. Try again shortly.",
                retryable=True,
            ),
        )

    for dependency_error in (
        ConnectionError,
        asyncio.TimeoutError,
        asyncpg.PostgresError,
        asyncpg.InterfaceError,
    ):
        app.add_exception_handler(dependency_error, handle_dependency_error)

    @app.exception_handler(ContractValidationError)
    async def handle_contract_error(
        request: Request, error: ContractValidationError
    ) -> JSONResponse:
        LOGGER.error(
            "contract_validation_failed",
            extra={"context": {"request_id": request.state.request_id, "detail": str(error)}},
        )
        return _respond(
            request,
            ApiError(
                status_code=500,
                code="INTERNAL_FAILURE",
                message="The response could not be validated against the shared contract.",
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        LOGGER.exception(
            "unhandled_request_error",
            exc_info=(type(error), error, error.__traceback__),
            extra={"context": {"request_id": request.state.request_id}},
        )
        return _respond(
            request,
            ApiError(
                status_code=500,
                code="INTERNAL_FAILURE",
                message="The request could not be completed.",
                retryable=False,
            ),
        )
