"""Programme settings and receiving locations, gated by programme and facility scope."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import sqlalchemy as sa
from apps.api.app.api.openapi import (
    error_responses,
    json_response,
    ref,
    success_envelope_schema,
)
from apps.api.app.api.security import Session, require_facility_scope, require_programme_scope
from apps.api.app.contracts.transport import check_response
from apps.api.app.core.errors import not_found, success_envelope
from apps.api.app.db.models import FacilityLocation, RecyclerFacility
from apps.api.app.repositories.identity import IdentityRepository
from fastapi import APIRouter, Depends, Request

router = APIRouter(tags=["reference data"])

LOCATIONS = success_envelope_schema(ref("receiving_location_list"))


def location_view(location: FacilityLocation) -> dict[str, Any]:
    """`ReceivingLocationView`: directory data only, no coordinates or contact details."""
    return {
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


def locations_response(request: Request, locations: list[FacilityLocation]) -> dict[str, Any]:
    data = [location_view(location) for location in locations]
    check_response("receiving_location_list", data)
    return success_envelope(request, data)


@router.get(
    "/programmes/{programme_id}",
    summary="Programme settings",
    description="Currency, country and weight-discrepancy threshold for an assigned programme.",
    response_model=None,
    responses={
        200: json_response("Programme", success_envelope_schema(ref("programme_view"))),
        **error_responses(401, 404),
    },
)
async def get_programme(
    request: Request,
    programme_id: Annotated[uuid.UUID, Depends(require_programme_scope)],
    session: Session,
) -> dict[str, Any]:
    programme = await IdentityRepository(session).get_programme(programme_id)
    if programme is None:
        raise not_found()
    data = {
        "programme_id": str(programme.id),
        "name": programme.name,
        "currency": programme.currency,
        "country_code": programme.country_code,
        "weight_discrepancy_threshold_percentage": (
            programme.weight_discrepancy_threshold_percentage
        ),
    }
    check_response("programme_view", data)
    return success_envelope(request, data)


@router.get(
    "/programmes/{programme_id}/receiving-locations",
    summary="Participating receiving locations of a programme",
    description=(
        "The programme directory a collector chooses a destination from, for any user assigned "
        "to the programme. Suspended locations are excluded. This is reference data, not a "
        "proximity search: it carries no coordinates or contact details."
    ),
    response_model=None,
    responses={200: json_response("Locations", LOCATIONS), **error_responses(401, 404)},
)
async def list_programme_locations(
    request: Request,
    programme_id: Annotated[uuid.UUID, Depends(require_programme_scope)],
    session: Session,
) -> dict[str, Any]:
    result = await session.execute(
        sa.select(FacilityLocation)
        .join(RecyclerFacility, RecyclerFacility.id == FacilityLocation.facility_id)
        .where(
            RecyclerFacility.programme_id == programme_id,
            FacilityLocation.is_active.is_(True),
            FacilityLocation.verification_status != "suspended",
        )
        .order_by(FacilityLocation.name, FacilityLocation.id)
    )
    return locations_response(request, list(result.scalars().all()))


@router.get(
    "/facilities/{facility_id}/receiving-locations",
    summary="Receiving locations of a facility",
    description=(
        "Locations where a handoff may be recorded. Visible to recyclers assigned to the "
        "facility and to programme reviewers and managers of its programme."
    ),
    response_model=None,
    responses={200: json_response("Locations", LOCATIONS), **error_responses(401, 404)},
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
    return locations_response(request, list(result.scalars().all()))
