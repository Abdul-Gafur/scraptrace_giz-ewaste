"""ScrapTrace FastAPI application factory."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio
from apps.api.app.api.health import router as health_router
from apps.api.app.api.v1.router import router as v1_router
from apps.api.app.contracts.validation import ContractValidator
from apps.api.app.core.config import Settings, get_settings
from apps.api.app.core.errors import register_error_handlers
from apps.api.app.core.logging import RequestLoggingMiddleware, configure_logging
from apps.api.app.core.request_id import RequestIdMiddleware
from apps.api.app.services.vision_service import Predictor, VisionService
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.vision.predictor import ModelLoadError, VisionPredictor


def create_app(settings: Settings | None = None, predictor: Predictor | None = None) -> FastAPI:
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

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        configure_logging(resolved_settings.log_level)
        if not resolved_predictor.is_ready():
            try:
                await anyio.to_thread.run_sync(resolved_predictor.load)
            except ModelLoadError:
                logging.getLogger("scraptrace.startup").warning("vision_model_unavailable")
        yield

    application = FastAPI(
        title="ScrapTrace API",
        version="0.1.0",
        description=(
            "Walking-skeleton API for secure, contract-validated, single-image e-waste "
            "classification. The classifier is not an object detector."
        ),
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.state.vision_service = vision_service
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(v1_router)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(RequestIdMiddleware)
    return application


app = create_app()
