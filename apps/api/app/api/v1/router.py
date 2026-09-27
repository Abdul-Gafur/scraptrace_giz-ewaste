"""Version 1 route composition."""

from apps.api.app.api.v1.vision import router as vision_router
from fastapi import APIRouter

router = APIRouter(prefix="/v1")
router.include_router(vision_router)
