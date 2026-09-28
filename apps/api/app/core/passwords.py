"""Argon2id password hashing.

Hashing is CPU-bound, so callers on the event loop run these functions in a worker thread.
Plaintext passwords are never stored or logged.
"""

from __future__ import annotations

from apps.api.app.core.config import Settings
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

MINIMUM_PASSWORD_LENGTH = 12
MAXIMUM_PASSWORD_LENGTH = 256


class PasswordService:
    def __init__(self, settings: Settings) -> None:
        self._hasher = PasswordHasher(
            time_cost=settings.password_hash_time_cost,
            memory_cost=settings.password_hash_memory_cost_kib,
            parallelism=settings.password_hash_parallelism,
        )
        # Verifying against this hash when an account does not exist keeps the failure path's
        # cost close to the success path's, so response timing does not reveal usernames.
        self._decoy_hash = self._hasher.hash("scraptrace-decoy-password-for-timing-only")

    def hash(self, password: str) -> str:
        if not MINIMUM_PASSWORD_LENGTH <= len(password) <= MAXIMUM_PASSWORD_LENGTH:
            raise ValueError(
                f"Passwords must contain {MINIMUM_PASSWORD_LENGTH} to "
                f"{MAXIMUM_PASSWORD_LENGTH} characters."
            )
        return self._hasher.hash(password)

    def verify(self, password_hash: str | None, password: str) -> bool:
        target = password_hash if password_hash is not None else self._decoy_hash
        try:
            verified = self._hasher.verify(target, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False
        return verified and password_hash is not None

    def needs_rehash(self, password_hash: str) -> bool:
        return self._hasher.check_needs_rehash(password_hash)
