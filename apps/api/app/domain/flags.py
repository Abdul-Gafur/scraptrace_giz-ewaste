"""Named review flags (FR-HND-006, FR-REV-002).

A flag records that a value needs human judgement. It is never proof of wrongdoing (BR-009)
and never silently blocks or approves a record. The rules and codes mirror
`apps/web/src/services/domain/flags.ts`, which the web application already displays; the
contracts carry flag codes as bounded strings (see `docs/contract-gaps.md`, gap 9).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

GRAMS_PER_KILOGRAM = 1000.0
HANDOFF_REQUIRED_EVIDENCE = (
    "handoff_qr_scan",
    "recycler_receipt",
    "handoff_photo",
    "weight_measurement",
)


@dataclass(frozen=True)
class Weight:
    value: float
    unit: str


def to_kilograms(weight: Weight) -> float:
    return weight.value if weight.unit == "kg" else weight.value / GRAMS_PER_KILOGRAM


def weight_difference_ratio(declared: Weight | None, measured: Weight) -> float | None:
    """Relative difference as a fraction of the declared weight. An absent declaration is not
    a discrepancy, so it returns None."""
    if declared is None:
        return None
    declared_kg = to_kilograms(declared)
    if declared_kg <= 0:
        return None
    return abs(to_kilograms(measured) - declared_kg) / declared_kg


def evaluate_handoff_flags(
    *,
    declared_weight: Weight | None,
    measured_weight: Weight,
    declared_category: str,
    confirmed_category: str,
    threshold_percentage: float,
    duplicate_evidence_digest: bool,
    available_evidence: Iterable[str],
) -> list[str]:
    flags: list[str] = []
    ratio = weight_difference_ratio(declared_weight, measured_weight)
    if ratio is not None and ratio * 100 > threshold_percentage:
        flags.append("WEIGHT_DISCREPANCY")
    if confirmed_category != declared_category:
        flags.append("CATEGORY_DISAGREEMENT")
    if duplicate_evidence_digest:
        flags.append("DUPLICATE_EVIDENCE_DIGEST")
    available = set(available_evidence)
    if any(evidence not in available for evidence in HANDOFF_REQUIRED_EVIDENCE):
        flags.append("INCOMPLETE_EVIDENCE")
    return flags


def evaluate_processing_flags(
    *,
    received_weight: Weight | None,
    material_weights: Iterable[Weight],
    requires_material_weights: bool,
) -> list[str]:
    """Recovered material may legitimately weigh less than the received item, so only a
    recovered total above the received weight is flagged."""
    weights = list(material_weights)
    flags: list[str] = []
    if requires_material_weights and not weights:
        flags.append("MISSING_MATERIAL_WEIGHTS")
    recovered = sum(to_kilograms(weight) for weight in weights)
    if received_weight is not None and recovered > to_kilograms(received_weight):
        flags.append("PROCESSED_WEIGHT_ABOVE_RECEIVED")
    return flags
