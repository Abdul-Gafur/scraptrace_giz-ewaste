"""Opaque QR lookup tokens (ADR-004, FR-REC-003).

The contract requires every `RecoveryRecord` to carry `qr_payload.lookup_token`, and a collector
must be able to present the same QR after reopening the app (FR-REC-004). The plaintext is
therefore never stored: each token row keeps only a SHA-256 digest and a random nonce, and the
token is re-derived on demand as HMAC-SHA256(server secret, token ID + nonce). A copy of the
database alone reveals no usable token, and lookups match on the digest.

A token is created with its draft but is inert until the record is published for handoff
(`activated_at`). Only activated, unexpired and unrevoked tokens resolve.
"""

from __future__ import annotations

from apps.api.app.core.config import ConfigurationError, Settings
from apps.api.app.db.models import QrLookupToken, RecoveryRecord
from apps.api.app.domain.identifiers import (
    derive_lookup_token,
    lookup_token_digest,
    new_token_nonce,
    uuid7,
)
from apps.api.app.domain.time import Clock


class QrTokenService:
    def __init__(self, settings: Settings, clock: Clock) -> None:
        self._secret_value = settings.qr_token_secret
        self._ttl_days = settings.qr_token_ttl_days
        self._clock = clock

    @property
    def _secret(self) -> bytes:
        if self._secret_value is None:
            raise ConfigurationError("Missing required configuration: SCRAPTRACE_QR_TOKEN_SECRET.")
        return self._secret_value.get_secret_value().encode("utf-8")

    def new_token(self, record: RecoveryRecord) -> QrLookupToken:
        token_id, nonce = uuid7(), new_token_nonce()
        token = derive_lookup_token(self._secret, token_id, nonce)
        return QrLookupToken(
            id=token_id,
            record_id=record.id,
            token_digest=lookup_token_digest(token),
            nonce=nonce,
        )

    def derive(self, token: QrLookupToken) -> str:
        return derive_lookup_token(self._secret, token.id, token.nonce)

    @staticmethod
    def current(record: RecoveryRecord) -> QrLookupToken:
        active = [token for token in record.qr_tokens if token.revoked_at is None]
        if len(active) != 1:
            raise RuntimeError("A recovery record must have exactly one unrevoked lookup token.")
        return active[0]

    def lookup_token_for(self, record: RecoveryRecord) -> str:
        return self.derive(self.current(record))
