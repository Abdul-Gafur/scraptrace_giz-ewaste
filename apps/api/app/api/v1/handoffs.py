"""Secure QR lookup and recycler handoff."""

from __future__ import annotations

from typing import Any

from apps.api.app.api.openapi import (
    error_responses,
    json_body,
    json_response,
    ref,
    success_envelope_schema,
)
from apps.api.app.api.requests import read_json_object
from apps.api.app.api.security import Context, CurrentActor, Services, Session
from apps.api.app.contracts import refinements
from apps.api.app.contracts.transport import (
    HANDOFF_LOOKUP_RESPONSE_SCHEMA,
    HANDOFF_LOOKUP_SCHEMA,
    check_transport_response,
    validate_contract_request,
    validate_transport,
)
from apps.api.app.core.errors import ApiError, success_envelope
from apps.api.app.services.handoff import HandoffService
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["handoff"])


@router.post(
    "/handoff-lookups",
    summary="Resolve a scanned QR code or typed transfer code",
    description=(
        "Accepts exactly one of `qr_payload` (the decoded `QrPayload`), `qr_text` (QR symbol "
        "text), `lookup_token`, or `transfer_code` (human reference). Returns the minimised "
        "preview a recycler may see before accepting the item. Invalid, unknown, revoked or "
        "expired codes return 404 without revealing whether any record exists; an unsupported "
        "QR contract version returns `UNSUPPORTED_CONTRACT_VERSION`. POST keeps tokens out of "
        "URLs and logs. Rate limited per user."
    ),
    response_model=None,
    responses={
        200: json_response(
            "Lookup result", success_envelope_schema(HANDOFF_LOOKUP_RESPONSE_SCHEMA)
        ),
        **error_responses(401, 403, 404, 415, 422, 429),
    },
    openapi_extra=json_body(HANDOFF_LOOKUP_SCHEMA, "One presentation form"),
)
async def lookup(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> dict[str, Any]:
    body = await read_json_object(request)
    validate_transport(HANDOFF_LOOKUP_SCHEMA, body)
    result = await HandoffService(session, services, context, services.lookup_limiter).lookup(
        actor, body
    )
    check_transport_response(HANDOFF_LOOKUP_RESPONSE_SCHEMA, result)
    return success_envelope(request, result)


@router.post(
    "/handoffs",
    summary="Record a recycler handoff",
    description=(
        "Accepts the contract `HandoffRequest` and returns a `HandoffResponse`. The presented "
        "lookup token, the recycler's identity and receiving location, and the evidence "
        "references are all verified. The server adds QR-scan and receipt evidence, evaluates "
        "weight, category and duplicate-evidence flags, and applies `record_handoff` in one "
        "transaction; a discrepancy opens the review case in that same transaction. The same "
        "idempotency key and digest replays the first response (201 on creation, 200 on "
        "replay). A second scan of a received record returns `duplicate_scan`."
    ),
    response_model=None,
    responses={
        201: json_response("Handoff created", success_envelope_schema(ref("handoff_response"))),
        200: json_response(
            "Replay, duplicate scan or rejection", success_envelope_schema(ref("handoff_response"))
        ),
        **error_responses(401, 403, 404, 409, 415, 422, 503),
    },
    openapi_extra=json_body(ref("handoff_request"), "The contract HandoffRequest"),
)
async def record_handoff(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    body = await read_json_object(request)
    validate_contract_request("handoff_request", body)
    issues = refinements.timestamps({"handoff_time": body["handoff_time"]})
    if issues:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The request does not match the contract.",
            field_issues=issues,
        )
    outcome = await HandoffService(session, services, context, services.lookup_limiter).record(
        actor, body
    )
    return JSONResponse(success_envelope(request, outcome.body), status_code=outcome.status_code)
