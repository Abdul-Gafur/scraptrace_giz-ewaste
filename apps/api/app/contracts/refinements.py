"""Zod `superRefine` rules that the generated JSON Schemas cannot express.

Each function mirrors one refinement in `packages/contracts/src` and returns allow-listed field
issues (`{"field", "reason"}`), so the same check serves request validation (422) and response
self-checks.
"""

from __future__ import annotations

import sys
from typing import Any

from apps.api.app.domain.time import parse_timestamp

Issue = dict[str, str]

# `Number.EPSILON` in JavaScript.
_EPSILON = sys.float_info.epsilon


def _issue(field: str, reason: str) -> Issue:
    return {"field": field, "reason": reason}


def prediction_consistency(
    scores: list[dict[str, Any]], suggested: str, confidence: float, prefix: str
) -> list[Issue]:
    """`addPredictionConsistencyIssues`: confidence equals the suggested category's score, and
    the suggested category holds the highest score."""
    issues: list[Issue] = []
    selected = next((score for score in scores if score.get("category") == suggested), None)
    if selected is None or abs(float(selected["score"]) - confidence) > _EPSILON:
        issues.append(_issue(f"{prefix}.confidence", "must_equal_selected_score"))
    highest = max((float(score["score"]) for score in scores), default=0.0)
    if selected is None or float(selected["score"]) < highest:
        issues.append(_issue(f"{prefix}.suggested_category", "must_have_highest_score"))
    return issues


def vision_result(value: dict[str, Any], prefix: str = "vision_result") -> list[Issue]:
    scores = value.get("scores", [])
    issues: list[Issue] = []
    if len({score.get("category") for score in scores}) != 7:
        issues.append(_issue(f"{prefix}.scores", "each_category_exactly_once"))
    issues.extend(
        prediction_consistency(
            scores, str(value.get("suggested_category")), float(value.get("confidence", -1)), prefix
        )
    )
    return issues


def price_estimate(value: dict[str, Any], prefix: str = "estimated_price") -> list[Issue]:
    issues: list[Issue] = []
    if float(value.get("maximum_amount", 0)) < float(value.get("minimum_amount", 0)):
        issues.append(_issue(f"{prefix}.maximum_amount", "below_minimum_amount"))
    if value.get("category") == "mixed_scrap" and "approximate_weight" not in value:
        issues.append(_issue(f"{prefix}.approximate_weight", "required_for_mixed_scrap"))
    return issues


def timestamps(values: dict[str, Any]) -> list[Issue]:
    """`UtcTimestampSchema.refine`: the pattern must also be a real calendar instant."""
    issues: list[Issue] = []
    for field, value in values.items():
        if isinstance(value, str):
            try:
                parse_timestamp(value)
            except ValueError:
                issues.append(_issue(field, "invalid_calendar_instant"))
    return issues


def recovery_record(value: dict[str, Any]) -> list[Issue]:
    """`RecoveryRecordSchema.superRefine` plus the nested vision, price and review rules."""
    issues: list[Issue] = []
    if value["qr_payload"]["record_id"] != value["record_id"]:
        issues.append(_issue("qr_payload.record_id", "must_match_record"))
    if value["category"] == "mixed_scrap" and value["record_kind"] != "batch":
        issues.append(_issue("record_kind", "mixed_scrap_must_be_batch"))
    if value["category"] == "mixed_scrap" and "approximate_weight" not in value:
        issues.append(_issue("approximate_weight", "required_for_mixed_scrap"))
    if value["category_confirmation"]["confirmed_category"] != value["category"]:
        issues.append(_issue("category_confirmation.confirmed_category", "must_match_category"))
    if "vision_result" in value:
        issues.extend(vision_result(value["vision_result"]))
    if "estimated_price" in value:
        issues.extend(price_estimate(value["estimated_price"]))
    review = value["review"]
    if "decision" in review and not (
        review.get("reason_code") and review.get("decided_at") and review.get("assigned_reviewer")
    ):
        issues.append(_issue("review.decision", "requires_reviewer_reason_and_time"))
    return issues


def programme_review_request(value: dict[str, Any]) -> list[Issue]:
    if value.get("decision") == "request_correction" and not value.get("requested_correction"):
        return [_issue("requested_correction", "required")]
    return []
