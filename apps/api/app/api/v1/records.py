"""Recovery-record routes. Handlers parse and authenticate; services decide."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Any, Literal, get_args

from apps.api.app.api.openapi import (
    error_responses,
    json_body,
    json_response,
    page_schema,
    ref,
    success_envelope_schema,
)
from apps.api.app.api.requests import (
    form_file,
    form_text,
    parse_json_text,
    read_form,
    read_json_object,
)
from apps.api.app.api.security import Context, CurrentActor, Services, Session
from apps.api.app.contracts.transport import (
    CATEGORY_CONFIRMATION_SCHEMA,
    DRAFT_CREATE_SCHEMA,
    DRAFT_UPDATE_SCHEMA,
    EVIDENCE_UPLOAD_FIELDS_SCHEMA,
    validate_transport,
)
from apps.api.app.core.errors import success_envelope
from apps.api.app.domain.vocabulary import EWASTE_CATEGORIES, RECOVERY_RECORD_STATES
from apps.api.app.services.evidence import EvidenceService, EvidenceUpload
from apps.api.app.services.idempotency import require_header_key
from apps.api.app.services.image_validation import read_sanitized_evidence
from apps.api.app.services.pagination import MAXIMUM_LIMIT
from apps.api.app.services.records import (
    CommandResult,
    RecordListQuery,
    RecordService,
    parse_if_match,
)
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/recovery-records", tags=["recovery records"])

RECORD = success_envelope_schema(ref("recovery_record"))
SUBMISSION = success_envelope_schema(
    {
        "type": "object",
        "properties": {
            "outcome": {"enum": ["submitted", "duplicate_image"]},
            "record": ref("recovery_record"),
            "replayed": {"type": "boolean"},
            "flag_codes": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["outcome", "record", "replayed", "flag_codes"],
        "additionalProperties": False,
    }
)
IF_MATCH_DESCRIPTION = "The record revision last read, as returned in the ETag header."

StateFilter = Literal[
    "draft",
    "submitted",
    "awaiting_handoff",
    "received",
    "processing_recorded",
    "completed",
    "under_review",
    "approved_and_completed",
    "rejected",
]
CategoryFilter = Literal[
    "refrigerators",
    "laptops_and_desktop_computers",
    "televisions",
    "microwaves",
    "air_conditioners",
    "compressors",
    "mixed_scrap",
]
SortOrder = Literal[
    "created_at", "-created_at", "updated_at", "-updated_at", "captured_at", "-captured_at"
]
# Query-parameter vocabularies must stay identical to the contract vocabularies.
assert get_args(StateFilter) == RECOVERY_RECORD_STATES
assert get_args(CategoryFilter) == EWASTE_CATEGORIES


def command_response(request: Request, result: CommandResult, **headers: str) -> JSONResponse:
    response_headers = dict(headers)
    if result.revision is not None:
        response_headers["ETag"] = f'"{result.revision}"'
    if result.replayed:
        response_headers["Idempotent-Replayed"] = "true"
    return JSONResponse(
        success_envelope(request, result.body),
        status_code=result.status_code,
        headers=response_headers,
    )


@router.post(
    "",
    status_code=201,
    summary="Create a draft recovery record with its original photograph",
    description=(
        "Multipart request: `record` is a JSON document (`RecoveryRecordDraftCreate`, composed "
        "from `RecoveryRecord` field contracts) and `original_image` is the accepted photograph. "
        "The photograph is validated, stripped of metadata, hashed and stored before the draft "
        "exists, so a draft never lacks the evidence its first transition requires. Requires "
        "`Idempotency-Key`; a retry with the same key and content replays the first result."
    ),
    response_model=None,
    responses={
        201: json_response("Draft created", RECORD),
        **error_responses(401, 403, 409, 413, 415, 422, 503),
    },
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "record": {
                                "type": "string",
                                "contentMediaType": "application/json",
                                "contentSchema": DRAFT_CREATE_SCHEMA,
                            },
                            "original_image": {
                                "type": "string",
                                "contentMediaType": "application/octet-stream",
                                "description": "JPEG, PNG or WebP; default maximum 5 MiB.",
                            },
                        },
                        "required": ["record", "original_image"],
                    },
                    "encoding": {"record": {"contentType": "application/json"}},
                }
            },
        }
    },
)
async def create_record(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> JSONResponse:
    key = require_header_key(idempotency_key)
    form = await read_form(request, maximum_fields=4)
    metadata = parse_json_text(form_text(form, "record") or "", "record")
    validate_transport(DRAFT_CREATE_SCHEMA, metadata, prefix="record")
    image = await read_sanitized_evidence(
        form_file(form, "original_image"), services.settings, "original_image"
    )
    result = await RecordService(session, services, context).create_draft(
        actor, metadata, image, image.original_digest, key
    )
    return command_response(
        request, result, Location=f"/v1/recovery-records/{result.body['record_id']}"
    )


@router.get(
    "",
    summary="List recovery records visible to the caller",
    description=(
        "Collectors see their own records. Recyclers see non-draft records destined for or "
        "received at their facility. Reviewers and managers see non-draft records in their "
        "programme. Cursor pagination with a stable identifier tie-breaker."
    ),
    response_model=None,
    responses={
        200: json_response(
            "One page of records", success_envelope_schema(page_schema(ref("recovery_record")))
        ),
        **error_responses(401, 403, 422),
    },
)
async def list_records(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    state: Annotated[list[StateFilter] | None, Query(description="Business states")] = None,
    category: Annotated[list[CategoryFilter] | None, Query(description="Categories")] = None,
    captured_from: Annotated[date | None, Query(description="Capture date, inclusive")] = None,
    captured_to: Annotated[date | None, Query(description="Capture date, inclusive")] = None,
    sort: SortOrder = "-created_at",
    cursor: Annotated[str | None, Query(max_length=512)] = None,
    limit: Annotated[int, Query(ge=1, le=MAXIMUM_LIMIT)] = 25,
) -> dict[str, Any]:
    query = RecordListQuery(
        states=tuple(state or ()),
        categories=tuple(category or ()),
        captured_from=captured_from,
        captured_to=captured_to,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )
    page = await RecordService(session, services, context).list(actor, query)
    return success_envelope(request, page)


@router.get(
    "/{record_id}",
    summary="Retrieve a recovery record",
    response_model=None,
    responses={200: json_response("The record", RECORD), **error_responses(401, 403, 404)},
)
async def get_record(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    data, revision = await RecordService(session, services, context).get(record_id, actor)
    return JSONResponse(success_envelope(request, data), headers={"ETag": f'"{revision}"'})


@router.patch(
    "/{record_id}",
    summary="Update an editable draft",
    description=(
        "Partial update of the caller's own draft. Requires `If-Match` with the current "
        "revision; a stale revision returns `VERSION_CONFLICT`. Submitted records cannot be "
        "edited here."
    ),
    response_model=None,
    responses={
        200: json_response("Updated draft", RECORD),
        **error_responses(401, 403, 404, 409, 415, 422, 428),
    },
    openapi_extra=json_body(DRAFT_UPDATE_SCHEMA, "Fields to change"),
)
async def update_record(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: Annotated[
        str | None, Header(alias="If-Match", description=IF_MATCH_DESCRIPTION)
    ] = None,
) -> JSONResponse:
    revision = parse_if_match(if_match, required=True)
    patch = await read_json_object(request)
    validate_transport(DRAFT_UPDATE_SCHEMA, patch)
    assert revision is not None
    result = await RecordService(session, services, context).update_draft(
        record_id, actor, patch, revision
    )
    return command_response(request, result)


@router.post(
    "/{record_id}/category-confirmations",
    summary="Confirm or correct the draft's category",
    description=(
        "Records the collector's confirmation of, or correction to, the suggested category "
        "(`CategoryConfirmation`, the contract's `VisionHumanCorrection`). The original "
        "prediction is never overwritten. Requires `If-Match`."
    ),
    response_model=None,
    responses={
        200: json_response("Draft with the new confirmation", RECORD),
        **error_responses(401, 403, 404, 409, 415, 422, 428),
    },
    openapi_extra=json_body(CATEGORY_CONFIRMATION_SCHEMA, "The confirmation"),
)
async def confirm_category(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: Annotated[
        str | None, Header(alias="If-Match", description=IF_MATCH_DESCRIPTION)
    ] = None,
) -> JSONResponse:
    revision = parse_if_match(if_match, required=True)
    confirmation = await read_json_object(request)
    validate_transport(CATEGORY_CONFIRMATION_SCHEMA, confirmation)
    assert revision is not None
    result = await RecordService(session, services, context).confirm_category(
        record_id, actor, confirmation, revision
    )
    return command_response(request, result)


@router.post(
    "/{record_id}/submissions",
    summary="Submit a draft",
    description=(
        "Runs `submit_record` (collector) and `publish_for_handoff` (system) through the "
        "contract state machine in one transaction. Re-submitting a submitted record replays "
        "the result. Exact reuse of another record's photograph opens a review flag "
        "(`duplicate_image`) without blocking the journey. `If-Match` is optional."
    ),
    response_model=None,
    responses={
        200: json_response("Submission outcome", SUBMISSION),
        **error_responses(401, 403, 404, 409),
    },
)
async def submit_record(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
    if_match: Annotated[
        str | None, Header(alias="If-Match", description=IF_MATCH_DESCRIPTION)
    ] = None,
) -> JSONResponse:
    revision = parse_if_match(if_match, required=False)
    result = await RecordService(session, services, context).submit(record_id, actor, revision)
    return command_response(request, result)


@router.get(
    "/{record_id}/events",
    summary="Retrieve the record's lifecycle timeline",
    description="Persisted `RecoveryRecordEvent` entries in occurrence order.",
    response_model=None,
    responses={
        200: json_response(
            "Timeline",
            success_envelope_schema({"type": "array", "items": ref("recovery_record_event")}),
        ),
        **error_responses(401, 403, 404),
    },
)
async def record_events(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> dict[str, Any]:
    events = await RecordService(session, services, context).events(record_id, actor)
    return success_envelope(request, events)


@router.post(
    "/{record_id}/evidence",
    status_code=201,
    summary="Upload evidence for a record",
    description=(
        "Multipart image upload. The file is validated by content (not name or declared type), "
        "bounded in bytes and pixels, re-encoded without EXIF or other metadata, hashed with "
        "SHA-256 and stored under a server-generated key. Which roles may add which evidence "
        "types depends on the record state. A client `evidence_id` makes retries safe."
    ),
    response_model=None,
    responses={
        201: json_response("Evidence stored", success_envelope_schema(ref("evidence"))),
        200: json_response(
            "Replay of an earlier identical upload", success_envelope_schema(ref("evidence"))
        ),
        **error_responses(401, 403, 404, 409, 413, 415, 422, 503),
    },
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        **EVIDENCE_UPLOAD_FIELDS_SCHEMA,
                        "properties": {
                            **EVIDENCE_UPLOAD_FIELDS_SCHEMA["properties"],
                            "image": {
                                "type": "string",
                                "contentMediaType": "application/octet-stream",
                            },
                        },
                        "required": [*EVIDENCE_UPLOAD_FIELDS_SCHEMA["required"], "image"],
                    }
                }
            },
        }
    },
)
async def upload_evidence(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    form = await read_form(request, maximum_fields=10)
    fields = {
        name: value
        for name in EVIDENCE_UPLOAD_FIELDS_SCHEMA["properties"]
        if (value := form_text(form, name, required=False)) is not None
    }
    validate_transport(EVIDENCE_UPLOAD_FIELDS_SCHEMA, fields)
    image = await read_sanitized_evidence(form_file(form, "image"), services.settings, "image")
    upload = EvidenceUpload(
        evidence_type=fields["evidence_type"],
        evidence_id=uuid.UUID(fields["evidence_id"]) if "evidence_id" in fields else None,
        captured_at=fields["captured_at"],
        capture_source=fields["capture_source"],
        device_instance_id=uuid.UUID(fields["device_instance_id"]),
        connectivity=fields["connectivity"],
        application_version=fields["application_version"],
    )
    status_code, data = await EvidenceService(session, services, context).upload(
        record_id, actor, upload, image
    )
    return JSONResponse(success_envelope(request, data), status_code=status_code)


@router.get(
    "/{record_id}/evidence",
    summary="List a record's evidence metadata",
    response_model=None,
    responses={
        200: json_response(
            "Evidence metadata",
            success_envelope_schema({"type": "array", "items": ref("evidence")}),
        ),
        **error_responses(401, 403, 404),
    },
)
async def list_evidence(
    record_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> dict[str, Any]:
    items = await EvidenceService(session, services, context).list_for_record(record_id, actor)
    return success_envelope(request, items)
