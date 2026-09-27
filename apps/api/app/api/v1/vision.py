"""Versioned vision-appraisal upload endpoint."""

from __future__ import annotations

import re
import time
from typing import Annotated, Any

from apps.api.app.contracts.validation import load_schema
from apps.api.app.core.config import REPOSITORY_ROOT, Settings
from apps.api.app.core.errors import ApiError
from apps.api.app.core.request_id import valid_request_id
from apps.api.app.dependencies import get_api_settings, get_vision_service
from apps.api.app.services.image_validation import read_validated_image
from apps.api.app.services.vision_service import VisionService
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

VISION_RESPONSE_SCHEMA = load_schema(
    REPOSITORY_ROOT / "packages/contracts/schemas/vision_appraisal_response.schema.json"
)
ERROR_SCHEMA = load_schema(
    REPOSITORY_ROOT / "packages/contracts/schemas/error_envelope.schema.json"
)
EVIDENCE_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


router = APIRouter(prefix="/vision", tags=["vision"])


ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    status: {
        "description": description,
        "content": {"application/json": {"schema": ERROR_SCHEMA}},
    }
    for status, description in {
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
        "results require manual category confirmation. Uploads are not retained. This walking "
        "skeleton has no authentication layer and must remain behind a controlled boundary."
    ),
    response_model=None,
    responses={
        200: {
            "description": "Contract-valid vision appraisal",
            "content": {"application/json": {"schema": VISION_RESPONSE_SCHEMA}},
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
