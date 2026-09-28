"""Processing routes: the queue, editable drafts, material entries and submission."""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

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
from apps.api.app.services.pagination import MAXIMUM_LIMIT
from apps.api.app.services.processing import ProcessingService
from apps.api.app.services.records import parse_if_match
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["processing"])

DETAIL = success_envelope_schema(ref("processing_detail"))
VERSION_HEADER = "The processing version last read, as returned in the ETag header."
IfMatch = Annotated[str | None, Header(alias="If-Match", description=VERSION_HEADER)]


def detail_response(
    request: Request, detail: dict[str, Any], status_code: int = 200
) -> JSONResponse:
    return JSONResponse(
        success_envelope(request, detail),
        status_code=status_code,
        headers={"ETag": f'"{detail["version"]}"'},
    )


@router.get(
    "/processing-queue",
    summary="Records awaiting processing at the recycler's facility",
    description="Received records at the caller's receiving locations, oldest receipt first.",
    response_model=None,
    responses={
        200: json_response(
            "One page of records", success_envelope_schema(ref("recovery_record_page"))
        ),
        **error_responses(401, 403, 422),
    },
)
async def processing_queue(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    sort: Literal["received_at", "-received_at"] = "received_at",
    cursor: Annotated[str | None, Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=MAXIMUM_LIMIT)] = 25,
) -> dict[str, Any]:
    page = await ProcessingService(session, services, context).queue(actor, cursor, limit, sort)
    return success_envelope(request, page)


@router.get(
    "/recovery-records/{record_id}/processing",
    summary="Retrieve processing information",
    response_model=None,
    description=(
        "The server-held processing draft or the submitted processing. `404` means no draft has "
        "been started for this record yet."
    ),
    responses={200: json_response("Processing", DETAIL), **error_responses(401, 403, 404)},
)
async def get_processing(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    detail = await ProcessingService(session, services, context).get(record_id, actor)
    return detail_response(request, detail)


@router.put(
    "/recovery-records/{record_id}/processing",
    summary="Create or update editable processing information",
    description=(
        "Creates the processing draft on first use (the record's `processing_state` becomes "
        "`in_progress`) or updates it. Updating an existing draft requires `If-Match` with its "
        "version. Editable only while the record is `received` and the draft is unsubmitted."
    ),
    response_model=None,
    responses={
        200: json_response("Processing draft", DETAIL),
        **error_responses(401, 403, 404, 409, 415, 422, 428),
    },
    openapi_extra=json_body("processing_draft_update", "Fields to set"),
)
async def save_processing(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: IfMatch = None,
) -> JSONResponse:
    version = parse_if_match(if_match, required=False)
    body = await read_json_object(request)
    validate_request("processing_draft_update", body)
    detail = await ProcessingService(session, services, context).save_draft(
        record_id, actor, body, version
    )
    return detail_response(request, detail)


@router.post(
    "/recovery-records/{record_id}/processing/material-entries",
    status_code=201,
    summary="Add a recovered material entry",
    response_model=None,
    responses={
        201: json_response("Processing draft", DETAIL),
        **error_responses(401, 403, 404, 409, 415, 422),
    },
    openapi_extra=json_body("material_entry", "Material and positive weight with unit"),
)
async def add_material_entry(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: IfMatch = None,
) -> JSONResponse:
    body = await read_json_object(request)
    validate_request("material_entry", body)
    detail = await ProcessingService(session, services, context).add_entry(
        record_id, actor, body, parse_if_match(if_match, required=False)
    )
    return detail_response(request, detail, 201)


@router.patch(
    "/recovery-records/{record_id}/processing/material-entries/{entry_id}",
    summary="Update a material entry before submission",
    response_model=None,
    responses={
        200: json_response("Processing draft", DETAIL),
        **error_responses(401, 403, 404, 409, 415, 422),
    },
    openapi_extra=json_body("material_entry_update", "Fields to change"),
)
async def update_material_entry(
    record_id: uuid.UUID,
    entry_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: IfMatch = None,
) -> JSONResponse:
    body = await read_json_object(request)
    validate_request("material_entry_update", body)
    detail = await ProcessingService(session, services, context).update_entry(
        record_id, entry_id, actor, body, parse_if_match(if_match, required=False)
    )
    return detail_response(request, detail)


@router.delete(
    "/recovery-records/{record_id}/processing/material-entries/{entry_id}",
    summary="Remove a material entry before submission",
    response_model=None,
    responses={
        200: json_response("Processing draft", DETAIL),
        **error_responses(401, 403, 404, 409),
    },
)
async def remove_material_entry(
    record_id: uuid.UUID,
    entry_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: IfMatch = None,
) -> JSONResponse:
    detail = await ProcessingService(session, services, context).remove_entry(
        record_id, entry_id, actor, parse_if_match(if_match, required=False)
    )
    return detail_response(request, detail)


@router.post(
    "/processing-submissions",
    summary="Submit processing",
    description=(
        "Accepts the contract `ProcessingRequest` and returns a `ProcessingResponse`. The "
        "request is authoritative and replaces any draft entries. `notes` is the recorded "
        "processing result (`ProcessingInformation.result`, up to 1,000 characters). "
        "Applies `record_processing`; an unflagged record is then completed and "
        "system-approved (`processing_recorded`), while any unresolved flag moves it to "
        "`under_review` (`review_required`). Replays return the first response; a second "
        "submission for the same record is `rejected`."
    ),
    response_model=None,
    responses={
        201: json_response(
            "Processing recorded", success_envelope_schema(ref("processing_response"))
        ),
        200: json_response(
            "Replay or rejection", success_envelope_schema(ref("processing_response"))
        ),
        **error_responses(401, 403, 404, 409, 415, 422),
    },
    openapi_extra=json_body("processing_request", "The contract ProcessingRequest"),
)
async def submit_processing(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    body = await read_json_object(request)
    validate_request("processing_request", body)
    outcome = await ProcessingService(session, services, context).submit(actor, body)
    return JSONResponse(success_envelope(request, outcome.body), status_code=outcome.status_code)
