"""FastAPI dependency accessors."""

from collections.abc import AsyncIterator
from typing import cast

from apps.api.app.container import AppServices
from apps.api.app.core.config import Settings
from apps.api.app.services.vision_service import VisionService
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


def get_api_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_vision_service(request: Request) -> VisionService:
    return cast(VisionService, request.app.state.vision_service)


def get_services(request: Request) -> AppServices:
    return cast(AppServices, request.app.state.services)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One short-lived session per request. Services open explicit transactions on it."""
    async with get_services(request).database.session_scope() as session:
        yield session
