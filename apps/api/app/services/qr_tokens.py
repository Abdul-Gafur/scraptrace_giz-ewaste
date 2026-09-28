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

import uuid
from dataclasses import dataclass
from datetime import timedelta

from apps.api.app.core.config import ConfigurationError, Settings
from apps.api.app.db.models import QrLookupToken, RecoveryRecord
from apps.api.app.domain.identifiers import (
    LOOKUP_TOKEN_PATTERN,
    UUID_V7_PATTERN,
    derive_lookup_token,
    lookup_token_digest,
    new_token_nonce,
    uuid7,
)
from apps.api.app.domain.time import Clock
from apps.api.app.domain.vocabulary import CONTRACT_SCHEMA_VERSION

# The web application's QR symbol text (apps/web/src/services/domain/qr-payload.ts):
# SCRAPTRACE:<contract version>:<record id>:<lookup token>. It carries exactly the three
# QrPayload fields and nothing else.
QR_TEXT_PREFIX = "SCRAPTRACE"


class UnsupportedQrVersion(ValueError):
    """The QR payload names a contract version this API does not support."""


class MalformedQr(ValueError):
    """The QR payload is not a ScrapTrace payload."""


@dataclass(frozen=True)
class Presented:
    lookup_token: str
    record_id: uuid.UUID | None


def parse_qr_payload(contract_version: str, record_id: str, lookup_token: str) -> Presented:
    if contract_version != CONTRACT_SCHEMA_VERSION:
        raise UnsupportedQrVersion(contract_version)
    if UUID_V7_PATTERN.fullmatch(record_id) is None:
        raise MalformedQr("record id")
    if LOOKUP_TOKEN_PATTERN.fullmatch(lookup_token) is None:
        raise MalformedQr("token")
    return Presented(lookup_token=lookup_token, record_id=uuid.UUID(record_id))


def parse_qr_text(text: str) -> Presented:
    parts = text.strip().split(":")
    if len(parts) != 4 or parts[0] != QR_TEXT_PREFIX:
        raise MalformedQr("shape")
    return parse_qr_payload(parts[1], parts[2], parts[3])


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

    def activate(self, token: QrLookupToken) -> None:
        """Makes the token resolvable once its record is eligible for handoff."""
        now = self._clock()
        token.activated_at = now
        token.expires_at = now + timedelta(days=self._ttl_days)

    def rotate(self, record: RecoveryRecord) -> QrLookupToken:
        """Revokes the current token and issues an activated replacement (for a lost, shared or
        expired QR). The caller adds the new row and flushes the revocation first."""
        current = self.current(record)
        current.revoked_at = self._clock()
        replacement = self.new_token(record)
        self.activate(replacement)
        return replacement

    def usable(self, token: QrLookupToken) -> bool:
        now = self._clock()
        return (
            token.activated_at is not None
            and token.revoked_at is None
            and (token.expires_at is None or token.expires_at > now)
        )

    @staticmethod
    def digest(presented_token: str) -> str:
        return lookup_token_digest(presented_token)
