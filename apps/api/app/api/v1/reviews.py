"""Review queue, case detail and decisions."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Any, Literal, get_args

from apps.api.app.api.openapi import (
    error_responses,
    json_body,
    json_response,
    ref,
    success_envelope_schema,
)
from apps.api.app.api.requests import read_json_object
from apps.api.app.api.security import Context, CurrentActor, Services, Session
from apps.api.app.contracts.transport import validate_request
from apps.api.app.core.errors import success_envelope
from apps.api.app.domain.vocabulary import REVIEW_FLAG_CODES
from apps.api.app.services.pagination import MAXIMUM_LIMIT
from apps.api.app.services.reviews import DEFAULT_QUEUE_STATUSES, ReviewQuery, ReviewService
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["review"])

CaseStatus = Literal["open", "awaiting_information", "approved", "rejected"]
FlagCode = Literal[
    "WEIGHT_DISCREPANCY",
    "CATEGORY_DISAGREEMENT",
    "DUPLICATE_EVIDENCE_DIGEST",
    "INCOMPLETE_EVIDENCE",
    "MISSING_MATERIAL_WEIGHTS",
    "PROCESSED_WEIGHT_ABOVE_RECEIVED",
]
assert get_args(FlagCode) == REVIEW_FLAG_CODES


@router.get(
    "/review-cases",
    summary="Review queue",
    description=(
        "Review cases in the reviewer's programme that are unassigned or assigned to them. "
        "Defaults to `open` and `awaiting_information`. Filter by status, flag, opening date "
        "and facility. `decision_eligible` marks cases whose record is `under_review`."
    ),
    response_model=None,
    responses={
        200: json_response("One page of cases", success_envelope_schema(ref("review_case_page"))),
        **error_responses(401, 403, 422),
    },
)
async def review_queue(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    status: Annotated[list[CaseStatus] | None, Query(description="Review states")] = None,
    flag_code: FlagCode | None = None,
    opened_from: Annotated[date | None, Query(description="Opening date, inclusive")] = None,
    opened_to: Annotated[date | None, Query(description="Opening date, inclusive")] = None,
    facility_id: uuid.UUID | None = None,
    sort: Literal["opened_at", "-opened_at"] = "opened_at",
    cursor: Annotated[str | None, Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=MAXIMUM_LIMIT)] = 25,
) -> dict[str, Any]:
    query = ReviewQuery(
        statuses=tuple(status or DEFAULT_QUEUE_STATUSES),
        flag_code=flag_code,
        opened_from=opened_from,
        opened_to=opened_to,
        facility_id=facility_id,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )
    page = await ReviewService(session, services, context).queue(actor, query)
    return success_envelope(request, page)


@router.get(
    "/review-cases/{case_id}",
    summary="Review case detail",
    description=(
        "Flags, the record (with reviewer-visible fields), evidence metadata, the lifecycle "
        "timeline and earlier decisions, all in one view (FR-REV-004)."
    ),
    response_model=None,
    responses={
        200: json_response("Case detail", success_envelope_schema(ref("review_case_detail"))),
        **error_responses(401, 403, 404),
    },
)
async def review_case(
    case_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> dict[str, Any]:
    detail = await ReviewService(session, services, context).detail(case_id, actor)
    return success_envelope(request, detail)


@router.post(
    "/review-decisions",
    summary="Record a programme review decision",
    description=(
        "Accepts the contract `ProgrammeReviewRequest` and returns a "
        "`ProgrammeReviewResponse`. `approve` → `approved_and_completed` (eligible for verified "
        "totals), `reject` → `rejected` (both terminal), `request_correction` → stays "
        "`under_review` with review state `awaiting_information`. `reason_code` must suit the "
        "decision, and `previous_*_state` must match the current states (otherwise "
        "`VERSION_CONFLICT`). A decided record cannot be decided again. Replays return the "
        "first response. `idempotency.scope.operation` is `record_review_decision`."
    ),
    response_model=None,
    responses={
        201: json_response(
            "Decision recorded", success_envelope_schema(ref("programme_review_response"))
        ),
        200: json_response("Replay", success_envelope_schema(ref("programme_review_response"))),
        **error_responses(401, 403, 404, 409, 415, 422),
    },
    openapi_extra=json_body("programme_review_request", "The contract ProgrammeReviewRequest"),
)
async def decide(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    body = await read_json_object(request)
    validate_request("programme_review_request", body)
    outcome = await ReviewService(session, services, context).decide(actor, body)
    return JSONResponse(success_envelope(request, outcome.body), status_code=outcome.status_code)
