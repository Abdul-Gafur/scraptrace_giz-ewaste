"""ScrapTrace FastAPI application factory."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio
from apps.api.app.api.health import router as health_router
from apps.api.app.api.openapi import install_openapi
from apps.api.app.api.v1.router import router as v1_router
from apps.api.app.container import build_services
from apps.api.app.contracts.validation import ContractValidator
from apps.api.app.core.config import Settings, get_settings
from apps.api.app.core.errors import register_error_handlers
from apps.api.app.core.logging import RequestLoggingMiddleware, configure_logging
from apps.api.app.core.request_id import RequestIdMiddleware
from apps.api.app.core.security_headers import SecurityHeadersMiddleware
from apps.api.app.domain.time import Clock
from apps.api.app.services.vision_service import Predictor, VisionService
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.vision.predictor import ModelLoadError, VisionPredictor


def create_app(
    settings: Settings | None = None,
    predictor: Predictor | None = None,
    clock: Clock | None = None,
) -> FastAPI:
    resolved_settings = settings or get_settings()
    resolved_predictor = predictor or VisionPredictor(
        checkpoint_path=resolved_settings.checkpoint_path,
        manifest_path=resolved_settings.model_manifest_path,
        response_schema_path=resolved_settings.vision_response_schema_path,
        device=resolved_settings.runtime_device,
    )
    validator = ContractValidator(resolved_settings.vision_response_schema_path)
    vision_service = VisionService(
        predictor=resolved_predictor,
        validator=validator,
        confidence_threshold=resolved_settings.confidence_threshold,
        ambiguity_margin=resolved_settings.ambiguity_margin,
        inference_timeout_seconds=resolved_settings.inference_timeout_seconds,
        maximum_concurrent_inferences=resolved_settings.maximum_concurrent_inferences,
    )
    services = build_services(resolved_settings, clock)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        configure_logging(resolved_settings.log_level)
        # Missing or invalid persistence configuration stops startup with a message that names
        # the variable, never its value.
        resolved_settings.require_runtime_configuration()
        await services.database.start()
        if not resolved_predictor.is_ready():
            try:
                await anyio.to_thread.run_sync(resolved_predictor.load)
            except ModelLoadError:
                logging.getLogger("scraptrace.startup").warning("vision_model_unavailable")
        try:
            yield
        finally:
            await services.database.stop()

    application = FastAPI(
        title="ScrapTrace API",
        version="0.1.0",
        description=(
            "Contract-validated ScrapTrace application API: recovery records, evidence, secure "
            "QR handoff, processing, programme review and single-image e-waste classification. "
            "The classifier is not an object detector."
        ),
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.state.vision_service = vision_service
    application.state.services = services
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(v1_router)
    install_openapi(application, services.contracts)
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Content-Type",
            "X-Request-ID",
            "Authorization",
            "Idempotency-Key",
            "If-Match",
        ],
        expose_headers=["X-Request-ID", "ETag", "Idempotent-Replayed", "Retry-After"],
    )
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(RequestIdMiddleware)
    return application


app = create_app()
