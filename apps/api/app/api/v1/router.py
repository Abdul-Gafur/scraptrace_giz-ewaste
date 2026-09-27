"""Version 1 route composition."""

from apps.api.app.api.v1.auth import router as auth_router
from apps.api.app.api.v1.evidence import router as evidence_router
from apps.api.app.api.v1.handoffs import router as handoffs_router
from apps.api.app.api.v1.records import router as records_router
from apps.api.app.api.v1.reference import router as reference_router
from apps.api.app.api.v1.vision import router as vision_router
from fastapi import APIRouter

router = APIRouter(prefix="/v1")
router.include_router(auth_router)
router.include_router(reference_router)
router.include_router(records_router)
router.include_router(evidence_router)
router.include_router(handoffs_router)
router.include_router(vision_router)
