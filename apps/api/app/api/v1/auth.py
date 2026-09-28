"""Sign-in, current user, sign-out and development-only demo-account discovery."""

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
from apps.api.app.api.security import (
    SESSION_COOKIE_NAME,
    Context,
    CurrentActor,
    Services,
    enforce_same_origin,
)
from apps.api.app.contracts.transport import check_response, validate_request
from apps.api.app.core.errors import not_found, success_envelope
from apps.api.app.domain.time import format_timestamp
from apps.api.app.services.authorization import Actor
from fastapi import APIRouter, Request, Response, status

router = APIRouter(prefix="/auth", tags=["authentication"])


def current_user(actor: Actor) -> dict[str, Any]:
    """`CurrentUser`: identity, role, scope and the actor reference to copy into requests."""
    return {
        "user_id": str(actor.user_id),
        "username": actor.username,
        "display_name": actor.display_name,
        "role": actor.role,
        "permissions": actor.permissions,
        "programme_ids": sorted(str(value) for value in actor.programme_ids),
        "facility_ids": sorted(str(value) for value in actor.facility_ids),
        "receiving_location_ids": sorted(str(value) for value in actor.location_ids),
        "preferred_language": actor.preferred_language,
        "actor_reference": actor.reference(),
    }


@router.post(
    "/sessions",
    status_code=status.HTTP_201_CREATED,
    summary="Sign in",
    description=(
        "Verifies a username and password (`SignInRequest`) and issues a short-lived session "
        "credential only as an HttpOnly, SameSite=Lax cookie; the body (`SessionCreated`) "
        "carries the expiry and the user, never the credential. Every failure returns the same "
        "message. Repeated failures are rate limited. Non-browser clients send the cookie "
        "value as a Bearer token."
    ),
    response_model=None,
    responses={
        201: json_response("Signed in", success_envelope_schema(ref("session_created"))),
        **error_responses(401, 403, 415, 422, 429, 503),
    },
    openapi_extra=json_body("sign_in_request", "Username and password"),
)
async def sign_in(
    request: Request,
    response: Response,
    services: Services,
    context: Context,
) -> dict[str, Any]:
    # A browser sign-in carries an Origin header; one from a foreign origin is refused so a
    # hostile page cannot plant a session (login CSRF). Non-browser clients send no Origin.
    if request.headers.get("origin") is not None:
        enforce_same_origin(request, services.settings)
    body = await read_json_object(request)
    validate_request("sign_in_request", body)
    client_host = request.client.host if request.client is not None else "unknown"
    result = await services.authentication.sign_in(
        body["username"], body["password"], client_host, context
    )
    response.set_cookie(
        SESSION_COOKIE_NAME,
        result.token.token,
        max_age=services.tokens.ttl_seconds,
        httponly=True,
        secure=services.settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    request.state.actor_role = result.actor.role
    data = {
        "expires_at": format_timestamp(result.token.expires_at),
        "user": current_user(result.actor),
    }
    check_response("session_created", data)
    return success_envelope(request, data)


@router.get(
    "/me",
    summary="Current authenticated user",
    description="Restores the browser session from its cookie. `401` when there is none.",
    response_model=None,
    responses={
        200: json_response("The user", success_envelope_schema(ref("current_user"))),
        **error_responses(401),
    },
)
async def me(request: Request, actor: CurrentActor) -> dict[str, Any]:
    data = current_user(actor)
    check_response("current_user", data)
    return success_envelope(request, data)


@router.delete(
    "/sessions/current",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out",
    description=(
        "Revokes every access token issued to the user so far (the stored session version "
        "advances) and clears the session cookie."
    ),
    responses=error_responses(401, 403),
)
async def sign_out(actor: CurrentActor, services: Services, context: Context) -> Response:
    await services.authentication.sign_out(actor, context)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=services.settings.cookie_secure,
        samesite="lax",
    )
    return response


@router.get(
    "/demo-accounts",
    summary="List demonstration accounts (development only)",
    description=(
        "Available only when `SCRAPTRACE_ENABLE_DEMO_ACCOUNT_DISCOVERY=true` in the development "
        "or test environment; otherwise 404. Returns usernames and roles, never passwords."
    ),
    response_model=None,
    responses={
        200: json_response("Accounts", success_envelope_schema(ref("demo_account_list"))),
        **error_responses(404),
    },
)
async def demo_accounts(request: Request, services: Services) -> dict[str, Any]:
    if not services.settings.demo_account_discovery_enabled:
        raise not_found()
    data = await services.authentication.demo_accounts()
    check_response("demo_account_list", data)
    return success_envelope(request, data)
