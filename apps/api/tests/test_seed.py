"""The explicit seed command is repeatable and produces workflow-ready demonstration data."""

from __future__ import annotations

import asyncio

import pytest
import sqlalchemy as sa
from apps.api.app.cli import main, run_seed
from apps.api.app.core.config import Settings, get_settings
from apps.api.app.db.models import RecoveryRecord, RecoveryRecordEvent, User
from apps.api.app.seed import SEED_RECORD_PLANS
from apps.api.tests.support.api import DEMO_PASSWORD, query


async def _snapshot(session: sa.ext.asyncio.AsyncSession) -> dict[str, object]:
    records = (
        await session.execute(sa.select(RecoveryRecord.id, RecoveryRecord.business_state))
    ).all()
    events = await session.scalar(sa.select(sa.func.count()).select_from(RecoveryRecordEvent))
    users = await session.scalar(sa.select(sa.func.count()).select_from(User))
    return {
        "records": sorted((str(r.id), r.business_state) for r in records),
        "events": events,
        "users": users,
    }


def test_seed_is_repeatable(api_settings: Settings) -> None:
    first_message = asyncio.run(run_seed(api_settings, DEMO_PASSWORD, False))
    first = query(api_settings, _snapshot)
    second_message = asyncio.run(run_seed(api_settings, DEMO_PASSWORD, False))
    second = query(api_settings, _snapshot)
    assert first == second
    assert f"{len(SEED_RECORD_PLANS)} demonstration records advanced" in first_message
    assert "0 reference rows created" in second_message
    assert "0 demonstration records advanced" in second_message
    expected = {
        "draft-television": "draft",
        "awaiting-laptops": "awaiting_handoff",
        "received-refrigerator": "received",
        "discrepancy-microwave": "under_review",
        "completed-compressor": "approved_and_completed",
        "approved-air-conditioner": "approved_and_completed",
        "rejected-television": "rejected",
    }
    assert first["records"] == sorted(
        (str(plan.record_id), expected[plan.label]) for plan in SEED_RECORD_PLANS
    )


def test_seeded_discrepancy_opens_a_review_case(api_settings: Settings) -> None:
    from apps.api.app.db.models import ReviewCase

    asyncio.run(run_seed(api_settings, DEMO_PASSWORD, False))

    async def cases(session: sa.ext.asyncio.AsyncSession) -> list[tuple[str, list[str]]]:
        result = await session.execute(sa.select(ReviewCase.status, ReviewCase.flag_codes))
        return sorted((row.status, row.flag_codes) for row in result)

    # The three seeded discrepancies: one awaiting review, one approved, one rejected. The
    # refrigerator's 4% difference is inside the 15% threshold and raises no flag.
    assert query(api_settings, cases) == [
        ("approved", ["WEIGHT_DISCREPANCY"]),
        ("open", ["WEIGHT_DISCREPANCY"]),
        ("rejected", ["WEIGHT_DISCREPANCY"]),
    ]


def test_seed_refuses_production_and_weak_passwords(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("SCRAPTRACE_DATABASE_URL", "postgresql+asyncpg://u@127.0.0.1:1/none")
    monkeypatch.setenv("SCRAPTRACE_AUTH_TOKEN_SECRET", "a" * 40)
    monkeypatch.setenv("SCRAPTRACE_QR_TOKEN_SECRET", "b" * 40)
    try:
        monkeypatch.setenv("SCRAPTRACE_SEED_DEMO_PASSWORD", "short")
        assert main(["seed"]) == 2
        assert "at least 12 characters" in capsys.readouterr().err
        get_settings.cache_clear()
        monkeypatch.setenv("SCRAPTRACE_ENVIRONMENT", "production")
        monkeypatch.setenv("SCRAPTRACE_SEED_DEMO_PASSWORD", DEMO_PASSWORD)
        assert main(["seed"]) == 2
        assert "Refusing" in capsys.readouterr().err
    finally:
        get_settings.cache_clear()
