"""Programme settings and receiving locations, gated by programme and facility scope."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import sqlalchemy as sa
from apps.api.app.api.openapi import error_responses
from apps.api.app.api.schemas import Envelope, ProgrammeView, ReceivingLocationView
from apps.api.app.api.security import Session, require_facility_scope, require_programme_scope
from apps.api.app.core.errors import not_found, success_envelope
from apps.api.app.db.models import FacilityLocation
from apps.api.app.repositories.identity import IdentityRepository
from fastapi import APIRouter, Depends, Request

router = APIRouter(tags=["reference data"])


@router.get(
    "/programmes/{programme_id}",
    summary="Programme settings",
    description="Currency, country and weight-discrepancy threshold for an assigned programme.",
    response_model=Envelope[ProgrammeView],
    responses=error_responses(401, 404),
)
async def get_programme(
    request: Request,
    programme_id: Annotated[uuid.UUID, Depends(require_programme_scope)],
    session: Session,
) -> dict[str, Any]:
    programme = await IdentityRepository(session).get_programme(programme_id)
    if programme is None:
        raise not_found()
    return success_envelope(
        request,
        {
            "programme_id": str(programme.id),
            "name": programme.name,
            "currency": programme.currency,
            "country_code": programme.country_code,
            "weight_discrepancy_threshold_percentage": (
                programme.weight_discrepancy_threshold_percentage
            ),
        },
    )


@router.get(
    "/facilities/{facility_id}/receiving-locations",
    summary="Receiving locations of a facility",
    description=(
        "Locations where a handoff may be recorded. Visible to recyclers assigned to the "
        "facility and to programme reviewers and managers of its programme."
    ),
    response_model=Envelope[list[ReceivingLocationView]],
    responses=error_responses(401, 404),
)
async def list_receiving_locations(
    request: Request,
    facility_id: Annotated[uuid.UUID, Depends(require_facility_scope)],
    session: Session,
) -> dict[str, Any]:
    result = await session.execute(
        sa.select(FacilityLocation)
        .where(FacilityLocation.facility_id == facility_id, FacilityLocation.is_active.is_(True))
        .order_by(FacilityLocation.name, FacilityLocation.id)
    )
    return success_envelope(
        request,
        [
            {
                "location_id": str(location.id),
                "facility_id": str(location.facility_id),
                "name": location.name,
                "facility_type": location.facility_type,
                "verification_status": location.verification_status,
                "verification_date": location.verification_date.isoformat()
                if location.verification_date
                else None,
                "accepted_categories": list(location.accepted_categories),
            }
            for location in result.scalars().all()
        ],
    )
