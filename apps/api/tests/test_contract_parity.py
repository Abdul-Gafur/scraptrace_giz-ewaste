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
