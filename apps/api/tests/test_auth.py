"""Authentication: sign-in, tokens, sessions, cookies, rate limiting and audit."""

from __future__ import annotations

import time
from datetime import timedelta

import jwt
import pytest
import sqlalchemy as sa
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.core.config import Settings
from apps.api.app.core.tokens import TokenService
from apps.api.app.db.models import AuditEvent, User
from apps.api.app.domain.permissions import ROLE_PERMISSIONS
from apps.api.app.domain.time import utc_now
from apps.api.app.main import create_app
from apps.api.app.seed import SEED_USER_IDS, SEED_USERS
from apps.api.tests.conftest import TEST_AUTH_SECRET, FakePredictor, build_settings, image_bytes
from apps.api.tests.support.api import (
    ALLOWED_ORIGIN,
    DEMO_PASSWORD,
    auth,
    query,
    seed_database,
    session_token,
    sign_in,
)
from fastapi.testclient import TestClient

ROLES = {user.username: user.role for user in SEED_USERS}


async def _audit_actions(session: sa.ext.asyncio.AsyncSession) -> list[tuple[str, str]]:
    result = await session.execute(
        sa.select(AuditEvent.action, AuditEvent.outcome).order_by(AuditEvent.occurred_at)
    )
    return [(row.action, row.outcome) for row in result]


@pytest.mark.parametrize("username", [user.username for user in SEED_USERS])
def test_every_seeded_role_can_sign_in(api: TestClient, username: str) -> None:
    response = api.post("/v1/auth/sessions", json={"username": username, "password": DEMO_PASSWORD})
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True and body["contract_version"] == "1.0.0"
    data = body["data"]
    # The credential is delivered only in the HttpOnly cookie, never in a readable body.
    assert set(data) == {"expires_at", "user"}
    assert REGISTRY.errors("session_created", data) == []
    assert data["user"]["role"] == ROLES[username]
    assert data["user"]["permissions"] == sorted(ROLE_PERMISSIONS[ROLES[username]])
    assert data["user"]["user_id"] == str(SEED_USER_IDS[username])
    assert "password" not in response.text and "$argon2" not in response.text
    cookie = response.headers["set-cookie"]
    assert "scraptrace_session=" in cookie
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie

    token = response.cookies.get("scraptrace_session")
    assert token and token not in response.text
    me = api.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"] == data["user"]


def test_all_six_contract_roles_are_represented(api: TestClient) -> None:
    roles = {sign_in(api, user.username)["user"]["role"] for user in SEED_USERS}
    assert roles == set(ROLE_PERMISSIONS)


def test_recycler_session_exposes_facility_scope(api: TestClient) -> None:
    user = sign_in(api, "recycler.demo")["user"]
    assert user["facility_ids"] == ["0199b011-0011-7011-8011-000000000011"]
    assert len(user["receiving_location_ids"]) == 3
    assert user["actor_reference"]["facility_id"] == "0199b011-0011-7011-8011-000000000011"


@pytest.mark.parametrize(
    ("username", "password"),
    [("collector.demo", "wrong-password-value"), ("nobody.demo", DEMO_PASSWORD)],
)
def test_invalid_credentials_fail_with_one_safe_message(
    api: TestClient, api_settings: Settings, username: str, password: str
) -> None:
    response = api.post("/v1/auth/sessions", json={"username": username, "password": password})
    assert response.status_code == 401
    error = response.json()["error"]
    assert error == {
        "code": "AUTHENTICATION_REQUIRED",
        "message": "The username or password is incorrect.",
        "retryable": False,
    }
    assert username not in response.text
    assert "set-cookie" not in response.headers
    assert ("auth.sign-in.failed", "failed") in query(api_settings, _audit_actions)


def test_successful_sign_in_is_audited(api: TestClient, api_settings: Settings) -> None:
    sign_in(api, "reviewer.demo")
    assert ("auth.sign-in.succeeded", "succeeded") in query(api_settings, _audit_actions)


def test_repeated_failures_are_rate_limited(database_url: str) -> None:
    settings = build_settings(database_url, sign_in_rate_limit_attempts=3)
    seed_database(settings)
    with TestClient(create_app(settings=settings, predictor=FakePredictor())) as client:
        for _ in range(3):
            failed = client.post(
                "/v1/auth/sessions", json={"username": "collector.demo", "password": "wrong-1234"}
            )
            assert failed.status_code == 401
        blocked = client.post(
            "/v1/auth/sessions", json={"username": "collector.demo", "password": DEMO_PASSWORD}
        )
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMIT_REACHED"
    assert blocked.json()["error"]["retryable"] is True
    assert int(blocked.headers["retry-after"]) > 0


def test_sign_in_rejects_unknown_fields(api: TestClient) -> None:
    response = api.post(
        "/v1/auth/sessions",
        json={"username": "collector.demo", "password": DEMO_PASSWORD, "role": "recycler"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_FAILED"


def _forge(claims_override: dict[str, object], secret: str = TEST_AUTH_SECRET) -> str:
    now = int(time.time())
    claims = {
        "iss": "scraptrace-api",
        "aud": "scraptrace-web",
        "sub": str(SEED_USER_IDS["collector.demo"]),
        "role": "collector",
        "sv": 0,
        "typ": "access",
        "jti": "0199c000-0000-7000-8000-000000000000",
        "iat": now,
        "nbf": now,
        "exp": now + 600,
    }
    claims.update(claims_override)
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.mark.parametrize(
    "token",
    [
        "not-a-token",
        "a.b.c",
        _forge({}, secret="another-signing-key-" + "z" * 32),
        _forge({"aud": "someone-else"}),
        _forge({"typ": "refresh"}),
        _forge({"role": "system"}),
        _forge({"role": "recycler"}),
        _forge({"sv": 7}),
        _forge({"sub": "0199b999-0999-7999-8999-000000000999"}),
        jwt.encode({"sub": "x"}, key="", algorithm="none"),
    ],
)
def test_malformed_forged_or_mismatched_tokens_are_rejected(api: TestClient, token: str) -> None:
    response = api.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert response.headers["www-authenticate"] == "Bearer"


def test_expired_token_is_rejected(api: TestClient, api_settings: Settings) -> None:
    issued_long_ago = TokenService(api_settings, lambda: utc_now() - timedelta(hours=2))
    token = issued_long_ago.issue(SEED_USER_IDS["collector.demo"], "collector", 0).token
    response = api.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["message"].startswith("The session is invalid or has expired")


def test_missing_credentials_require_authentication(api: TestClient) -> None:
    response = api.get("/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_sign_out_revokes_existing_tokens(api: TestClient, api_settings: Settings) -> None:
    headers = auth(api, "collector.demo")
    assert api.get("/v1/auth/me", headers=headers).status_code == 200
    signed_out = api.delete("/v1/auth/sessions/current", headers=headers)
    assert signed_out.status_code == 204
    assert 'scraptrace_session=""' in signed_out.headers["set-cookie"]
    assert api.get("/v1/auth/me", headers=headers).status_code == 401
    assert ("auth.sign-out.succeeded", "succeeded") in query(api_settings, _audit_actions)
    # Signing in again issues a working session.
    assert api.get("/v1/auth/me", headers=auth(api, "collector.demo")).status_code == 200


def test_suspended_account_loses_access(api: TestClient, api_settings: Settings) -> None:
    headers = auth(api, "manager.demo")

    async def suspend(session: sa.ext.asyncio.AsyncSession) -> None:
        async with session.begin():
            await session.execute(
                sa.update(User).where(User.username == "manager.demo").values(is_active=False)
            )

    query(api_settings, suspend)
    assert api.get("/v1/auth/me", headers=headers).status_code == 401
    rejected = api.post(
        "/v1/auth/sessions", json={"username": "manager.demo", "password": DEMO_PASSWORD}
    )
    assert rejected.status_code == 401
    assert rejected.json()["error"]["message"] == "The username or password is incorrect."


def test_cookie_session_requires_same_origin_for_state_changes(api: TestClient) -> None:
    sign_in(api, "collector.demo")  # the client now holds the HttpOnly cookie
    assert api.get("/v1/auth/me").status_code == 200
    forged = api.delete("/v1/auth/sessions/current", headers={"Origin": "https://evil.example"})
    assert forged.status_code == 403
    missing = api.delete("/v1/auth/sessions/current")
    assert missing.status_code == 403
    allowed = api.delete("/v1/auth/sessions/current", headers={"Origin": ALLOWED_ORIGIN})
    assert allowed.status_code == 204


def test_cross_origin_sign_in_is_refused(api: TestClient) -> None:
    response = api.post(
        "/v1/auth/sessions",
        json={"username": "collector.demo", "password": DEMO_PASSWORD},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403


def test_demo_account_discovery_is_off_by_default(api: TestClient) -> None:
    assert api.get("/v1/auth/demo-accounts").status_code == 404


def test_demo_account_discovery_lists_roles_without_secrets(database_url: str) -> None:
    settings = build_settings(database_url, enable_demo_account_discovery=True)
    seed_database(settings)
    with TestClient(create_app(settings=settings, predictor=FakePredictor())) as client:
        response = client.get("/v1/auth/demo-accounts")
    assert response.status_code == 200
    accounts = response.json()["data"]
    assert {account["role"] for account in accounts} == set(ROLE_PERMISSIONS)
    assert all(set(account) == {"username", "display_name", "role"} for account in accounts)


def test_vision_requires_authentication_by_default(api: TestClient) -> None:
    upload = {"image": ("sample.jpg", image_bytes(), "image/jpeg")}
    assert api.post("/v1/vision/appraise", files=upload).status_code == 401
    authorised = api.post("/v1/vision/appraise", files=upload, headers=auth(api, "collector.demo"))
    assert authorised.status_code == 200
    assert authorised.json()["outcome"] == "classified"


def test_health_endpoints_remain_public(api: TestClient) -> None:
    assert api.get("/health/live").status_code == 200
    assert api.get("/health/ready").status_code == 200
    assert api.get("/health/database").status_code == 200


def test_api_responses_carry_security_headers(api: TestClient) -> None:
    response = api.get("/v1/auth/me", headers=auth(api, "collector.demo"))
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_tokens_are_never_logged(api: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    token = session_token(api, "collector.demo")
    api.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert token not in caplog.text
    assert DEMO_PASSWORD not in caplog.text


@pytest.mark.parametrize("username", ["collector.demo", "recycler.demo", "reviewer.demo"])
def test_actor_reference_is_contract_valid_and_reusable(api: TestClient, username: str) -> None:
    from apps.api.app.contracts.transport import REGISTRY

    reference = api.get("/v1/auth/me", headers=auth(api, username)).json()["data"][
        "actor_reference"
    ]
    assert None not in reference.values()
    assert REGISTRY.errors("current_user", reference, ("properties", "actor_reference")) == []
    session = sign_in(api, username)["user"]["actor_reference"]
    assert session == reference
