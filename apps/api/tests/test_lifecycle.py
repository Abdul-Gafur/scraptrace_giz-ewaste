"""The recovery-record state machine refuses invalid, unauthorised and terminal transitions."""

from __future__ import annotations

import pytest
from apps.api.app.domain.transitions import TransitionInput, transition
from apps.api.app.domain.vocabulary import RECOVERY_RECORD_EVENT_TYPES

ALL_EVIDENCE = frozenset(
    {
        "original_item_photo",
        "handoff_qr_scan",
        "recycler_receipt",
        "handoff_photo",
        "weight_measurement",
        "processing_completion",
        "reviewer_decision",
    }
)


def _run(
    state: str, event: str, role: str, evidence: frozenset[str] = ALL_EVIDENCE, **kwargs: bool
):
    return transition(
        TransitionInput(
            current_state=state,
            event=event,
            actor_role=role,
            available_evidence=evidence,
            is_offline=kwargs.get("offline", False),
            has_unresolved_flags=kwargs.get("flags", False),
        )
    )


@pytest.mark.parametrize("state", ["approved_and_completed", "rejected"])
@pytest.mark.parametrize("event", RECOVERY_RECORD_EVENT_TYPES)
def test_terminal_records_are_never_reopened(state: str, event: str) -> None:
    result = _run(state, event, "programme_reviewer")
    assert not result.ok and result.code == "TERMINAL_STATE"


def test_happy_path_follows_the_contract() -> None:
    steps = [
        ("draft", "submit_record", "collector", "submitted"),
        ("submitted", "publish_for_handoff", "system", "awaiting_handoff"),
        ("awaiting_handoff", "record_handoff", "recycler", "received"),
        ("received", "record_processing", "recycler", "processing_recorded"),
        ("processing_recorded", "mark_processing_complete", "recycler", "completed"),
        ("completed", "approve_unflagged_completion", "system", "approved_and_completed"),
    ]
    for state, event, role, expected in steps:
        result = _run(state, event, role)
        assert result.ok and result.next_state == expected, (state, event)


@pytest.mark.parametrize(
    ("state", "event", "role", "code"),
    [
        ("draft", "record_handoff", "recycler", "TRANSITION_NOT_ALLOWED"),
        ("draft", "submit_record", "recycler", "ROLE_NOT_ALLOWED"),
        ("submitted", "publish_for_handoff", "collector", "ROLE_NOT_ALLOWED"),
        ("under_review", "approve_review", "programme_manager", "ROLE_NOT_ALLOWED"),
        ("awaiting_handoff", "approve_review", "programme_reviewer", "TRANSITION_NOT_ALLOWED"),
    ],
)
def test_invalid_transitions_fail(state: str, event: str, role: str, code: str) -> None:
    result = _run(state, event, role)
    assert not result.ok and result.code == code


def test_missing_evidence_blocks_the_transition() -> None:
    result = _run("awaiting_handoff", "record_handoff", "recycler", frozenset({"handoff_photo"}))
    assert result.code == "MISSING_EVIDENCE"
    assert set(result.missing_evidence) == {
        "handoff_qr_scan",
        "recycler_receipt",
        "weight_measurement",
    }


def test_unresolved_flags_block_unflagged_approval() -> None:
    result = _run("completed", "approve_unflagged_completion", "system", flags=True)
    assert result.code == "UNRESOLVED_FLAGS"


def test_offline_commands_only_where_the_contract_allows() -> None:
    assert _run("awaiting_handoff", "record_handoff", "recycler", offline=True).ok
    assert _run("draft", "submit_record", "collector", offline=True).code == "OFFLINE_NOT_ALLOWED"
