"""Declarative base, naming conventions and portable column types.

PostgreSQL is the application database. SQLite is supported only as an isolated test
substitute, so every type here behaves identically on both: UUIDs, UTC instants with
millisecond precision, JSON documents and enumerations enforced by CHECK constraints.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, ClassVar

import sqlalchemy as sa
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.time import truncate_to_milliseconds, utc_now
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class UtcDateTime(TypeDecorator[datetime]):
    """Stores aware UTC instants; rejects naive values instead of guessing a timezone."""

    impl = sa.DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes cannot be stored; use an aware UTC instant.")
        utc = truncate_to_milliseconds(value)
        # SQLite has no timezone storage; the UTC offset is re-attached on read.
        return utc.replace(tzinfo=None) if dialect.name == "sqlite" else utc

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


JsonDocument = sa.JSON().with_variant(JSONB(), "postgresql")


def enum_column(name: str, values: tuple[str, ...], **kwargs: Any) -> Mapped[Any]:
    """A VARCHAR column restricted by a named CHECK constraint to one contract vocabulary."""
    return mapped_column(
        sa.Enum(
            *values,
            name=name,
            native_enum=False,
            create_constraint=True,
            length=max(len(value) for value in values),
            validate_strings=True,
        ),
        **kwargs,
    )


class Base(DeclarativeBase):
    metadata = sa.MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map: ClassVar[dict[Any, Any]] = {
        datetime: UtcDateTime(),
        uuid.UUID: sa.Uuid(),
        dict[str, Any]: JsonDocument,
        list[Any]: JsonDocument,
        list[str]: JsonDocument,
    }


class UuidPrimaryKey:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid7)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)
