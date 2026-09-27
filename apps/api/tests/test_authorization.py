"""Authorisation: contract parity, role and permission gates, and programme, facility,
ownership and review scope."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from apps.api.app.api.security import require_permission, require_roles
from apps.api.app.core.config import Settings
from apps.api.app.db.models import AuditEvent
from apps.api.app.domain.permissions import (
    ROLE_PERMISSIONS,
    AuthorizationContext,
    is_permission_allowed,
)
from apps.api.app.domain.vocabulary import PERMISSIONS, USER_ROLES
from apps.api.app.main import create_app
from apps.api.app.seed import FACILITY_ID, OTHER_FACILITY_ID, PROGRAMME_ID
from apps.api.app.services.authorization import Actor, RecordScope, context_for
from apps.api.tests.conftest import FakePredictor
from apps.api.tests.support.api import auth, query, seed_database
from apps.api.tests.support.contracts_bridge import evaluate
from fastapi import Depends
from fastapi.testclient import TestClient

CONTEXT_KEYS = (
    "owns_resource",
    "assigned_programme",
    "assigned_facility",
    "assigned_review",
    "personal_data_required",
)


def test_permission_function_matches_typescript_on_every_input() -> None:
    result = evaluate({"permissions": True})
    assert tuple(result["keys"]) == CONTEXT_KEYS
    mismatches = []
    for role, permission, bits, allowed in result["table"]:
        context = AuthorizationContext(
            **{key: bool(bits & (1 << index)) for index, key in enumerate(CONTEXT_KEYS)}
        )
        if is_permission_allowed(role, permission, context) != allowed:
            mismatches.append((role, permission, bits))
    assert mismatches == []
    assert len(result["table"]) == len(USER_ROLES) * len(PERMISSIONS) * 32


def test_unknown_role_or_permission_is_denied() -> None:
    everything = AuthorizationContext(True, True, True, True, False)
    assert not is_permission_allowed("system", "review:approve", everything)
    assert not is_permission_allowed("collector", "recovery_record:delete", everything)


@pytest.mark.parametrize(
    ("role", "forbidden"),
    [
        ("safety_content_administrator", "recovery_record:view_operational"),
        ("safety_content_administrator", "review:approve"),
        ("data_ml_reviewer", "recovery_record:view_operational"),
        ("data_ml_reviewer", "handoff:record"),
        ("programme_manager", "review:approve"),
        ("recycler", "review:approve"),
        ("collector", "handoff:record"),
    ],
)
def test_separated_roles_hold_no_foreign_permissions(role: str, forbidden: str) -> None:
    assert forbidden not in ROLE_PERMISSIONS[role]


def _actor(role: str, **overrides: object) -> Actor:
    values: dict[str, object] = {
        "user_id": uuid.uuid4(),
        "username": f"{role}.test",
        "display_name": role,
        "role": role,
        "programme_ids": frozenset({PROGRAMME_ID}),
        "facility_ids": frozenset(),
        "location_ids": frozenset(),
        "session_version": 0,
        "preferred_language": "en",
    }
    values.update(overrides)
    return Actor(**values)  # type: ignore[arg-type]


LOCATION = uuid.uuid4()
OTHER_LOCATION = uuid.uuid4()


def _scope(**overrides: object) -> RecordScope:
    values: dict[str, object] = {
        "record_id": uuid.uuid4(),
        "collector_id": uuid.uuid4(),
        "programme_id": PROGRAMME_ID,
        "location_id": LOCATION,
        "business_state": "awaiting_handoff",
    }
    values.update(overrides)
    return RecordScope(**values)  # type: ignore[arg-type]


def test_collector_ownership_is_required() -> None:
    owner = _actor("collector")
    own = context_for(owner, _scope(collector_id=owner.user_id))
    foreign = context_for(owner, _scope())
    assert is_permission_allowed("collector", "recovery_record:view_own", own)
    assert not is_permission_allowed("collector", "recovery_record:view_own", foreign)
    assert not is_permission_allowed("collector", "recovery_record:correct_own", foreign)


def test_recycler_facility_scope_is_strict_except_for_handoff() -> None:
    recycler = _actor(
        "recycler", facility_ids=frozenset({FACILITY_ID}), location_ids=frozenset({LOCATION})
    )
    permission = "recovery_record:view_operational"
    assert is_permission_allowed("recycler", permission, context_for(recycler, _scope()))
    other = _scope(location_id=OTHER_LOCATION)
    assert not is_permission_allowed("recycler", permission, context_for(recycler, other))
    unassigned = _scope(location_id=None)
    assert not is_permission_allowed("recycler", permission, context_for(recycler, unassigned))
    lenient = context_for(recycler, unassigned, facility_mode="lenient")
    assert is_permission_allowed("recycler", "handoff:record", lenient)
    foreign_programme = _scope(programme_id=uuid.uuid4())
    assert not is_permission_allowed(
        "recycler", permission, context_for(recycler, foreign_programme)
    )


def test_recycler_never_receives_personal_data() -> None:
    recycler = _actor(
        "recycler", facility_ids=frozenset({FACILITY_ID}), location_ids=frozenset({LOCATION})
    )
    context = context_for(recycler, _scope(), personal_data_required=True)
    assert not is_permission_allowed("recycler", "recovery_record:view_operational", context)


def test_reviewer_decisions_need_programme_and_assignment() -> None:
    reviewer = _actor("programme_reviewer")
    assert is_permission_allowed(
        "programme_reviewer", "review:approve", context_for(reviewer, _scope())
    )
    assigned_elsewhere = _scope(assigned_reviewer_id=uuid.uuid4())
    assert not is_permission_allowed(
        "programme_reviewer", "review:approve", context_for(reviewer, assigned_elsewhere)
    )
    other_programme = _scope(programme_id=uuid.uuid4())
    assert not is_permission_allowed(
        "programme_reviewer", "review:approve", context_for(reviewer, other_programme)
    )


def test_manager_is_limited_to_programme_scope() -> None:
    manager = _actor("programme_manager")
    assert is_permission_allowed(
        "programme_manager", "programme_report:view", context_for(manager, _scope())
    )
    assert not is_permission_allowed(
        "programme_manager",
        "programme_report:view",
        context_for(manager, _scope(programme_id=uuid.uuid4())),
    )


@pytest.fixture
def gated(api_settings: Settings) -> Iterator[TestClient]:
    """An application with two probe routes guarded by the reusable dependencies."""
    seed_database(api_settings)
    application = create_app(settings=api_settings, predictor=FakePredictor())

    @application.get(
        "/v1/probe/approve", dependencies=[Depends(require_permission("review:approve"))]
    )
    async def approve_probe() -> dict[str, bool]:
        return {"allowed": True}

    @application.get("/v1/probe/recyclers", dependencies=[Depends(require_roles("recycler"))])
    async def recycler_probe() -> dict[str, bool]:
        return {"allowed": True}

    with TestClient(application) as client:
        yield client


async def _denials(session: sa.ext.asyncio.AsyncSession) -> list[AuditEvent]:
    result = await session.execute(
        sa.select(AuditEvent).where(AuditEvent.action == "authorization.denied")
    )
    return list(result.scalars().all())


@pytest.mark.parametrize(
    ("username", "status"),
    [
        ("reviewer.demo", 200),
        ("collector.demo", 403),
        ("recycler.demo", 403),
        ("manager.demo", 403),
        ("safety-admin.demo", 403),
        ("ml-reviewer.demo", 403),
    ],
)
def test_permission_dependency_denies_other_roles(
    gated: TestClient, api_settings: Settings, username: str, status: int
) -> None:
    response = gated.get("/v1/probe/approve", headers=auth(gated, username))
    assert response.status_code == status
    if status == 403:
        assert response.json()["error"]["code"] == "PERMISSION_DENIED"
        denials = query(api_settings, _denials)
        assert denials and denials[-1].details == {
            "permission": "review:approve",
            "reason": "role",
        }


def test_role_dependency_admits_only_listed_roles(gated: TestClient) -> None:
    assert gated.get("/v1/probe/recyclers", headers=auth(gated, "recycler.demo")).status_code == 200
    assert (
        gated.get("/v1/probe/recyclers", headers=auth(gated, "collector.demo")).status_code == 403
    )


def test_programme_scope(api: TestClient, api_settings: Settings) -> None:
    headers = auth(api, "reviewer.demo")
    own = api.get(f"/v1/programmes/{PROGRAMME_ID}", headers=headers)
    assert own.status_code == 200
    assert own.json()["data"]["currency"] == "GHS"
    unknown = api.get("/v1/programmes/0199b0ff-00ff-70ff-80ff-0000000000ff", headers=headers)
    assert unknown.status_code == 404
    assert any(
        event.details.get("reason") == "programme_scope" for event in query(api_settings, _denials)
    )


@pytest.mark.parametrize(
    ("username", "facility", "status"),
    [
        ("recycler.demo", FACILITY_ID, 200),
        ("recycler.demo", OTHER_FACILITY_ID, 404),
        ("recycler-ashanti.demo", OTHER_FACILITY_ID, 200),
        ("recycler-ashanti.demo", FACILITY_ID, 404),
        ("manager.demo", OTHER_FACILITY_ID, 200),
        ("reviewer.demo", FACILITY_ID, 200),
        ("collector.demo", FACILITY_ID, 404),
        ("safety-admin.demo", FACILITY_ID, 404),
        ("ml-reviewer.demo", FACILITY_ID, 404),
    ],
)
def test_facility_scope(api: TestClient, username: str, facility: uuid.UUID, status: int) -> None:
    response = api.get(
        f"/v1/facilities/{facility}/receiving-locations", headers=auth(api, username)
    )
    assert response.status_code == status
    if status == 200:
        assert {location["facility_id"] for location in response.json()["data"]} == {str(facility)}
