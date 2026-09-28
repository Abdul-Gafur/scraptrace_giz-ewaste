"""UTC instants with the contract's millisecond wire format."""

from __future__ import annotations

import re
from collections.abc import Callable
from datetime import datetime, timezone

UTC_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$")

Clock = Callable[[], datetime]


def truncate_to_milliseconds(value: datetime) -> datetime:
    """Stored instants keep millisecond precision so they round-trip through the wire format
    unchanged, which keeps integrity digests stable across reads."""
    if value.tzinfo is None:
        raise ValueError("Naive datetimes are not accepted; use an aware UTC instant.")
    utc = value.astimezone(timezone.utc)
    return utc.replace(microsecond=(utc.microsecond // 1000) * 1000)


def utc_now() -> datetime:
    return truncate_to_milliseconds(datetime.now(timezone.utc))


def format_timestamp(value: datetime) -> str:
    """`YYYY-MM-DDTHH:MM:SS.mmmZ`, matching `UtcTimestampSchema`."""
    utc = truncate_to_milliseconds(value)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


def parse_timestamp(value: str) -> datetime:
    """Parses a contract UTC timestamp and rejects impossible calendar instants."""
    if not UTC_TIMESTAMP_PATTERN.fullmatch(value):
        raise ValueError("Expected an ISO 8601 UTC timestamp ending in Z.")
    parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    return truncate_to_milliseconds(parsed)
