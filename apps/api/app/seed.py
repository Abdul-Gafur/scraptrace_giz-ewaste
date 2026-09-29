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
from apps.api.app.container import AppServices
from apps.api.app.core.passwords import PasswordService
from apps.api.app.db.models import (
    FacilityLocation,
    Programme,
    RecoveryRecord,
    RecyclerFacility,
    User,
    UserRoleAssignment,
)
from apps.api.app.domain.vocabulary import EWASTE_CATEGORIES
from apps.api.app.repositories.identity import IdentityRepository
from apps.api.app.services.audit import RequestContext
from apps.api.app.services.image_validation import sanitize_image_bytes
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


# Demonstration records ------------------------------------------------------------------------
#
# Records are created by replaying the real journeys through the service layer, never by
# inserting rows in a lifecycle state, so every seeded record carries the same evidence, events,
# digests and audit entries a user's actions would produce. Fixed record IDs and idempotency
# keys make re-running the command a no-op.

SEED_CAPTURED_AT = "2026-09-20T09:00:00.000Z"
SEED_HANDOFF_AT = "2026-09-21T10:30:00.000Z"


STAGE_ORDER = ("draft", "awaiting_handoff", "received", "processed", "decided")


@dataclass(frozen=True)
class SeedRecordPlan:
    record_id: uuid.UUID
    label: str
    category: str
    condition: str
    declared_weight_kg: float
    destination: uuid.UUID
    stage: str  # one of STAGE_ORDER
    item_count: int | None = 1
    measured_weight_kg: float | None = None
    materials: tuple[tuple[str, float], ...] = ()
    decision: str | None = None
    reason_code: str | None = None

    def reaches(self, stage: str) -> bool:
        return STAGE_ORDER.index(self.stage) >= STAGE_ORDER.index(stage)

    def evidence_id(self, suffix: str) -> uuid.UUID:
        """Deterministic evidence IDs that keep the record's UUIDv7 prefix."""
        return uuid.UUID(str(self.record_id)[:-12] + suffix.rjust(12, "0"))


SEED_RECORD_PLANS: tuple[SeedRecordPlan, ...] = (
    SeedRecordPlan(
        uuid.UUID("0199c001-0001-7001-8001-000000000001"),
        "draft-television",
        "televisions",
        "damaged",
        14.0,
        COLLECTION_CENTRE_ID,
        "draft",
    ),
    SeedRecordPlan(
        uuid.UUID("0199c002-0002-7002-8002-000000000002"),
        "awaiting-laptops",
        "laptops_and_desktop_computers",
        "repairable",
        9.5,
        COLLECTION_CENTRE_ID,
        "awaiting_handoff",
        item_count=3,
    ),
    SeedRecordPlan(
        uuid.UUID("0199c003-0003-7003-8003-000000000003"),
        "received-refrigerator",
        "refrigerators",
        "damaged",
        58.0,
        RECYCLER_LOCATION_ID,
        "received",
        measured_weight_kg=60.4,
    ),
    SeedRecordPlan(
        uuid.UUID("0199c004-0004-7004-8004-000000000004"),
        "discrepancy-microwave",
        "microwaves",
        "damaged",
        18.0,
        RECYCLER_LOCATION_ID,
        "processed",
        item_count=2,
        measured_weight_kg=31.0,
        materials=(("Steel casing", 14.2), ("Transformer copper", 2.6)),
    ),
    SeedRecordPlan(
        uuid.UUID("0199c005-0005-7005-8005-000000000005"),
        "completed-compressor",
        "compressors",
        "damaged",
        26.0,
        RECYCLER_LOCATION_ID,
        "processed",
        item_count=4,
        measured_weight_kg=26.8,
        materials=(("Cast steel", 19.5),),
    ),
    SeedRecordPlan(
        uuid.UUID("0199c006-0006-7006-8006-000000000006"),
        "approved-air-conditioner",
        "air_conditioners",
        "repairable",
        34.0,
        RECYCLER_LOCATION_ID,
        "decided",
        measured_weight_kg=41.0,
        materials=(("Aluminium fins", 6.4), ("Copper tubing", 3.8)),
        decision="approve",
        reason_code="EVIDENCE_SUFFICIENT",
    ),
    SeedRecordPlan(
        uuid.UUID("0199c007-0007-7007-8007-000000000007"),
        "rejected-television",
        "televisions",
        "damaged",
        22.0,
        RECYCLER_LOCATION_ID,
        "decided",
        measured_weight_kg=41.0,
        materials=(("Lead glass", 12.5),),
        decision="reject",
        reason_code="WEIGHT_UNEXPLAINED",
    ),
)

E2E_REVIEW_PLANS: tuple[SeedRecordPlan, ...] = (
    SeedRecordPlan(
        uuid.UUID("0199c008-0008-7008-8008-000000000008"),
        "e2e-correction-television",
        "televisions",
        "damaged",
        20.0,
        RECYCLER_LOCATION_ID,
        "processed",
        measured_weight_kg=40.0,
        materials=(("Lead glass", 6.5),),
    ),
    SeedRecordPlan(
        uuid.UUID("0199c009-0009-7009-8009-000000000009"),
        "e2e-rejection-television",
        "televisions",
        "damaged",
        20.0,
        RECYCLER_LOCATION_ID,
        "processed",
        measured_weight_kg=40.0,
        materials=(("Lead glass", 6.5),),
    ),
)


def seed_photo(label: str) -> bytes:
    """A deterministic synthetic image per label: stable digests, no real photograph."""
    import hashlib
    import io

    from PIL import Image, ImageDraw

    colour = hashlib.sha256(label.encode("utf-8")).digest()
    image = Image.new("RGB", (320, 240), color=(colour[0], colour[1], colour[2]))
    draw = ImageDraw.Draw(image)
    for index in range(0, 320, 20):
        draw.line([(index, 0), (320 - index, 240)], fill=(colour[3], colour[4], colour[5]), width=3)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _seed_scores(category: str) -> list[dict[str, Any]]:
    return [
        {"category": value, "score": 0.82 if value == category else 0.03}
        for value in EWASTE_CATEGORIES
    ]


def seed_draft_metadata(plan: SeedRecordPlan, collector_id: uuid.UUID) -> dict[str, Any]:
    reference = {"actor_id": str(collector_id), "programme_id": str(PROGRAMME_ID)}
    metadata: dict[str, Any] = {
        "record_id": str(plan.record_id),
        "device_instance_id": "0199b020-0020-7020-8020-000000000020",
        "category": plan.category,
        "condition": plan.condition,
        "approximate_weight": {"value": plan.declared_weight_kg, "unit": "kg"},
        "captured_at": SEED_CAPTURED_AT,
        "approximate_area": {
            "label": "Greater Accra",
            "administrative_area": "Greater Accra",
            "country_code": "GH",
        },
        "vision_result": {
            "prediction_id": _seed_prediction_id(plan.record_id),
            "model_name": "scraptrace-vision-efficientnet-b0",
            "model_version": "0.2.0",
            "inferred_at": SEED_CAPTURED_AT,
            "scores": _seed_scores(plan.category),
            "suggested_category": plan.category,
            "confidence": 0.82,
            "low_confidence": False,
        },
        "category_confirmation": {
            "confirmed_category": plan.category,
            "confirmed_by": reference,
            "confirmed_at": SEED_CAPTURED_AT,
            "source": "accepted_prediction",
        },
        "destination_location_id": str(plan.destination),
        "original_image": {
            "captured_at": SEED_CAPTURED_AT,
            "capture_source": "approved_demo_fixture",
            "connectivity": "online",
            "application_version": "0.1.0",
        },
    }
    if plan.item_count is not None:
        metadata["item_count"] = plan.item_count
    return metadata


def _seed_prediction_id(record_id: uuid.UUID) -> str:
    # Same UUIDv7 timestamp and version bits as the record, different random tail.
    text = str(record_id)
    return text[:-12] + "0000000000ff"


async def _seed_actor(services: AppServices, username: str, role: str) -> Any:
    from apps.api.app.services.authentication import build_actor

    async with services.database.session_scope() as session:
        user = await IdentityRepository(session).get_user(SEED_USER_IDS[username])
        if user is None:
            raise RuntimeError("Load reference data before demonstration records.")
        return await build_actor(session, user, role)


async def _seed_handoff(
    services: AppServices, plan: SeedRecordPlan, recycler: Any, context: RequestContext
) -> None:
    from apps.api.app.domain.integrity import sha256_canonical_json
    from apps.api.app.repositories.records import RecoveryRecordRepository
    from apps.api.app.services.evidence import EvidenceService, EvidenceUpload
    from apps.api.app.services.handoff import HandoffService

    evidence_ids = []
    for suffix, evidence_type in (("a1", "handoff_photo"), ("a2", "weight_measurement")):
        image = sanitize_image_bytes(
            seed_photo(f"{plan.label}-{evidence_type}"), services.settings, "image"
        )
        async with services.database.session_scope() as session:
            _, data = await EvidenceService(session, services, context).upload(
                plan.record_id,
                recycler,
                EvidenceUpload(
                    evidence_type=evidence_type,
                    evidence_id=plan.evidence_id(suffix),
                    captured_at=SEED_HANDOFF_AT,
                    capture_source="approved_demo_fixture",
                    device_instance_id=uuid.UUID("0199b020-0020-7020-8020-000000000021"),
                    connectivity="online",
                    application_version="0.1.0",
                ),
                image,
            )
        evidence_ids.append(data["evidence_id"])

    async with services.database.session_scope() as session:
        record = await RecoveryRecordRepository(session).get(plan.record_id)
        assert record is not None
        lookup_token = services.qr_tokens.lookup_token_for(record)
        collector = {"actor_id": str(record.collector_id), "programme_id": str(record.programme_id)}
    request: dict[str, Any] = {
        "recovery_record_id": str(plan.record_id),
        "lookup_token": lookup_token,
        "collector_reference": collector,
        "recycler_reference": recycler.reference(),
        "receiving_location_id": str(plan.destination),
        "handoff_time": SEED_HANDOFF_AT,
        "confirmed_category": plan.category,
        "confirmed_condition": plan.condition,
        "measured_weight": {"value": plan.measured_weight_kg, "unit": "kg"},
        "final_price": {
            "amount": round((plan.measured_weight_kg or 1) * 4.5, 2),
            "currency": "GHS",
        },
        "evidence_ids": evidence_ids,
    }
    request["idempotency"] = {
        "idempotency_key": f"seed-handoff-{plan.record_id}",
        "request_digest": sha256_canonical_json(request),
        "scope": {
            "actor_id": str(recycler.user_id),
            "operation": "record_handoff",
            "resource_id": str(plan.record_id),
        },
    }
    async with services.database.session_scope() as session:
        await HandoffService(session, services, context, services.lookup_limiter).record(
            recycler, request
        )


async def _seed_processing(
    services: AppServices, plan: SeedRecordPlan, recycler: Any, context: RequestContext
) -> None:
    from apps.api.app.domain.integrity import sha256_canonical_json
    from apps.api.app.domain.time import format_timestamp
    from apps.api.app.services.evidence import EvidenceService, EvidenceUpload
    from apps.api.app.services.processing import ProcessingService

    image = sanitize_image_bytes(seed_photo(f"{plan.label}-processing"), services.settings, "image")
    async with services.database.session_scope() as session:
        _, evidence = await EvidenceService(session, services, context).upload(
            plan.record_id,
            recycler,
            EvidenceUpload(
                evidence_type="processing_completion",
                evidence_id=plan.evidence_id("a3"),
                captured_at=format_timestamp(services.clock()),
                capture_source="approved_demo_fixture",
                device_instance_id=uuid.UUID("0199b020-0020-7020-8020-000000000021"),
                connectivity="online",
                application_version="0.1.0",
            ),
            image,
        )
    request: dict[str, Any] = {
        "recovery_record_id": str(plan.record_id),
        "recycler_reference": recycler.reference(),
        "processing_method": "material_recovery",
        "material_entries": [
            {"material": name, "weight": {"value": value, "unit": "kg"}}
            for name, value in plan.materials
        ],
        # Processing follows the (real-time) receipt, so it is stamped with the current time.
        "processing_timestamp": format_timestamp(services.clock()),
        "completion_evidence_ids": [evidence["evidence_id"]],
        "notes": "Material recovery recorded with weighbridge evidence.",
    }
    request["idempotency"] = {
        "idempotency_key": f"seed-processing-{plan.record_id}",
        "request_digest": sha256_canonical_json(request),
        "scope": {
            "actor_id": str(recycler.user_id),
            "operation": "record_processing",
            "resource_id": str(plan.record_id),
        },
    }
    async with services.database.session_scope() as session:
        await ProcessingService(session, services, context).submit(recycler, request)


async def _seed_decision(
    services: AppServices, plan: SeedRecordPlan, reviewer: Any, context: RequestContext
) -> None:
    from apps.api.app.domain.integrity import sha256_canonical_json
    from apps.api.app.domain.time import format_timestamp
    from apps.api.app.repositories.records import RecoveryRecordRepository
    from apps.api.app.services.reviews import ReviewService

    assert plan.decision is not None and plan.reason_code is not None
    async with services.database.session_scope() as session:
        repository = RecoveryRecordRepository(session)
        record = await repository.get(plan.record_id)
        assert record is not None and record.review_case is not None
        flags = list(record.review_case.flag_codes)
        review_state = record.review_case.status
        considered = [
            str(item.id)
            for item in await repository.list_evidence(plan.record_id)
            if item.evidence_type == "weight_measurement"
        ]
    request: dict[str, Any] = {
        "recovery_record_id": str(plan.record_id),
        "review_reason_codes": flags,
        "assigned_reviewer": reviewer.reference(),
        "evidence_considered": considered,
        "decision": plan.decision,
        "reason_code": plan.reason_code,
        "reviewer_note": "Demonstration decision recorded by the seed command.",
        "decision_timestamp": format_timestamp(services.clock()),
        "previous_review_state": review_state,
        "previous_record_state": "under_review",
    }
    request["idempotency"] = {
        "idempotency_key": f"seed-review-{plan.record_id}",
        "request_digest": sha256_canonical_json(request),
        "scope": {
            "actor_id": str(reviewer.user_id),
            "operation": "record_review_decision",
            "resource_id": str(plan.record_id),
        },
    }
    async with services.database.session_scope() as session:
        await ReviewService(session, services, context).decide(reviewer, request)


async def seed_demonstration_records(services: AppServices, *, e2e_fixtures: bool = False) -> int:
    """Drives each planned record to its target stage through the services. Records already at
    or beyond a stage are left alone. Returns how many records advanced."""
    from apps.api.app.services.records import RecordService

    context = RequestContext(correlation_id="seed-demonstration-records")
    collector = await _seed_actor(services, "collector.demo", "collector")
    recycler = await _seed_actor(services, "recycler.demo", "recycler")
    reviewer = await _seed_actor(services, "reviewer.demo", "programme_reviewer")

    advanced = 0
    for plan in SEED_RECORD_PLANS + (E2E_REVIEW_PLANS if e2e_fixtures else ()):
        async with services.database.session_scope() as session:
            existing = await session.get(RecoveryRecord, plan.record_id)
            state = existing.business_state if existing is not None else None
        before = state
        if state is None:
            image = sanitize_image_bytes(
                seed_photo(plan.label), services.settings, "original_image"
            )
            async with services.database.session_scope() as session:
                await RecordService(session, services, context).create_draft(
                    collector,
                    seed_draft_metadata(plan, collector.user_id),
                    image,
                    image.original_digest,
                    f"seed-create-{plan.record_id}",
                )
            state = "draft"
        if plan.reaches("awaiting_handoff") and state == "draft":
            async with services.database.session_scope() as session:
                await RecordService(session, services, context).submit(
                    plan.record_id, collector, None
                )
            state = "awaiting_handoff"
        if plan.reaches("received") and state == "awaiting_handoff":
            await _seed_handoff(services, plan, recycler, context)
            state = "received"
        if plan.reaches("processed") and state == "received":
            await _seed_processing(services, plan, recycler, context)
            state = "processed"
        if plan.reaches("decided") and state in ("processed", "under_review"):
            await _seed_decision(services, plan, reviewer, context)
            state = "decided"
        advanced += int(state != before)
    return advanced
