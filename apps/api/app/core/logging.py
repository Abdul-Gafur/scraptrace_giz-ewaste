"""Small JSON logging setup and HTTP request telemetry."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        event: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        context = getattr(record, "context", None)
        if isinstance(context, dict):
            event.update(context)
        return json.dumps(event, separators=(",", ":"), default=str)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        context = {
            "request_id": request.state.request_id,
            "endpoint": request.url.path,
            "method": request.method,
            "http_status": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        }
        for key in (
            "model_version",
            "inference_duration_ms",
            "outcome",
            "category",
            "confidence",
            "error_code",
        ):
            value = getattr(request.state, key, None)
            if value is not None:
                context[key] = value
        logging.getLogger("scraptrace.http").info("request_complete", extra={"context": context})
        return response
