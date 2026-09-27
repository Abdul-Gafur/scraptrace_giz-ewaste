"""Controlled evidence retrieval: metadata and content by evidence ID, never by path."""

from __future__ import annotations

import uuid
from typing import Any

from apps.api.app.api.openapi import error_responses, json_response, ref, success_envelope_schema
from apps.api.app.api.security import Context, CurrentActor, Services, Session
from apps.api.app.core.errors import success_envelope
from apps.api.app.services.evidence import EvidenceService
from fastapi import APIRouter, Request, Response

router = APIRouter(prefix="/evidence", tags=["evidence"])

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/json": "json",
}


@router.get(
    "/{evidence_id}",
    summary="Retrieve evidence metadata and provenance",
    response_model=None,
    responses={
        200: json_response("Evidence", success_envelope_schema(ref("evidence"))),
        **error_responses(401, 403, 404),
    },
)
async def get_evidence(
    evidence_id: uuid.UUID,
    request: Request,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> dict[str, Any]:
    data = await EvidenceService(session, services, context).get(evidence_id, actor)
    return success_envelope(request, data)


@router.get(
    "/{evidence_id}/content",
    summary="Download evidence content",
    description=(
        "Streams the stored object to callers allowed to view the record. The digest is "
        "re-verified on every read. Responses are private, uncacheable and sandboxed."
    ),
    response_class=Response,
    responses={
        200: {
            "description": "Evidence bytes",
            "content": {
                "image/jpeg": {},
                "image/png": {},
                "image/webp": {},
                "application/json": {},
            },
        },
        **error_responses(401, 403, 404, 409, 503),
    },
)
async def get_evidence_content(
    evidence_id: uuid.UUID,
    actor: CurrentActor,
    services: Services,
    session: Session,
    context: Context,
) -> Response:
    content = await EvidenceService(session, services, context).content(evidence_id, actor)
    extension = EXTENSIONS.get(content.mime_type, "bin")
    return Response(
        content.content,
        media_type=content.mime_type,
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f'inline; filename="{content.evidence_id}.{extension}"',
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
