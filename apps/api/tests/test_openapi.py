"""The generated OpenAPI document is valid and references the shared contracts."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from openapi_spec_validator import validate


def _document(client: TestClient) -> dict[str, Any]:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    return dict(response.json())


def test_openapi_document_is_valid(api: TestClient) -> None:
    document = _document(api)
    validate(document)
    assert document["openapi"].startswith("3.1")


def test_contract_schemas_are_published_as_components(api: TestClient) -> None:
    schemas = _document(api)["components"]["schemas"]
    for name in ("RecoveryRecord", "Evidence", "HandoffRequest", "ErrorEnvelope", "QrPayload"):
        assert name in schemas
        assert "$id" not in schemas[name]


def test_every_versioned_route_is_documented_with_standard_errors(api: TestClient) -> None:
    document = _document(api)
    for path, operations in document["paths"].items():
        if not path.startswith("/v1/"):
            continue
        for method, operation in operations.items():
            assert operation.get("summary"), f"{method.upper()} {path} lacks a summary"
            error_statuses = [
                status for status in operation["responses"] if status.startswith(("4", "5"))
            ]
            assert error_statuses, f"{method.upper()} {path} documents no error responses"


def test_protected_routes_declare_security(api: TestClient) -> None:
    document = _document(api)
    schemes = document["components"]["securitySchemes"]
    assert {"BearerToken", "SessionCookie"} <= set(schemes)
    me = document["paths"]["/v1/auth/me"]["get"]
    assert {"BearerToken": []} in me["security"]
