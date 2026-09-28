"""Handoffs, processing records, material entries, review cases and decisions."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from apps.api.app.db.models import (
    Handoff,
    ProcessingRecord,
    RecoveredMaterialEntry,
    ReviewCase,
    ReviewDecision,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class WorkflowRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, entity: object) -> None:
        self.session.add(entity)

    async def delete(self, entity: object) -> None:
        await self.session.delete(entity)

    async def get_handoff_for_record(self, record_id: uuid.UUID) -> Handoff | None:
        result = await self.session.execute(
            sa.select(Handoff).where(Handoff.record_id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_processing_for_record(self, record_id: uuid.UUID) -> ProcessingRecord | None:
        result = await self.session.execute(
            sa.select(ProcessingRecord)
            .where(ProcessingRecord.record_id == record_id)
            .options(selectinload(ProcessingRecord.material_entries))
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def get_material_entry(self, entry_id: uuid.UUID) -> RecoveredMaterialEntry | None:
        return await self.session.get(RecoveredMaterialEntry, entry_id)

    async def get_review_case(self, case_id: uuid.UUID) -> ReviewCase | None:
        result = await self.session.execute(
            sa.select(ReviewCase)
            .where(ReviewCase.id == case_id)
            .options(selectinload(ReviewCase.decisions))
        )
        return result.scalar_one_or_none()

    async def get_review_case_for_record(self, record_id: uuid.UUID) -> ReviewCase | None:
        result = await self.session.execute(
            sa.select(ReviewCase)
            .where(ReviewCase.record_id == record_id)
            .options(selectinload(ReviewCase.decisions))
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def execute_review_listing(
        self, statement: sa.Select[tuple[ReviewCase]]
    ) -> Sequence[ReviewCase]:
        result = await self.session.execute(statement.options(selectinload(ReviewCase.decisions)))
        return result.scalars().unique().all()

    async def list_decisions(self, case_id: uuid.UUID) -> Sequence[ReviewDecision]:
        result = await self.session.execute(
            sa.select(ReviewDecision)
            .where(ReviewDecision.review_case_id == case_id)
            .order_by(ReviewDecision.recorded_at, ReviewDecision.id)
        )
        return result.scalars().all()
