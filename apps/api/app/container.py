"""Process-wide collaborators, composed once per application instance."""

from __future__ import annotations

from dataclasses import dataclass

from apps.api.app.contracts.validation import ContractRegistry
from apps.api.app.core.config import Settings
from apps.api.app.core.passwords import PasswordService
from apps.api.app.core.rate_limit import SlidingWindowRateLimiter
from apps.api.app.core.tokens import TokenService
from apps.api.app.db.session import Database
from apps.api.app.domain.time import Clock, utc_now
from apps.api.app.services.audit import AuditTrail
from apps.api.app.services.authentication import AuthenticationService
from apps.api.app.services.authorization import Authorizer


@dataclass
class AppServices:
    settings: Settings
    database: Database
    contracts: ContractRegistry
    passwords: PasswordService
    clock: Clock
    tokens: TokenService
    audit: AuditTrail
    authorizer: Authorizer
    authentication: AuthenticationService


def build_services(settings: Settings, clock: Clock | None = None) -> AppServices:
    resolved_clock = clock or utc_now
    database = Database(settings)
    passwords = PasswordService(settings)
    tokens = TokenService(settings, resolved_clock)
    audit = AuditTrail(database, resolved_clock)
    sign_in_limiter = SlidingWindowRateLimiter(
        settings.sign_in_rate_limit_attempts, settings.sign_in_rate_limit_window_seconds
    )
    return AppServices(
        settings=settings,
        database=database,
        contracts=ContractRegistry(settings.contract_schema_directory),
        passwords=passwords,
        clock=resolved_clock,
        tokens=tokens,
        audit=audit,
        authorizer=Authorizer(audit),
        authentication=AuthenticationService(
            database, passwords, tokens, audit, sign_in_limiter, resolved_clock
        ),
    )
