"""Process liveness and model readiness routes."""

from typing import Annotated

from apps.api.app.dependencies import get_vision_service
from apps.api.app.services.vision_service import VisionService
from fastapi import APIRouter, Depends

router = APIRouter(tags=["health"])


@router.get("/health/live", summary="Check whether the API process is running")
async def liveness() -> dict[str, str]:
    return {"status": "live"}


@router.get(
    "/health/ready",
    summary="Check whether the verified classifier is ready",
    responses={503: {"description": "Model unavailable"}},
)
async def readiness(
    service: Annotated[VisionService, Depends(get_vision_service)],
) -> dict[str, str | bool]:
    if not service.predictor.is_ready():
        from apps.api.app.core.errors import ApiError

        raise ApiError(
            status_code=503,
            code="DEPENDENCY_UNAVAILABLE",
            message="The vision model is unavailable.",
            retryable=True,
        )
    return {"status": "ready", "model_loaded": True, "integrity_verified": True}
