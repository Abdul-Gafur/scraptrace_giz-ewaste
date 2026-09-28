"""Every operation the web HTTP adapter calls exists in the generated OpenAPI document.

`apps/web/src/services/http/consumed-operations.json` lists each consumed operation with its
request and response contracts. This test fails when a consumed route disappears, its method
changes, its request contract drifts from the one the web sends, or a documented response the
web handles is missing. Contract component schemas are the generated shared contracts, so a
changed required field is caught by the contract schema check as well.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from apps.api.app.api.openapi import component_name
from apps.api.app.core.config import REPOSITORY_ROOT
from fastapi.testclient import TestClient

MANIFEST = REPOSITORY_ROOT / "apps/web/src/services/http/consumed-operations.json"
OPERATIONS: list[dict[str, Any]] = json.loads(MANIFEST.read_text(encoding="utf-8"))["operations"]


@pytest.fixture(scope="module")
def document(api_document: dict[str, Any]) -> dict[str, Any]:
    return api_document


@pytest.fixture(scope="module")
def api_document(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    from apps.api.app.main import create_app
    from apps.api.tests.conftest import FakePredictor, build_settings

    database = tmp_path_factory.mktemp("openapi") / "openapi.sqlite3"
    settings = build_settings(f"sqlite+aiosqlite:///{database}")
    with TestClient(create_app(settings=settings, predictor=FakePredictor())) as client:
        response = client.get("/openapi.json")
    assert response.status_code == 200
    return dict(response.json())


def _ref(name: str) -> str:
    return f"#/components/schemas/{component_name(name)}"


def _operation(document: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    path = document["paths"].get(entry["path"])
    assert path is not None, f"{entry['path']} is no longer published"
    operation = path.get(entry["method"].lower())
    assert operation is not None, f"{entry['method']} {entry['path']} is no longer published"
    return dict(operation)


def _label(entry: dict[str, Any]) -> str:
    return f"{entry['method']} {entry['path']}"


@pytest.mark.parametrize("entry", OPERATIONS, ids=_label)
def test_consumed_operation_exists_with_its_request_contract(
    document: dict[str, Any], entry: dict[str, Any]
) -> None:
    operation = _operation(document, entry)
    request = entry.get("request")
    if request is None:
        return
    body = operation.get("requestBody", {}).get("content", {})
    if request.startswith("multipart:"):
        contract = request.removeprefix("multipart:")
        schema = body["multipart/form-data"]["schema"]
        text = json.dumps(schema)
        # Either the whole JSON part references the contract, or the form fields are its fields.
        if _ref(contract) not in text:
            fields = document["components"]["schemas"][component_name(contract)]["required"]
            assert set(fields) <= set(schema["required"]), f"{_label(entry)} form fields drifted"
        return
    assert body["application/json"]["schema"] == {"$ref": _ref(request)}, (
        f"{_label(entry)} no longer accepts {request}"
    )


@pytest.mark.parametrize("entry", OPERATIONS, ids=_label)
def test_consumed_operation_documents_every_handled_response(
    document: dict[str, Any], entry: dict[str, Any]
) -> None:
    responses = _operation(document, entry)["responses"]
    missing = [status for status in entry["statuses"] if str(status) not in responses]
    assert not missing, f"{_label(entry)} no longer documents {missing}"
    contract = entry.get("response")
    if contract is None:
        return
    for status in (s for s in entry["statuses"] if 200 <= s < 300 and s != 204):
        schema = responses[str(status)]["content"]["application/json"]["schema"]
        data = schema.get("properties", {}).get("data", schema)
        assert data == {"$ref": _ref(contract)}, (
            f"{_label(entry)} {status} no longer returns {contract}"
        )


def test_every_error_response_is_the_standard_envelope(document: dict[str, Any]) -> None:
    for entry in OPERATIONS:
        responses = _operation(document, entry)["responses"]
        for status in entry["statuses"]:
            if status >= 400:
                schema = responses[str(status)]["content"]["application/json"]["schema"]
                assert schema == {"$ref": _ref("error_envelope")}, (
                    f"{_label(entry)} {status} is not the standard error envelope"
                )
