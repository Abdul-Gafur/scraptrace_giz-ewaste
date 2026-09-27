"""Reusable authentication and authorisation dependencies.

Authentication accepts a bearer token (API clients) or the HttpOnly session cookie (browsers).
Cookie-authenticated state-changing requests must come from an allowed origin, which blocks
cross-site request forgery without a separate token. Every dependency denies by default.

Object-level rules (record ownership, facility scope for a record, review assignment) need the
persisted record, so services enforce them inside their transactions through `Authorizer`;
the dependencies here gate the role, the permission and path-addressed programme/facility scope.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated
from urllib.parse import urlsplit

from apps.api.app.container import AppServices
from apps.api.app.core.config import Settings
from apps.api.app.core.errors import authentication_required, permission_denied
from apps.api.app.core.tokens import TokenError
from apps.api.app.dependencies import get_services, get_session
from apps.api.app.repositories.identity import IdentityRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.authorization import Actor
from fastapi import Depends, Path, Request
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

SESSION_COOKIE_NAME = "scraptrace_session"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
SESSION_INVALID = "The session is invalid or has expired. Sign in again."

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="BearerToken",
    description="Short-lived access token returned by `POST /v1/auth/sessions`.",
)
cookie_scheme = APIKeyCookie(
    name=SESSION_COOKIE_NAME,
    auto_error=False,
    scheme_name="SessionCookie",
    description="HttpOnly, SameSite=Lax session cookie set by `POST /v1/auth/sessions`.",
)


def get_request_context(request: Request) -> RequestContext:
    return RequestContext(correlation_id=request.state.request_id)


def _request_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        parts = urlsplit(referer)
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}"
    return None


def enforce_same_origin(request: Request, settings: Settings) -> None:
    if request.method in SAFE_METHODS:
        return
    if _request_origin(request) not in settings.allowed_origins:
        raise permission_denied("Cross-site request rejected.")


async def authenticate(
    request: Request,
    services: AppServices,
    bearer: HTTPAuthorizationCredentials | None,
    cookie: str | None,
) -> Actor:
    token = bearer.credentials if bearer is not None else None
    via_cookie = False
    if not token and cookie:
        token, via_cookie = cookie, True
    if not token:
        raise authentication_required()
    try:
        claims = services.tokens.decode(token)
    except TokenError as exc:
        raise authentication_required(SESSION_INVALID) from exc
    if via_cookie:
        enforce_same_origin(request, services.settings)
    actor = await services.authentication.resolve(claims)
    if actor is None:
        raise authentication_required(SESSION_INVALID)
    request.state.actor_role = actor.role
    return actor


async def get_current_actor(
    request: Request,
    services: Annotated[AppServices, Depends(get_services)],
    bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    cookie: Annotated[str | None, Depends(cookie_scheme)],
) -> Actor:
    """The authenticated user. Missing, malformed, expired or revoked sessions return 401."""
    return await authenticate(request, services, bearer, cookie)


CurrentActor = Annotated[Actor, Depends(get_current_actor)]
Context = Annotated[RequestContext, Depends(get_request_context)]
Services = Annotated[AppServices, Depends(get_services)]
Session = Annotated[AsyncSession, Depends(get_session)]


def require_roles(*roles: str) -> Callable[..., Awaitable[Actor]]:
    """Admits only the listed roles (403 and an audit event otherwise)."""

    async def dependency(actor: CurrentActor, services: Services, context: Context) -> Actor:
        if actor.role not in roles:
            await services.audit.record_now(
                services.audit.event(
                    action="authorization.denied",
                    outcome="denied",
                    context=context,
                    actor=actor,
                    details={"reason": "role", "required_roles": sorted(roles)},
                )
            )
            raise permission_denied()
        return actor

    return dependency


def require_permission(permission: str) -> Callable[..., Awaitable[Actor]]:
    """Admits roles whose contract permission set contains `permission`."""

    async def dependency(actor: CurrentActor, services: Services, context: Context) -> Actor:
        await services.authorizer.require_role_permission(actor, permission, context)
        return actor

    return dependency


async def require_programme_scope(
    programme_id: Annotated[uuid.UUID, Path(description="Programme identifier")],
    actor: CurrentActor,
    services: Services,
    context: Context,
) -> uuid.UUID:
    """The path programme must be one the actor is assigned to (404 otherwise)."""
    if programme_id not in actor.programme_ids:
        await services.authorizer.deny_scope(
            actor,
            None,
            context,
            target_type="programme",
            target_id=programme_id,
            reason="programme_scope",
        )
    return programme_id


async def require_facility_scope(
    facility_id: Annotated[uuid.UUID, Path(description="Recycler facility identifier")],
    actor: CurrentActor,
    services: Services,
    context: Context,
    session: Session,
) -> uuid.UUID:
    """A recycler must be assigned to the facility; programme oversight roles (reviewer,
    manager) may read facilities in their programme. Everyone else receives 404."""
    allowed = facility_id in actor.facility_ids
    if not allowed and actor.has_permission("recovery_record:view_operational"):
        facility = await IdentityRepository(session).get_facility(facility_id)
        allowed = (
            facility is not None
            and actor.role != "recycler"
            and facility.programme_id in actor.programme_ids
        )
    if not allowed:
        await services.authorizer.deny_scope(
            actor,
            None,
            context,
            target_type="facility",
            target_id=facility_id,
            reason="facility_scope",
        )
    return facility_id
