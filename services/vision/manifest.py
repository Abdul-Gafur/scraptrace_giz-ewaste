"""Model release manifest loading and integrity validation."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


class ManifestError(RuntimeError):
    """Raised when a model manifest is missing or invalid."""


SEMANTIC_VERSION_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)


@dataclass(frozen=True)
class ModelManifest:
    model_name: str
    model_version: str
    architecture: str
    checkpoint_filename: str
    checkpoint_sha256: str | None
    input_width: int
    input_height: int
    normalization_mean: tuple[float, float, float]
    normalization_std: tuple[float, float, float]
    training_classes: tuple[str, ...]
    contract_mapping: Mapping[str, str]
    raw: Mapping[str, Any]

    @property
    def contract_categories(self) -> tuple[str, ...]:
        return tuple(self.contract_mapping[label] for label in self.training_classes)


def _required_object(value: Any, field: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise ManifestError(f"Model manifest field '{field}' must be an object.")
    return value


def _required_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ManifestError(
            f"Model manifest field '{field}' must be a non-empty string."
        )
    return value


def _triplet(value: Any, field: str) -> tuple[float, float, float]:
    if (
        not isinstance(value, list)
        or len(value) != 3
        or not all(isinstance(item, (int, float)) for item in value)
    ):
        raise ManifestError(
            f"Model manifest field '{field}' must contain three numbers."
        )
    return tuple(float(item) for item in value)  # type: ignore[return-value]


def _contract_categories(schema_path: Path) -> tuple[str, ...]:
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        values = schema["$defs"]["__schema1"]["enum"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ManifestError(
            "The generated vision response schema cannot be read."
        ) from exc
    if not isinstance(values, list) or not all(
        isinstance(item, str) for item in values
    ):
        raise ManifestError(
            "The generated vision response schema has no valid category enum."
        )
    return tuple(values)


def load_model_manifest(path: Path, response_schema_path: Path) -> ModelManifest:
    """Load a release manifest and verify its mapping against the generated contract."""

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ManifestError("The model manifest is unavailable.") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestError("The model manifest cannot be read.") from exc
    if not isinstance(raw, dict):
        raise ManifestError("The model manifest root must be an object.")

    input_spec = _required_object(raw.get("input"), "input")
    normalization = _required_object(
        input_spec.get("normalization"), "input.normalization"
    )
    dimensions = input_spec.get("dimensions")
    if (
        not isinstance(dimensions, list)
        or len(dimensions) != 2
        or not all(isinstance(item, int) and item > 0 for item in dimensions)
    ):
        raise ManifestError(
            "Model manifest input dimensions must contain two positive integers."
        )

    labels = raw.get("training_classes")
    if (
        not isinstance(labels, list)
        or not labels
        or not all(isinstance(item, str) for item in labels)
    ):
        raise ManifestError(
            "Model manifest training_classes must be a non-empty string array."
        )
    if len(set(labels)) != len(labels):
        raise ManifestError("Model manifest training classes must be unique.")

    mapping = _required_object(
        raw.get("contract_category_mapping"), "contract_category_mapping"
    )
    if set(mapping) != set(labels) or not all(
        isinstance(item, str) for item in mapping.values()
    ):
        raise ManifestError(
            "Model manifest mapping must define every training class exactly once."
        )
    mapped = tuple(str(mapping[label]) for label in labels)
    canonical = _contract_categories(response_schema_path)
    if mapped != canonical:
        raise ManifestError(
            "Model manifest class order does not match the generated contract schema."
        )

    model_version = _required_string(raw.get("model_version"), "model_version")
    if SEMANTIC_VERSION_PATTERN.fullmatch(model_version) is None:
        raise ManifestError("Model manifest model_version must be a semantic version.")
    checkpoint_filename = _required_string(
        raw.get("checkpoint_filename"), "checkpoint_filename"
    )
    if Path(checkpoint_filename).name != checkpoint_filename:
        raise ManifestError(
            "Model manifest checkpoint_filename must not contain a path."
        )

    dataset = _required_object(raw.get("dataset"), "dataset")
    _required_string(dataset.get("name"), "dataset.name")
    _required_string(dataset.get("revision"), "dataset.revision")
    _required_string(raw.get("training_date"), "training_date")
    evaluation = _required_object(raw.get("evaluation"), "evaluation")
    for metric in ("test_accuracy", "macro_f1"):
        if not isinstance(evaluation.get(metric), (int, float)):
            raise ManifestError(f"Model manifest evaluation.{metric} must be numeric.")
    per_class = _required_object(evaluation.get("per_class"), "evaluation.per_class")
    if set(per_class) != set(mapped):
        raise ManifestError(
            "Model manifest per-class metrics must cover every contract category."
        )
    _required_object(raw.get("framework"), "framework")
    limitations = raw.get("known_limitations")
    if (
        not isinstance(limitations, list)
        or not limitations
        or not all(isinstance(item, str) and item.strip() for item in limitations)
    ):
        raise ManifestError(
            "Model manifest known_limitations must be a non-empty string array."
        )
    _required_object(raw.get("licence"), "licence")

    checksum = raw.get("checkpoint_sha256")
    if checksum is not None and (
        not isinstance(checksum, str)
        or len(checksum) != 64
        or any(character not in "0123456789abcdef" for character in checksum)
    ):
        raise ManifestError(
            "Model manifest checkpoint_sha256 must be null or 64 lowercase hex characters."
        )

    return ModelManifest(
        model_name=_required_string(raw.get("model_name"), "model_name"),
        model_version=model_version,
        architecture=_required_string(raw.get("architecture"), "architecture"),
        checkpoint_filename=checkpoint_filename,
        checkpoint_sha256=checksum,
        input_width=dimensions[0],
        input_height=dimensions[1],
        normalization_mean=_triplet(
            normalization.get("mean"), "input.normalization.mean"
        ),
        normalization_std=_triplet(normalization.get("std"), "input.normalization.std"),
        training_classes=tuple(labels),
        contract_mapping={str(key): str(value) for key, value in mapping.items()},
        raw=raw,
    )


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as checkpoint:
        for chunk in iter(lambda: checkpoint.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_checkpoint_checksum(path: Path, expected_sha256: str | None) -> str:
    if not path.is_file():
        raise ManifestError("The model checkpoint is unavailable.")
    if expected_sha256 is None:
        raise ManifestError("The model release manifest has no checkpoint checksum.")
    actual = sha256_file(path)
    if actual != expected_sha256:
        raise ManifestError("The model checkpoint failed its integrity check.")
    return actual
