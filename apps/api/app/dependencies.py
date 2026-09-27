"""FastAPI dependency accessors."""

from typing import cast

from apps.api.app.core.config import Settings
from apps.api.app.services.vision_service import VisionService
from fastapi import Request


def get_api_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_vision_service(request: Request) -> VisionService:
    return cast(VisionService, request.app.state.vision_service)
