"""Deterministic hackathon seed data.

Seeding is an explicit command (`npm run api:db:seed`); application startup never seeds. Every
row has a fixed identifier, reused from the web application's demonstration actors
(`apps/web/src/auth/actors.ts`), so running the command again converges on the same data
instead of duplicating it. All names are fictional; no personal data is seeded.

Demo passwords are never stored in source control: the command reads one shared password from
`SCRAPTRACE_SEED_DEMO_PASSWORD`, stores only its Argon2id hash, and refuses to run in
production.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

import anyio
from apps.api.app.core.passwords import PasswordService
from apps.api.app.db.models import (
    FacilityLocation,
    Programme,
    RecyclerFacility,
    User,
    UserRoleAssignment,
)
from apps.api.app.domain.vocabulary import EWASTE_CATEGORIES
from apps.api.app.repositories.identity import IdentityRepository
from sqlalchemy.ext.asyncio import AsyncSession

PROGRAMME_ID = uuid.UUID("0199b010-0010-7010-8010-000000000010")
FACILITY_ID = uuid.UUID("0199b011-0011-7011-8011-000000000011")
OTHER_FACILITY_ID = uuid.UUID("0199b012-0012-7012-8012-000000000012")

COLLECTION_CENTRE_ID = uuid.UUID("0199b031-0031-7031-8031-000000000031")
RECYCLER_LOCATION_ID = uuid.UUID("0199b032-0032-7032-8032-000000000032")
SCRAPYARD_ID = uuid.UUID("0199b033-0033-7033-8033-000000000033")
OTHER_FACILITY_LOCATION_ID = uuid.UUID("0199b034-0034-7034-8034-000000000034")


@dataclass(frozen=True)
class SeedUser:
    user_id: uuid.UUID
    username: str
    display_name: str
    role: str
    programme_id: uuid.UUID | None
    facility_id: uuid.UUID | None = None


SEED_USERS: tuple[SeedUser, ...] = (
    SeedUser(
        uuid.UUID("0199b001-0001-7001-8001-000000000001"),
        "collector.demo",
        "Demonstration Collector",
        "collector",
        PROGRAMME_ID,
    ),
    SeedUser(
        uuid.UUID("0199b002-0002-7002-8002-000000000002"),
        "recycler.demo",
        "Demonstration Recycler",
        "recycler",
        PROGRAMME_ID,
        FACILITY_ID,
    ),
    SeedUser(
        uuid.UUID("0199b003-0003-7003-8003-000000000003"),
        "reviewer.demo",
        "Demonstration Programme Reviewer",
        "programme_reviewer",
        PROGRAMME_ID,
    ),
    SeedUser(
        uuid.UUID("0199b004-0004-7004-8004-000000000004"),
        "manager.demo",
        "Demonstration Programme Manager",
        "programme_manager",
        PROGRAMME_ID,
    ),
    SeedUser(
        uuid.UUID("0199b005-0005-7005-8005-000000000005"),
        "safety-admin.demo",
        "Demonstration Safety-Content Administrator",
        "safety_content_administrator",
        PROGRAMME_ID,
    ),
    SeedUser(
        uuid.UUID("0199b006-0006-7006-8006-000000000006"),
        "ml-reviewer.demo",
        "Demonstration Data and ML Reviewer",
        "data_ml_reviewer",
        PROGRAMME_ID,
    ),
    # Scope demonstrations: a recycler at another facility and a second collector prove that
    # facility and ownership boundaries deny access.
    SeedUser(
        uuid.UUID("0199b007-0007-7007-8007-000000000007"),
        "recycler-ashanti.demo",
        "Demonstration Recycler (Ashanti facility)",
        "recycler",
        PROGRAMME_ID,
        OTHER_FACILITY_ID,
    ),
    SeedUser(
        uuid.UUID("0199b008-0008-7008-8008-000000000008"),
        "collector-two.demo",
        "Second Demonstration Collector",
        "collector",
        PROGRAMME_ID,
    ),
)

SEED_USER_IDS = {user.username: user.user_id for user in SEED_USERS}


def _locations() -> tuple[dict[str, Any], ...]:
    return (
        {
            "id": COLLECTION_CENTRE_ID,
            "facility_id": FACILITY_ID,
            "name": "Accra Central Collection Centre",
            "facility_type": "collection_centre",
            "verification_status": "programme_verified",
            "verification_date": date(2026, 8, 14),
            "accepted_categories": list(EWASTE_CATEGORIES),
        },
        {
            "id": RECYCLER_LOCATION_ID,
            "facility_id": FACILITY_ID,
            "name": "Tema Licensed Recycling Works",
            "facility_type": "recycler",
            "verification_status": "programme_verified",
            "verification_date": date(2026, 7, 2),
            "accepted_categories": [
                "refrigerators",
                "air_conditioners",
                "compressors",
                "televisions",
                "mixed_scrap",
            ],
        },
        {
            "id": SCRAPYARD_ID,
            "facility_id": FACILITY_ID,
            "name": "Kaneshie Scrap Yard",
            "facility_type": "scrapyard",
            "verification_status": "unverified",
            "verification_date": None,
            "accepted_categories": ["mixed_scrap", "laptops_and_desktop_computers", "microwaves"],
        },
        {
            "id": OTHER_FACILITY_LOCATION_ID,
            "facility_id": OTHER_FACILITY_ID,
            "name": "Kumasi Materials Recovery Works",
            "facility_type": "recycler",
            "verification_status": "programme_verified",
            "verification_date": date(2026, 6, 20),
            "accepted_categories": list(EWASTE_CATEGORIES),
        },
    )


@dataclass
class SeedReport:
    created: int = 0
    unchanged: int = 0
    passwords_reset: int = 0


async def _ensure(
    session: AsyncSession, model: type[Any], values: dict[str, Any], report: SeedReport
) -> Any:
    existing = await session.get(model, values["id"])
    if existing is not None:
        report.unchanged += 1
        return existing
    entity = model(**values)
    session.add(entity)
    report.created += 1
    return entity


async def seed_reference_data(
    session: AsyncSession,
    passwords: PasswordService,
    demo_password: str,
    *,
    reset_passwords: bool = False,
) -> SeedReport:
    """Creates the programme, two facilities with receiving locations, and one account for every
    role (plus two scope-demonstration accounts). Existing rows are left unchanged."""
    report = SeedReport()
    identity = IdentityRepository(session)
    password_hash = await anyio.to_thread.run_sync(passwords.hash, demo_password)

    await _ensure(
        session,
        Programme,
        {
            "id": PROGRAMME_ID,
            "name": "ScrapTrace Demonstration Programme",
            "currency": "GHS",
            "country_code": "GH",
            "weight_discrepancy_threshold_percentage": 15.0,
        },
        report,
    )
    await session.flush()
    for facility_id, name in (
        (FACILITY_ID, "Greater Accra Recovery Operator"),
        (OTHER_FACILITY_ID, "Ashanti Recovery Operator"),
    ):
        await _ensure(
            session,
            RecyclerFacility,
            {"id": facility_id, "programme_id": PROGRAMME_ID, "name": name},
            report,
        )
    await session.flush()
    for location in _locations():
        await _ensure(session, FacilityLocation, location, report)
    await session.flush()

    for seed_user in SEED_USERS:
        user = await session.get(User, seed_user.user_id)
        if user is None:
            session.add(
                User(
                    id=seed_user.user_id,
                    username=seed_user.username,
                    display_name=seed_user.display_name,
                    password_hash=password_hash,
                    preferred_language="en",
                )
            )
            report.created += 1
        else:
            report.unchanged += 1
            if reset_passwords:
                user.password_hash = password_hash
                user.session_version += 1
                report.passwords_reset += 1
        await session.flush()
        assignment = await identity.get_role_assignment(
            seed_user.user_id, seed_user.role, seed_user.programme_id, seed_user.facility_id
        )
        if assignment is None:
            session.add(
                UserRoleAssignment(
                    user_id=seed_user.user_id,
                    role=seed_user.role,
                    programme_id=seed_user.programme_id,
                    facility_id=seed_user.facility_id,
                )
            )
            report.created += 1
        else:
            report.unchanged += 1
    await session.flush()
    return report
