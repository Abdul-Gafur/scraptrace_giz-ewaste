"""Deterministic canonical JSON and `sha256:<hex>` digests (ADR-004).

This is a byte-for-byte port of `canonicalizeJson` in
`packages/contracts/src/common/integrity.ts`: object keys are sorted recursively, arrays keep
their order, strings and numbers are serialised exactly as JavaScript's `JSON.stringify` would,
and non-finite numbers or cycles are rejected. A browser, Node and this service therefore
compute the same digest for the same record. A digest detects change; it does not prove that
the captured facts are true.
"""

from __future__ import annotations

import hashlib
import json
import math
from decimal import Decimal
from typing import Any

INTEGRITY_PAYLOAD_FIELDS = (
    "contract_schema_version",
    "record_id",
    "human_reference",
    "record_kind",
    "category",
    "item_count",
    "approximate_weight",
    "condition",
    "original_image_evidence_id",
    "collector",
    "captured_at",
    "capture_location",
    "approximate_area",
    "vision_result",
    "category_confirmation",
    "created_at",
)


def _javascript_number(value: float) -> str:
    """ECMAScript `Number::toString` for finite doubles."""
    if value == 0:
        return "0"
    sign = "-" if value < 0 else ""
    # repr() yields the shortest round-tripping decimal digits, as ECMAScript requires.
    _, digit_tuple, exponent = Decimal(repr(abs(value))).as_tuple()
    digits = "".join(str(digit) for digit in digit_tuple).lstrip("0")
    trailing = len(digits) - len(digits.rstrip("0"))
    digits = digits.rstrip("0")
    k = len(digits)
    # value = 0.d1d2...dk x 10^n, the notation used by the specification.
    n = k + int(exponent) + trailing
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    exponent_value = n - 1
    exponent_sign = "+" if exponent_value >= 0 else "-"
    tail = "." + digits[1:] if k > 1 else ""
    return f"{sign}{digits[0]}{tail}e{exponent_sign}{abs(exponent_value)}"


def _canonicalize(value: Any, ancestors: set[int]) -> str:
    if value is None or isinstance(value, bool | str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int | float):
        number = float(value)
        if not math.isfinite(number):
            raise TypeError("Canonical JSON does not support non-finite numbers.")
        if isinstance(value, int) and abs(value) < 2**53:
            return str(value)
        return _javascript_number(number)
    identity = id(value)
    if identity in ancestors:
        raise TypeError("Canonical JSON does not support cyclic structures.")
    ancestors.add(identity)
    try:
        if isinstance(value, list | tuple):
            return "[" + ",".join(_canonicalize(item, ancestors) for item in value) + "]"
        if isinstance(value, dict):
            entries = (
                json.dumps(str(key), ensure_ascii=False)
                + ":"
                + _canonicalize(value[key], ancestors)
                for key in sorted(value, key=_utf16_sort_key)
            )
            return "{" + ",".join(entries) + "}"
    finally:
        ancestors.discard(identity)
    raise TypeError(f"Canonical JSON does not support {type(value).__name__}.")


def _utf16_sort_key(key: Any) -> bytes:
    # JavaScript's default sort compares UTF-16 code units.
    return str(key).encode("utf-16-be")


def canonicalize_json(value: Any) -> str:
    return _canonicalize(value, set())


def sha256_canonical_json(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonicalize_json(value).encode("utf-8")).hexdigest()


def sha256_bytes(content: bytes) -> str:
    return "sha256:" + hashlib.sha256(content).hexdigest()


def recovery_record_digest(record: dict[str, Any]) -> str:
    """`computeRecoveryRecordDigest`: the digest of the immutable integrity payload."""
    payload = {field: record[field] for field in INTEGRITY_PAYLOAD_FIELDS if field in record}
    return sha256_canonical_json(payload)
