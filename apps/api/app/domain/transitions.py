"""The recovery-record lifecycle (ADR-003).

A port of `RECOVERY_RECORD_TRANSITIONS` and `transitionRecoveryRecord` from
`packages/contracts/src/recovery-record/recovery-record.transitions.ts`. The rule table is
compared field-by-field with the TypeScript source in `tests/test_contract_parity.py`. Route
handlers never assign a lifecycle state: every change goes through `transition`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from apps.api.app.domain.vocabulary import TERMINAL_RECOVERY_RECORD_STATES


@dataclass(frozen=True)
class TransitionRule:
    from_state: str
    event: str
    required_roles: tuple[str, ...]
    required_evidence: tuple[str, ...]
    to_state: str
    allowed_offline: bool
    retry_safe: bool
    validation_failure: str
    requires_no_unresolved_flags: bool = False


TRANSITIONS: Final[tuple[TransitionRule, ...]] = (
    TransitionRule(
        "draft",
        "submit_record",
        ("collector",),
        ("original_item_photo",),
        "submitted",
        False,
        True,
        "A validated draft and original item photograph are required.",
    ),
    TransitionRule(
        "submitted",
        "publish_for_handoff",
        ("system",),
        ("original_item_photo",),
        "awaiting_handoff",
        False,
        True,
        "The submitted record must pass server validation.",
    ),
    TransitionRule(
        "awaiting_handoff",
        "record_handoff",
        ("recycler",),
        ("handoff_qr_scan", "recycler_receipt", "handoff_photo", "weight_measurement"),
        "received",
        True,
        True,
        "Authorised recycler receipt, handoff, and readable weight evidence are required.",
    ),
    TransitionRule(
        "received",
        "record_processing",
        ("recycler",),
        ("processing_completion",),
        "processing_recorded",
        True,
        True,
        "A controlled processing result and supporting evidence are required.",
    ),
    TransitionRule(
        "processing_recorded",
        "mark_processing_complete",
        ("recycler",),
        ("processing_completion",),
        "completed",
        False,
        True,
        "Processing evidence must be durably received before completion.",
    ),
    TransitionRule(
        "processing_recorded",
        "flag_for_review",
        ("system", "programme_reviewer"),
        (),
        "under_review",
        False,
        True,
        "A named review reason is required by the command contract.",
    ),
    TransitionRule(
        "completed",
        "flag_for_review",
        ("system", "programme_reviewer"),
        (),
        "under_review",
        False,
        True,
        "A named review reason is required by the command contract.",
    ),
    TransitionRule(
        "completed",
        "approve_unflagged_completion",
        ("system",),
        ("handoff_photo", "weight_measurement", "processing_completion"),
        "approved_and_completed",
        False,
        True,
        "Required evidence must be complete and no review flag may remain unresolved.",
        requires_no_unresolved_flags=True,
    ),
    TransitionRule(
        "under_review",
        "approve_review",
        ("programme_reviewer",),
        ("reviewer_decision",),
        "approved_and_completed",
        False,
        True,
        "A reasoned reviewer decision is required.",
    ),
    TransitionRule(
        "under_review",
        "request_correction",
        ("programme_reviewer",),
        ("reviewer_decision",),
        "under_review",
        False,
        True,
        "A reason and requested correction are required.",
    ),
    TransitionRule(
        "under_review",
        "reject_review",
        ("programme_reviewer",),
        ("reviewer_decision",),
        "rejected",
        False,
        True,
        "A reasoned reviewer rejection is required.",
    ),
)


@dataclass(frozen=True)
class TransitionInput:
    current_state: str
    event: str
    actor_role: str
    available_evidence: frozenset[str]
    is_offline: bool
    has_unresolved_flags: bool


@dataclass(frozen=True)
class TransitionResult:
    ok: bool
    previous_state: str | None = None
    next_state: str | None = None
    retry_safe: bool = False
    code: str | None = None
    message: str | None = None
    missing_evidence: tuple[str, ...] = ()


def transition(value: TransitionInput) -> TransitionResult:
    if value.current_state in TERMINAL_RECOVERY_RECORD_STATES:
        return TransitionResult(
            ok=False,
            code="TERMINAL_STATE",
            message=(
                "Terminal records require a reviewed amendment; they cannot be reopened by a "
                "transition."
            ),
        )
    rule = next(
        (
            candidate
            for candidate in TRANSITIONS
            if candidate.from_state == value.current_state and candidate.event == value.event
        ),
        None,
    )
    if rule is None:
        return TransitionResult(
            ok=False,
            code="TRANSITION_NOT_ALLOWED",
            message="The event is not valid for the current recovery-record state.",
        )
    if value.actor_role not in rule.required_roles:
        return TransitionResult(
            ok=False,
            code="ROLE_NOT_ALLOWED",
            message="The actor role cannot perform this transition.",
        )
    if value.is_offline and not rule.allowed_offline:
        return TransitionResult(
            ok=False,
            code="OFFLINE_NOT_ALLOWED",
            message="This transition requires server acknowledgement.",
        )
    missing = tuple(
        evidence for evidence in rule.required_evidence if evidence not in value.available_evidence
    )
    if missing:
        return TransitionResult(
            ok=False,
            code="MISSING_EVIDENCE",
            message=rule.validation_failure,
            missing_evidence=missing,
        )
    if rule.requires_no_unresolved_flags and value.has_unresolved_flags:
        return TransitionResult(ok=False, code="UNRESOLVED_FLAGS", message=rule.validation_failure)
    return TransitionResult(
        ok=True,
        previous_state=value.current_state,
        next_state=rule.to_state,
        retry_safe=rule.retry_safe,
    )
