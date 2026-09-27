"""Replaceable local authentication provider.

No authentication ADR selects a production identity provider, so Phase 1 implements the
smallest safe local provider: Argon2id password verification, short-lived signed access tokens,
and revocation by incrementing the user's session version on sign-out. A future identity
provider replaces `sign_in` and `resolve`; the `Actor` it produces and every authorisation rule
stay the same.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import anyio
import sqlalchemy as sa
from apps.api.app.core.errors import ApiError, authentication_required
from apps.api.app.core.passwords import PasswordService
from apps.api.app.core.rate_limit import SlidingWindowRateLimiter
from apps.api.app.core.tokens import IssuedToken, TokenClaims, TokenService
from apps.api.app.db.models import User, UserRoleAssignment
from apps.api.app.db.session import Database
from apps.api.app.domain.time import Clock
from apps.api.app.repositories.identity import IdentityRepository
from apps.api.app.services.audit import AuditTrail, RequestContext
from apps.api.app.services.authorization import Actor
from sqlalchemy.ext.asyncio import AsyncSession

# One safe message for every sign-in failure, so responses never reveal whether an account
# exists, is suspended or has no usable role.
SIGN_IN_FAILED = "The username or password is incorrect."


@dataclass(frozen=True)
class SignInResult:
    token: IssuedToken
    actor: Actor


def effective_role(assignments: Sequence[UserRoleAssignment]) -> str | None:
    """Exactly one distinct role per account until ADR-006's multi-role policy is decided.
    Several assignments of that role (for example two facilities) are allowed."""
    roles = {assignment.role for assignment in assignments}
    return next(iter(roles)) if len(roles) == 1 else None


async def build_actor(session: AsyncSession, user: User, role: str) -> Actor:
    assignments = [assignment for assignment in user.role_assignments if assignment.role == role]
    programme_ids = frozenset(a.programme_id for a in assignments if a.programme_id is not None)
    facility_ids = frozenset(a.facility_id for a in assignments if a.facility_id is not None)
    location_ids = await IdentityRepository(session).location_ids_for_facilities(facility_ids)
    return Actor(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=role,
        programme_ids=programme_ids,
        facility_ids=facility_ids,
        location_ids=location_ids,
        session_version=user.session_version,
        preferred_language=user.preferred_language,
    )


class AuthenticationService:
    def __init__(
        self,
        database: Database,
        passwords: PasswordService,
        tokens: TokenService,
        audit: AuditTrail,
        sign_in_limiter: SlidingWindowRateLimiter,
        clock: Clock,
    ) -> None:
        self._database = database
        self._passwords = passwords
        self._tokens = tokens
        self._audit = audit
        self._limiter = sign_in_limiter
        self._clock = clock

    def _rate_limited(self, retry_after: int) -> ApiError:
        return ApiError(
            status_code=429,
            code="RATE_LIMIT_REACHED",
            message="Too many sign-in attempts. Try again later.",
            retryable=True,
            safe_details={"retry_after_seconds": retry_after},
            headers={"Retry-After": str(retry_after)},
        )

    async def sign_in(
        self, username: str, password: str, client_host: str, context: RequestContext
    ) -> SignInResult:
        normalized = username.strip().lower()
        account_key = SlidingWindowRateLimiter.key("account", normalized)
        client_key = SlidingWindowRateLimiter.key("client", client_host)
        blocked = self._limiter.retry_after(account_key) or self._limiter.retry_after(client_key)
        if blocked:
            await self._audit.record_now(
                self._audit.event(
                    action="auth.sign-in.failed",
                    outcome="denied",
                    context=context,
                    details={"reason": "rate_limited"},
                )
            )
            raise self._rate_limited(blocked)

        actor: Actor | None = None
        async with self._database.session_scope() as session, session.begin():
            user = await IdentityRepository(session).get_user_by_username(normalized)
            role = effective_role(user.role_assignments) if user is not None else None
            # Always verify, against a decoy hash when there is no account, to keep timing flat.
            verified = await anyio.to_thread.run_sync(
                self._passwords.verify, user.password_hash if user is not None else None, password
            )
            if user is None or role is None or not user.is_active or not verified:
                self._limiter.hit(account_key)
                self._limiter.hit(client_key)
                self._audit.add(
                    session,
                    self._audit.event(
                        action="auth.sign-in.failed",
                        outcome="failed",
                        context=context,
                        actor_id=user.id if user is not None else None,
                        details={
                            "reason": "invalid_credentials"
                            if not verified
                            else "account_unavailable"
                        },
                    ),
                )
            else:
                if self._passwords.needs_rehash(user.password_hash):
                    user.password_hash = await anyio.to_thread.run_sync(
                        self._passwords.hash, password
                    )
                user.last_signed_in_at = self._clock()
                actor = await build_actor(session, user, role)
                self._audit.add(
                    session,
                    self._audit.event(
                        action="auth.sign-in.succeeded",
                        outcome="succeeded",
                        context=context,
                        actor=actor,
                    ),
                )
        if actor is None:
            raise authentication_required(SIGN_IN_FAILED)
        self._limiter.reset(account_key)
        return SignInResult(
            token=self._tokens.issue(actor.user_id, actor.role, actor.session_version),
            actor=actor,
        )

    async def resolve(self, claims: TokenClaims) -> Actor | None:
        """The current actor for valid claims, or None when the account was suspended, its role
        changed, or the session was revoked by sign-out."""
        async with self._database.session_scope() as session:
            user = await IdentityRepository(session).get_user(claims.user_id)
            if user is None or not user.is_active:
                return None
            if user.session_version != claims.session_version:
                return None
            role = effective_role(user.role_assignments)
            if role is None or role != claims.role:
                return None
            return await build_actor(session, user, role)

    async def sign_out(self, actor: Actor, context: RequestContext) -> None:
        async with self._database.session_scope() as session, session.begin():
            # Incrementing the version revokes every token issued before this moment.
            await session.execute(
                sa.update(User)
                .where(User.id == actor.user_id)
                .values(session_version=User.session_version + 1, updated_at=self._clock())
            )
            self._audit.add(
                session,
                self._audit.event(
                    action="auth.sign-out.succeeded",
                    outcome="succeeded",
                    context=context,
                    actor=actor,
                ),
            )

    async def demo_accounts(self) -> list[dict[str, str]]:
        async with self._database.session_scope() as session:
            users = await IdentityRepository(session).list_active_users()
        accounts = []
        for user in users:
            role = effective_role(user.role_assignments)
            if role is not None and user.username.endswith(".demo"):
                accounts.append(
                    {"username": user.username, "display_name": user.display_name, "role": role}
                )
        return accounts
