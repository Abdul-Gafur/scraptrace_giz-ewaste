"""Programmes, facilities, receiving locations, users and role assignments."""

from __future__ import annotations

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from apps.api.app.db.base import Base, Timestamps, UuidPrimaryKey, enum_column
from apps.api.app.domain.vocabulary import (
    FACILITY_TYPES,
    FACILITY_VERIFICATION_STATUSES,
    SUPPORTED_LANGUAGES,
    USER_ROLES,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Programme(UuidPrimaryKey, Timestamps, Base):
    __tablename__ = "programmes"
    __table_args__ = (
        sa.CheckConstraint("length(currency) = 3", name="currency_length"),
        sa.CheckConstraint("length(country_code) = 2", name="country_code_length"),
        sa.CheckConstraint(
            "weight_discrepancy_threshold_percentage >= 1 "
            "AND weight_discrepancy_threshold_percentage <= 100",
            name="threshold_range",
        ),
    )

    name: Mapped[str] = mapped_column(sa.String(160), nullable=False)
    currency: Mapped[str] = mapped_column(sa.String(3), nullable=False)
    country_code: Mapped[str] = mapped_column(sa.String(2), nullable=False)
    weight_discrepancy_threshold_percentage: Mapped[float] = mapped_column(
        sa.Numeric(5, 2, asdecimal=False), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class RecyclerFacility(UuidPrimaryKey, Timestamps, Base):
    """A programme-affiliated recycling operator. Login never proves certification."""

    __tablename__ = "recycler_facilities"

    programme_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    locations: Mapped[list[FacilityLocation]] = relationship(
        back_populates="facility", lazy="raise"
    )


class FacilityLocation(UuidPrimaryKey, Timestamps, Base):
    """A receiving location operated by a facility. Its ID is the contract's
    `receiving_location_id` and `DestinationSelection.location_id`."""

    __tablename__ = "facility_locations"

    facility_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(sa.String(200), nullable=False)
    facility_type: Mapped[str] = enum_column("facility_type", FACILITY_TYPES, nullable=False)
    verification_status: Mapped[str] = enum_column(
        "verification_status", FACILITY_VERIFICATION_STATUSES, nullable=False
    )
    verification_date: Mapped[date | None] = mapped_column(sa.Date(), nullable=True)
    accepted_categories: Mapped[list[str]] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    facility: Mapped[RecyclerFacility] = relationship(back_populates="locations", lazy="raise")


class User(UuidPrimaryKey, Timestamps, Base):
    """An account. The password is stored only as an Argon2id hash."""

    __tablename__ = "users"
    __table_args__ = (
        sa.CheckConstraint("username = lower(username)", name="username_lowercase"),
        sa.CheckConstraint("session_version >= 0", name="session_version_nonnegative"),
    )

    username: Mapped[str] = mapped_column(sa.String(64), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    preferred_language: Mapped[str] = enum_column(
        "preferred_language", SUPPORTED_LANGUAGES, nullable=False, default="en"
    )
    # Incremented on sign-out; tokens carrying an older value are rejected.
    session_version: Mapped[int] = mapped_column(default=0, nullable=False)
    last_signed_in_at: Mapped[datetime | None] = mapped_column(nullable=True)

    role_assignments: Mapped[list[UserRoleAssignment]] = relationship(
        back_populates="user", lazy="raise"
    )


class UserRoleAssignment(UuidPrimaryKey, Timestamps, Base):
    """A contract role with its programme and facility scope."""

    __tablename__ = "user_roles"
    __table_args__ = (
        sa.UniqueConstraint("user_id", "role", "programme_id", "facility_id"),
        sa.CheckConstraint(
            "role <> 'recycler' OR facility_id IS NOT NULL", name="recycler_requires_facility"
        ),
        sa.CheckConstraint(
            "role IN ('safety_content_administrator', 'data_ml_reviewer') "
            "OR programme_id IS NOT NULL",
            name="programme_scope_required",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    role: Mapped[str] = enum_column("user_role", USER_ROLES, nullable=False)
    programme_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=True
    )
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("recycler_facilities.id", ondelete="RESTRICT"), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="role_assignments", lazy="raise")
