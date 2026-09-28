"""The Python domain vocabulary and integrity rules match `packages/contracts` exactly."""

from __future__ import annotations

import json
from typing import Any

import pytest
from apps.api.app.core.config import CONTRACT_SCHEMA_DIRECTORY
from apps.api.app.domain import vocabulary
from apps.api.app.domain.integrity import canonicalize_json, sha256_canonical_json
from apps.api.tests.support.contracts_bridge import evaluate


def _schema(name: str) -> dict[str, Any]:
    return dict(json.loads((CONTRACT_SCHEMA_DIRECTORY / f"{name}.schema.json").read_text()))


def _property_enum(name: str, *path: str) -> tuple[str, ...]:
    schema = _schema(name)
    node: Any = schema
    for part in path:
        node = node[part]
        while isinstance(node, dict) and "$ref" in node:
            node = schema["$defs"][node["$ref"].rsplit("/", 1)[1]]
    if "anyOf" in node:
        # A union such as TransitionActorRole = UserRole | "system".
        values: list[str] = []
        for branch in node["anyOf"]:
            values.extend(branch["enum"] if "enum" in branch else [branch["const"]])
        return tuple(values)
    return tuple(node["enum"])


@pytest.mark.parametrize(
    ("expected", "schema", "path"),
    [
        (vocabulary.RECOVERY_RECORD_STATES, "recovery_record", ("properties", "business_state")),
        (vocabulary.HANDOFF_STATES, "recovery_record", ("properties", "handoff_state")),
        (vocabulary.PROCESSING_STATES, "recovery_record", ("properties", "processing_state")),
        (vocabulary.EWASTE_CATEGORIES, "recovery_record", ("properties", "category")),
        (vocabulary.RECORD_KINDS, "recovery_record", ("properties", "record_kind")),
        (vocabulary.ITEM_CONDITIONS, "recovery_record", ("properties", "condition")),
        (
            vocabulary.REVIEW_STATES,
            "recovery_record",
            ("properties", "review", "properties", "review_state"),
        ),
        (
            vocabulary.SYNCHRONIZATION_STATES,
            "recovery_record",
            ("properties", "sync", "properties", "sync_state"),
        ),
        (vocabulary.EVIDENCE_TYPES, "evidence", ("properties", "evidence_type")),
        (vocabulary.EVIDENCE_VALIDATION_STATUSES, "evidence", ("properties", "validation_status")),
        (
            vocabulary.CAPTURE_SOURCES,
            "evidence",
            ("properties", "provenance", "properties", "capture_source"),
        ),
        (
            vocabulary.RECOVERY_RECORD_EVENT_TYPES,
            "recovery_record_event",
            ("properties", "event_type"),
        ),
        (vocabulary.TRANSITION_ACTOR_ROLES, "recovery_record_event", ("properties", "actor_role")),
        (vocabulary.PROCESSING_METHODS, "processing_request", ("properties", "processing_method")),
        (vocabulary.REVIEW_DECISIONS, "programme_review_request", ("properties", "decision")),
        (vocabulary.ERROR_CODES, "error_envelope", ("properties", "error", "properties", "code")),
    ],
)
def test_vocabulary_matches_generated_schema(
    expected: tuple[str, ...], schema: str, path: tuple[str, ...]
) -> None:
    assert _property_enum(schema, *path) == expected


def test_role_and_permission_vocabulary_matches_typescript_source() -> None:
    table = evaluate({"permissions": True})["table"]
    assert tuple(dict.fromkeys(row[0] for row in table)) == vocabulary.USER_ROLES
    assert tuple(dict.fromkeys(row[1] for row in table)) == vocabulary.PERMISSIONS


FIXTURES: list[Any] = [
    {"b": 1, "a": [3, 2, {"z": None, "y": True}], "é": "ünïcode", "q": 'line\nbreak\t"x"'},
    {"value": 14.0, "unit": "kg", "tiny": 1.5e-7, "large": 1e21, "ratio": 0.30000000000000004},
    {"control": "\u0001\u001f", "emoji": "\U0001f5d1", "empty": {}, "list": []},
]


@pytest.mark.parametrize("value", FIXTURES)
def test_canonical_digest_matches_typescript(value: Any) -> None:
    assert sha256_canonical_json(value) == evaluate({"digest": value})["digest"]


def test_canonical_json_rejects_non_finite_numbers() -> None:
    with pytest.raises(TypeError):
        canonicalize_json({"weight": float("nan")})


def test_transition_rules_match_typescript() -> None:
    from apps.api.app.domain.transitions import TRANSITIONS

    rules = evaluate({"transitions": True})["rules"]
    ported = [
        {
            "from": rule.from_state,
            "event": rule.event,
            "required_roles": list(rule.required_roles),
            "required_evidence": list(rule.required_evidence),
            "to": rule.to_state,
            "allowed_offline": rule.allowed_offline,
            "retry_safe": rule.retry_safe,
            "validation_failure": rule.validation_failure,
            **({"requires_no_unresolved_flags": True} if rule.requires_no_unresolved_flags else {}),
        }
        for rule in TRANSITIONS
    ]
    assert ported == rules


def test_review_codes_and_operations_match_typescript() -> None:
    from apps.api.app.services.evidence import SERVER_DEVICE_INSTANCE_ID
    from apps.api.app.services.handoff import HANDOFF_OPERATION
    from apps.api.app.services.processing import PROCESSING_OPERATION
    from apps.api.app.services.reviews import REVIEW_OPERATION

    source = evaluate({"vocabulary": True})
    assert tuple(source["flag_codes"]) == vocabulary.REVIEW_FLAG_CODES
    assert source["reasons_by_decision"] == {
        decision: list(codes) for decision, codes in vocabulary.REASON_CODES_BY_DECISION.items()
    }
    assert source["manual_review_reason"] == vocabulary.MANUAL_REVIEW_REASON
    assert source["operations"] == {
        "createRecord": "create_record",
        "recordHandoff": HANDOFF_OPERATION,
        "recordProcessing": PROCESSING_OPERATION,
        "recordReviewDecision": REVIEW_OPERATION,
    }
    assert source["system_device_instance_id"] == str(SERVER_DEVICE_INSTANCE_ID)
    assert tuple(source["lifecycle_events"]) == vocabulary.LIFECYCLE_EVENT_TYPES
    assert tuple(source["fact_events"]) == vocabulary.RECORD_FACT_EVENT_TYPES


def test_manual_transfer_codes_normalise_like_typescript() -> None:
    from apps.api.app.domain.identifiers import (
        MANUAL_TRANSFER_CODE_ALPHABET,
        derive_manual_transfer_code,
        new_token_nonce,
        normalize_manual_transfer_code,
        uuid7,
    )

    derived = [
        derive_manual_transfer_code(b"parity-test-secret-" + b"x" * 20, uuid7(), new_token_nonce())
        for _ in range(20)
    ]
    samples = [
        *derived,
        *(code.lower().replace("-", " ") for code in derived),
        "oooo-iiii-llll",
        "7K3Q-M9XD-2HVU",
        "7K3Q-M9XD",
        "ST-ABCDEFGHJK",
        "",
    ]
    source = evaluate({"normalize": samples, "vocabulary": False})
    assert source["normalized"] == [normalize_manual_transfer_code(code) for code in samples]
    assert all(normalize_manual_transfer_code(code) == code for code in derived)
    assert evaluate({"vocabulary": True})["manual_code_alphabet"] == MANUAL_TRANSFER_CODE_ALPHABET
