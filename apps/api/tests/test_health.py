from apps.api.app.main import create_app
from apps.api.tests.conftest import FakePredictor
from fastapi.testclient import TestClient


def test_liveness(client: TestClient) -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "live"}


def test_readiness_when_model_is_loaded(client: TestClient) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "model_loaded": True,
        "integrity_verified": True,
    }


def test_readiness_failure_uses_standard_error(settings) -> None:
    with TestClient(
        create_app(settings=settings, predictor=FakePredictor(load_failure=True))
    ) as unavailable:
        response = unavailable.get("/health/ready", headers={"X-Request-ID": "request-0001"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DEPENDENCY_UNAVAILABLE"
    assert response.json()["meta"]["correlation_id"] == "request-0001"
    assert "fixture" not in response.text


def test_unknown_route_uses_standard_error(client: TestClient) -> None:
    response = client.get("/not-a-route")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
