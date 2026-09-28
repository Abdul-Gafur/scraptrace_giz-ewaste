"""Sign-in, current user, sign-out and development-only demo-account discovery."""

from __future__ import annotations

from typing import Any

from apps.api.app.api.openapi import error_responses
from apps.api.app.api.schemas import (
    CurrentUser,
    DemoAccount,
    Envelope,
    IssuedSession,
    SignInRequest,
)
from apps.api.app.api.security import (
    SESSION_COOKIE_NAME,
    Context,
    CurrentActor,
    Services,
    enforce_same_origin,
)
from apps.api.app.core.errors import not_found, success_envelope
from apps.api.app.domain.time import format_timestamp
from apps.api.app.services.authorization import Actor
from fastapi import APIRouter, Request, Response, status

router = APIRouter(prefix="/auth", tags=["authentication"])


def current_user(actor: Actor) -> dict[str, Any]:
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
        "Verifies a username and password and issues a short-lived access token. The token is "
        "returned for API clients and set as an HttpOnly, SameSite=Lax cookie for browsers. "
        "Every failure returns the same message. Repeated failures are rate limited."
    ),
    response_model=Envelope[IssuedSession],
    # Optional contract fields (ActorReference.programme_id/facility_id) are omitted, never null.
    response_model_exclude_none=True,
    responses=error_responses(401, 422, 429, 503),
)
async def sign_in(
    body: SignInRequest,
    request: Request,
    response: Response,
    services: Services,
    context: Context,
) -> dict[str, Any]:
    # A browser sign-in carries an Origin header; one from a foreign origin is refused so a
    # hostile page cannot plant a session (login CSRF). Non-browser clients send no Origin.
    if request.headers.get("origin") is not None:
        enforce_same_origin(request, services.settings)
    client_host = request.client.host if request.client is not None else "unknown"
    result = await services.authentication.sign_in(
        body.username, body.password, client_host, context
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
    return success_envelope(
        request,
        {
            "access_token": result.token.token,
            "token_type": "Bearer",
            "expires_at": format_timestamp(result.token.expires_at),
            "user": current_user(result.actor),
        },
    )


@router.get(
    "/me",
    summary="Current authenticated user",
    response_model=Envelope[CurrentUser],
    response_model_exclude_none=True,
    responses=error_responses(401),
)
async def me(request: Request, actor: CurrentActor) -> dict[str, Any]:
    return success_envelope(request, current_user(actor))


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
    response_model=Envelope[list[DemoAccount]],
    responses=error_responses(404),
)
async def demo_accounts(request: Request, services: Services) -> dict[str, Any]:
    if not services.settings.demo_account_discovery_enabled:
        raise not_found()
    return success_envelope(request, await services.authentication.demo_accounts())
