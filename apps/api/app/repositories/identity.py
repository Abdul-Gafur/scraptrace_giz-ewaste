"""Users, role assignments, programmes, facilities and receiving locations."""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence

import sqlalchemy as sa
from apps.api.app.db.models import (
    FacilityLocation,
    Programme,
    RecyclerFacility,
    User,
    UserRoleAssignment,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class IdentityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(
            sa.select(User).where(User.id == user_id).options(selectinload(User.role_assignments))
        )
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> User | None:
        result = await self.session.execute(
            sa.select(User)
            .where(User.username == username.strip().lower())
            .options(selectinload(User.role_assignments))
        )
        return result.scalar_one_or_none()

    async def list_active_users(self) -> Sequence[User]:
        result = await self.session.execute(
            sa.select(User)
            .where(User.is_active.is_(True))
            .options(selectinload(User.role_assignments))
            .order_by(User.username)
        )
        return result.scalars().all()

    async def get_programme(self, programme_id: uuid.UUID) -> Programme | None:
        return await self.session.get(Programme, programme_id)

    async def get_facility(self, facility_id: uuid.UUID) -> RecyclerFacility | None:
        return await self.session.get(RecyclerFacility, facility_id)

    async def get_location(self, location_id: uuid.UUID) -> FacilityLocation | None:
        result = await self.session.execute(
            sa.select(FacilityLocation)
            .where(FacilityLocation.id == location_id)
            .options(selectinload(FacilityLocation.facility))
        )
        return result.scalar_one_or_none()

    async def location_ids_for_facilities(
        self, facility_ids: Iterable[uuid.UUID]
    ) -> frozenset[uuid.UUID]:
        ids = list(facility_ids)
        if not ids:
            return frozenset()
        result = await self.session.execute(
            sa.select(FacilityLocation.id).where(
                FacilityLocation.facility_id.in_(ids), FacilityLocation.is_active.is_(True)
            )
        )
        return frozenset(result.scalars().all())

    def add(self, entity: object) -> None:
        self.session.add(entity)

    async def get_role_assignment(
        self,
        user_id: uuid.UUID,
        role: str,
        programme_id: uuid.UUID | None,
        facility_id: uuid.UUID | None,
    ) -> UserRoleAssignment | None:
        result = await self.session.execute(
            sa.select(UserRoleAssignment).where(
                UserRoleAssignment.user_id == user_id,
                UserRoleAssignment.role == role,
                UserRoleAssignment.programme_id.is_(None)
                if programme_id is None
                else UserRoleAssignment.programme_id == programme_id,
                UserRoleAssignment.facility_id.is_(None)
                if facility_id is None
                else UserRoleAssignment.facility_id == facility_id,
            )
        )
        return result.scalar_one_or_none()
