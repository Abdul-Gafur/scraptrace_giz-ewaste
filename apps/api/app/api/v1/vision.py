"""Versioned vision-appraisal upload endpoint."""

from __future__ import annotations

import re
import time
from typing import Annotated, Any

from apps.api.app.api.openapi import ref
from apps.api.app.api.security import authenticate, bearer_scheme, cookie_scheme
from apps.api.app.container import AppServices
from apps.api.app.core.config import Settings
from apps.api.app.core.errors import ApiError
from apps.api.app.core.request_id import valid_request_id
from apps.api.app.dependencies import get_api_settings, get_services, get_vision_service
from apps.api.app.services.authorization import Actor
from apps.api.app.services.image_validation import read_validated_image
from apps.api.app.services.vision_service import VisionService
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials

EVIDENCE_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


router = APIRouter(prefix="/vision", tags=["vision"])


async def vision_actor(
    request: Request,
    services: Annotated[AppServices, Depends(get_services)],
    bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    cookie: Annotated[str | None, Depends(cookie_scheme)],
) -> Actor | None:
    """Documented policy: appraisal requires any authenticated role by default and always in
    production. It grants no record access and stores nothing."""
    if not services.settings.vision_requires_authentication:
        return None
    return await authenticate(request, services, bearer, cookie)


ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {
        "description": description,
        "content": {"application/json": {"schema": ref("error_envelope")}},
    }
    for status, description in {
        401: "Authentication required (when the vision policy requires it)",
        413: "Upload exceeds the configured maximum",
        415: "Unsupported image type",
        422: "Invalid request or image",
        429: "Inference capacity exhausted",
        500: "Contract validation or inference failure",
        503: "Model unavailable",
        504: "Inference timeout",
    }.items()
}


@router.post(
    "/appraise",
    summary="Classify one e-waste photograph",
    description=(
        "Classifies one photograph into one of seven categories. This endpoint does not detect, "
        "count, or draw bounding boxes around multiple objects. Low-confidence or ambiguous "
        "results require manual category confirmation. Uploads are not retained: evidence "
        "storage is a separate endpoint. Authentication is required unless "
        "SCRAPTRACE_VISION_REQUIRES_AUTHENTICATION is false, which production refuses."
    ),
    response_model=None,
    responses={
        200: {
            "description": "Contract-valid vision appraisal",
            "content": {"application/json": {"schema": ref("vision_appraisal_response")}},
        },
        **ERROR_RESPONSES,
    },
)
async def appraise_image(
    request: Request,
    image: Annotated[
        UploadFile,
        File(description="JPEG, PNG, or WebP image; the default maximum is 5 MiB"),
    ],
    settings: Annotated[Settings, Depends(get_api_settings)],
    service: Annotated[VisionService, Depends(get_vision_service)],
    _actor: Annotated[Actor | None, Depends(vision_actor)],
    request_id: Annotated[
        str | None,
        Form(description="Optional client correlation ID; returned in the X-Request-ID header"),
    ] = None,
    evidence_id: Annotated[
        str | None,
        Form(description="Optional UUIDv7 evidence reference from VisionAppraisalRequest"),
    ] = None,
) -> dict[str, Any]:
    if request_id is not None:
        if not valid_request_id(request_id):
            raise ApiError(
                status_code=422,
                code="VALIDATION_FAILED",
                message="The request identifier is invalid.",
                field_issues=[{"field": "request_id", "reason": "invalid_format"}],
            )
        request.state.request_id = request_id
    if evidence_id is not None and EVIDENCE_ID_PATTERN.fullmatch(evidence_id) is None:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The evidence identifier is invalid.",
            field_issues=[{"field": "evidence_id", "reason": "invalid_uuidv7"}],
        )

    decoded = await read_validated_image(image, settings)
    started = time.perf_counter()
    try:
        result = await service.appraise(decoded)
    finally:
        request.state.inference_duration_ms = round((time.perf_counter() - started) * 1000, 2)
    request.state.outcome = result["outcome"]
    request.state.model_version = result["model_version"]
    if result["outcome"] == "classified":
        request.state.category = result["category"]
        request.state.confidence = result["confidence"]
    return result
