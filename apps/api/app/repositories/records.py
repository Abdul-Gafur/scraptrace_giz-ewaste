"""Recovery records, lifecycle events, evidence metadata and QR lookup tokens."""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence

import sqlalchemy as sa
from apps.api.app.db.models import (
    Evidence,
    ProcessingRecord,
    QrLookupToken,
    RecoveryRecord,
    RecoveryRecordEvent,
    ReviewCase,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.interfaces import LoaderOption


def record_graph() -> tuple[LoaderOption, ...]:
    """Everything needed to render one `RecoveryRecord` contract object."""
    return (
        selectinload(RecoveryRecord.qr_tokens),
        selectinload(RecoveryRecord.handoff),
        selectinload(RecoveryRecord.processing).selectinload(ProcessingRecord.material_entries),
        selectinload(RecoveryRecord.review_case).selectinload(ReviewCase.decisions),
    )


class RecoveryRecordRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, record: RecoveryRecord) -> None:
        self.session.add(record)

    async def get(self, record_id: uuid.UUID, *, for_update: bool = False) -> RecoveryRecord | None:
        """Loads the record graph. `for_update` takes a row lock (PostgreSQL) so concurrent
        lifecycle commands on one record are serialised inside their transactions."""
        statement = sa.select(RecoveryRecord).where(RecoveryRecord.id == record_id)
        if for_update:
            statement = statement.with_for_update()
        result = await self.session.execute(
            statement.options(*record_graph()).execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def get_by_human_reference(self, reference: str) -> RecoveryRecord | None:
        result = await self.session.execute(
            sa.select(RecoveryRecord)
            .where(RecoveryRecord.human_reference == reference)
            .options(*record_graph())
        )
        return result.scalar_one_or_none()

    async def human_reference_exists(self, reference: str) -> bool:
        result = await self.session.execute(
            sa.select(sa.literal(True)).where(RecoveryRecord.human_reference == reference)
        )
        return result.scalar_one_or_none() is not None

    async def execute_listing(
        self, statement: sa.Select[tuple[RecoveryRecord]]
    ) -> list[RecoveryRecord]:
        result = await self.session.execute(statement.options(*record_graph()))
        return list(result.scalars().unique().all())

    # Lifecycle events -----------------------------------------------------------------

    def add_event(self, event: RecoveryRecordEvent) -> None:
        self.session.add(event)

    async def list_events(self, record_id: uuid.UUID) -> Sequence[RecoveryRecordEvent]:
        result = await self.session.execute(
            sa.select(RecoveryRecordEvent)
            .where(RecoveryRecordEvent.record_id == record_id)
            .order_by(RecoveryRecordEvent.occurred_at, RecoveryRecordEvent.id)
        )
        return result.scalars().all()

    # Evidence ---------------------------------------------------------------------------

    def add_evidence(self, evidence: Evidence) -> None:
        self.session.add(evidence)

    async def get_evidence(self, evidence_id: uuid.UUID) -> Evidence | None:
        return await self.session.get(Evidence, evidence_id)

    async def list_evidence(self, record_id: uuid.UUID) -> Sequence[Evidence]:
        result = await self.session.execute(
            sa.select(Evidence)
            .where(Evidence.record_id == record_id)
            .order_by(Evidence.created_at, Evidence.id)
        )
        return result.scalars().all()

    async def evidence_types(self, record_id: uuid.UUID) -> frozenset[str]:
        result = await self.session.execute(
            sa.select(Evidence.evidence_type).where(
                Evidence.record_id == record_id, Evidence.validation_status == "accepted"
            )
        )
        return frozenset(result.scalars().all())

    async def digest_used_elsewhere(
        self, digests: Iterable[str], record_id: uuid.UUID, evidence_types: Iterable[str]
    ) -> bool:
        """Whether identical evidence content is attached to another record (FR-REC-007).
        A match is a review signal, never proof of wrongdoing."""
        digest_list = list(digests)
        if not digest_list:
            return False
        result = await self.session.execute(
            sa.select(sa.func.count())
            .select_from(Evidence)
            .where(
                Evidence.content_digest.in_(digest_list),
                Evidence.record_id != record_id,
                Evidence.evidence_type.in_(list(evidence_types)),
            )
        )
        return int(result.scalar_one()) > 0

    # QR lookup tokens --------------------------------------------------------------------

    def add_qr_token(self, token: QrLookupToken) -> None:
        self.session.add(token)

    async def get_qr_token_by_digest(self, digest: str) -> QrLookupToken | None:
        result = await self.session.execute(
            sa.select(QrLookupToken).where(QrLookupToken.token_digest == digest)
        )
        return result.scalar_one_or_none()

    async def get_qr_token_by_transfer_code_digest(self, digest: str) -> QrLookupToken | None:
        result = await self.session.execute(
            sa.select(QrLookupToken).where(QrLookupToken.transfer_code_digest == digest)
        )
        return result.scalar_one_or_none()
