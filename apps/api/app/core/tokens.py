"""Short-lived signed access tokens.

Tokens are HS256 JWTs with a pinned algorithm list, issuer, audience, expiry and a unique ID.
They carry only opaque identifiers (user ID, role, session version): no personal data. Time
claims are checked against the injected clock, so expiry is testable without sleeping.
Tokens are never logged.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from apps.api.app.core.config import ConfigurationError, Settings
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import Clock

ALGORITHM = "HS256"
LEEWAY_SECONDS = 5
TOKEN_TYPE = "access"


class TokenError(Exception):
    """The token is missing, malformed, tampered with or expired. Never shown to clients."""


@dataclass(frozen=True)
class IssuedToken:
    token: str
    expires_at: datetime


@dataclass(frozen=True)
class TokenClaims:
    user_id: uuid.UUID
    role: str
    session_version: int
    expires_at: datetime


class TokenService:
    def __init__(self, settings: Settings, clock: Clock) -> None:
        # Startup validation (`require_runtime_configuration`) guarantees the secret before any
        # request is served; the lazy check keeps application construction side-effect free.
        self._secret_value = settings.auth_token_secret
        self._ttl = timedelta(seconds=settings.auth_token_ttl_seconds)
        self._issuer = settings.auth_token_issuer
        self._audience = settings.auth_token_audience
        self._clock = clock

    @property
    def _secret(self) -> str:
        if self._secret_value is None:
            raise ConfigurationError(
                "Missing required configuration: SCRAPTRACE_AUTH_TOKEN_SECRET."
            )
        return self._secret_value.get_secret_value()

    @property
    def ttl_seconds(self) -> int:
        return int(self._ttl.total_seconds())

    def issue(self, user_id: uuid.UUID, role: str, session_version: int) -> IssuedToken:
        issued_at = self._clock()
        expires_at = issued_at + self._ttl
        expires = int(expires_at.timestamp())
        claims: dict[str, str | int] = {
            "iss": self._issuer,
            "aud": self._audience,
            "sub": str(user_id),
            "role": role,
            "sv": session_version,
            "typ": TOKEN_TYPE,
            "jti": str(uuid7()),
            "iat": int(issued_at.timestamp()),
            "nbf": int(issued_at.timestamp()),
            "exp": expires,
        }
        return IssuedToken(
            token=jwt.encode(claims, self._secret, algorithm=ALGORITHM),
            expires_at=datetime.fromtimestamp(expires, tz=timezone.utc),
        )

    def decode(self, token: str) -> TokenClaims:
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=[ALGORITHM],
                audience=self._audience,
                issuer=self._issuer,
                options={
                    "require": [
                        "iss",
                        "aud",
                        "sub",
                        "role",
                        "sv",
                        "typ",
                        "jti",
                        "iat",
                        "nbf",
                        "exp",
                    ],
                    "verify_exp": False,
                    "verify_nbf": False,
                    "verify_iat": False,
                },
            )
        except jwt.PyJWTError as exc:
            raise TokenError("invalid token") from exc

        now = self._clock().timestamp()
        try:
            expires = int(claims["exp"])
            not_before = int(claims["nbf"])
            if claims["typ"] != TOKEN_TYPE:
                raise TokenError("wrong token type")
            if now > expires + LEEWAY_SECONDS or now + LEEWAY_SECONDS < not_before:
                raise TokenError("token outside its validity window")
            return TokenClaims(
                user_id=uuid.UUID(str(claims["sub"])),
                role=str(claims["role"]),
                session_version=int(claims["sv"]),
                expires_at=datetime.fromtimestamp(expires, tz=timezone.utc),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise TokenError("malformed claims") from exc
