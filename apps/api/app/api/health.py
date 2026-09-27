"""Process liveness, model readiness and database readiness routes.

Health routes are unauthenticated by policy and disclose no topology, credentials or error
detail: each reports a status and nothing else.
"""

from typing import Annotated

from alembic.config import Config
from alembic.script import ScriptDirectory
from apps.api.app.container import AppServices
from apps.api.app.core.config import API_ROOT
from apps.api.app.core.errors import ApiError
from apps.api.app.dependencies import get_services, get_vision_service
from apps.api.app.services.vision_service import VisionService
from fastapi import APIRouter, Depends

router = APIRouter(tags=["health"])


def _expected_schema_revision() -> str | None:
    script = ScriptDirectory.from_config(Config(str(API_ROOT / "alembic.ini")))
    return script.get_current_head()


EXPECTED_SCHEMA_REVISION = _expected_schema_revision()


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
        raise ApiError(
            status_code=503,
            code="DEPENDENCY_UNAVAILABLE",
            message="The vision model is unavailable.",
            retryable=True,
        )
    return {"status": "ready", "model_loaded": True, "integrity_verified": True}


@router.get(
    "/health/database",
    summary="Check whether the database is reachable and fully migrated",
    responses={503: {"description": "Database unavailable or migrations not applied"}},
)
async def database_readiness(
    services: Annotated[AppServices, Depends(get_services)],
) -> dict[str, str | bool]:
    revision = await services.database.schema_revision()
    if revision is None or revision != EXPECTED_SCHEMA_REVISION:
        raise ApiError(
            status_code=503,
            code="DEPENDENCY_UNAVAILABLE",
            message="The database is unavailable or not migrated.",
            retryable=True,
        )
    return {"status": "ready", "schema_current": True}
