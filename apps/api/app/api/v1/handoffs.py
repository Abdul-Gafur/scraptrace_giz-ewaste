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
from apps.api.app.contracts.transport import check_response, validate_request
from apps.api.app.core.errors import success_envelope
from apps.api.app.services.handoff import HandoffService
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["handoff"])


@router.post(
    "/handoff-lookups",
    summary="Resolve a scanned QR code or a typed manual transfer code",
    description=(
        "Accepts exactly one of `qr_payload` (the decoded `QrPayload`), `qr_text` (QR symbol "
        "text) or `manual_transfer_code`. Returns the minimised preview a recycler may see "
        "before accepting the item, and never either credential (ADR-009). Invalid, unknown, "
        "revoked or expired credentials return the same 404 without revealing whether any "
        "record exists; an unsupported QR contract version returns "
        "`UNSUPPORTED_CONTRACT_VERSION`. POST keeps credentials out of URLs and logs. Lookups "
        "are rate limited per user, and failed manual codes have a stricter per-user limit."
    ),
    response_model=None,
    responses={
        200: json_response(
            "Lookup result", success_envelope_schema(ref("handoff_lookup_response"))
        ),
        **error_responses(401, 403, 404, 415, 422, 429),
    },
    openapi_extra=json_body("handoff_lookup_request", "Exactly one presented credential"),
)
async def lookup(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> dict[str, Any]:
    body = await read_json_object(request)
    validate_request("handoff_lookup_request", body)
    result = await HandoffService(session, services, context, services.lookup_limiter).lookup(
        actor, body
    )
    check_response("handoff_lookup_response", result)
    return success_envelope(request, result)


@router.post(
    "/handoffs",
    summary="Record a recycler handoff",
    description=(
        "Accepts the contract `HandoffRequest` and returns a `HandoffResponse`. The presented "
        "credential (the scanned `lookup_token` or the typed `manual_transfer_code`), the "
        "recycler's identity and receiving location, and the evidence references are all "
        "verified. The server adds QR-scan and receipt evidence, evaluates "
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
        **error_responses(401, 403, 404, 409, 415, 422, 429, 503),
    },
    openapi_extra=json_body("handoff_request", "The contract HandoffRequest"),
)
async def record_handoff(
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> JSONResponse:
    body = await read_json_object(request)
    validate_request("handoff_request", body)
    outcome = await HandoffService(session, services, context, services.lookup_limiter).record(
        actor, body
    )
    return JSONResponse(success_envelope(request, outcome.body), status_code=outcome.status_code)
