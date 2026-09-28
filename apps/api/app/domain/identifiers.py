"""Identifier factories and formats (ADR-004).

Record, event, evidence and mutation identifiers are RFC 9562 UUIDv7 values. Human references
are display-only, and QR lookup tokens are opaque: they carry no record identifier and no
personal data.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import time
import uuid

UUID_V7_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
HUMAN_REFERENCE_PATTERN = re.compile(r"^ST-[A-Z0-9]{8,16}$")
LOOKUP_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{24,160}$")
IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{16,128}$")

_BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
_LOOKUP_TOKEN_CONTEXT = b"scraptrace:qr-lookup-token:v1:"


def uuid7() -> uuid.UUID:
    """A UUIDv7: 48-bit Unix milliseconds followed by 74 random bits."""
    milliseconds = time.time_ns() // 1_000_000
    raw = bytearray(milliseconds.to_bytes(6, "big") + secrets.token_bytes(10))
    raw[6] = (raw[6] & 0x0F) | 0x70
    raw[8] = (raw[8] & 0x3F) | 0x80
    return uuid.UUID(bytes=bytes(raw))


def is_uuid7(value: str) -> bool:
    return UUID_V7_PATTERN.fullmatch(value) is not None


def parse_uuid7(value: str) -> uuid.UUID:
    if not is_uuid7(value):
        raise ValueError("Expected a lowercase RFC 9562 UUIDv7.")
    return uuid.UUID(value)


def new_human_reference() -> str:
    """`ST-` plus ten base32 characters; unique in storage, never used for authorisation."""
    return "ST-" + "".join(secrets.choice(_BASE32_ALPHABET) for _ in range(10))


def normalize_transfer_code(value: str) -> str:
    return re.sub(r"\s+", "", value).upper()


def new_token_nonce() -> bytes:
    return secrets.token_bytes(16)


def derive_lookup_token(secret: bytes, token_id: uuid.UUID, nonce: bytes) -> str:
    """Derives the opaque QR lookup token.

    The database keeps only the token digest and this nonce. The plaintext token can be
    re-derived for the owning collector with the server-held secret, so a database copy on its
    own reveals no usable token.
    """
    mac = hmac.new(secret, _LOOKUP_TOKEN_CONTEXT + token_id.bytes + nonce, hashlib.sha256)
    return base64.urlsafe_b64encode(mac.digest()).rstrip(b"=").decode("ascii")


def lookup_token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()
