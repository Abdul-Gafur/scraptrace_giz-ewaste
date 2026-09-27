"""Opaque keyset cursors with a stable identifier tie-breaker.

A cursor encodes only the sort key and the last row's position. It grants nothing: every page
query re-applies the caller's authorisation filters.
"""

from __future__ import annotations

import base64
import binascii
import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from apps.api.app.core.errors import ApiError
from apps.api.app.domain.time import format_timestamp, parse_timestamp

DEFAULT_LIMIT = 25
MAXIMUM_LIMIT = 100


@dataclass(frozen=True)
class Cursor:
    value: datetime
    identifier: uuid.UUID


def _invalid() -> ApiError:
    return ApiError(
        status_code=422,
        code="VALIDATION_FAILED",
        message="The pagination cursor is invalid.",
        field_issues=[{"field": "cursor", "reason": "invalid_format"}],
    )


def encode_cursor(sort: str, value: datetime, identifier: uuid.UUID) -> str:
    raw = json.dumps({"s": sort, "v": format_timestamp(value), "i": str(identifier)})
    return base64.urlsafe_b64encode(raw.encode("utf-8")).rstrip(b"=").decode("ascii")


def decode_cursor(cursor: str | None, sort: str) -> Cursor | None:
    if cursor is None:
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        if not isinstance(data, dict) or data.get("s") != sort:
            raise _invalid()
        return Cursor(parse_timestamp(str(data["v"])), uuid.UUID(str(data["i"])))
    except (binascii.Error, UnicodeError, ValueError, KeyError, TypeError) as exc:
        raise _invalid() from exc


def keyset(
    statement: sa.Select[Any],
    column: Any,
    identifier: Any,
    descending: bool,
    cursor: Cursor | None,
) -> sa.Select[Any]:
    """Orders by (column, identifier) and continues after the cursor position."""
    if cursor is not None:
        if descending:
            statement = statement.where(
                sa.or_(
                    column < cursor.value,
                    sa.and_(column == cursor.value, identifier < cursor.identifier),
                )
            )
        else:
            statement = statement.where(
                sa.or_(
                    column > cursor.value,
                    sa.and_(column == cursor.value, identifier > cursor.identifier),
                )
            )
    if descending:
        return statement.order_by(column.desc(), identifier.desc())
    return statement.order_by(column.asc(), identifier.asc())


def page_meta(next_cursor: str | None) -> dict[str, Any]:
    return {"next_cursor": next_cursor, "has_more": next_cursor is not None}
