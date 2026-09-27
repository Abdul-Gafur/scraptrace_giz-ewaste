from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.vision.config import MODEL_MANIFEST_PATH, VISION_RESPONSE_SCHEMA_PATH
from services.vision.manifest import (
    ManifestError,
    load_model_manifest,
    sha256_file,
    verify_checkpoint_checksum,
)


def test_manifest_matches_generated_contract() -> None:
    manifest = load_model_manifest(MODEL_MANIFEST_PATH, VISION_RESPONSE_SCHEMA_PATH)
    assert manifest.architecture == "efficientnet_b0"
    assert len(manifest.contract_categories) == 7
    assert manifest.input_width == manifest.input_height == 224


def test_checksum_verification(tmp_path: Path) -> None:
    checkpoint = tmp_path / "best_model.pth"
    checkpoint.write_bytes(b"fixture checkpoint")
    expected = sha256_file(checkpoint)
    assert verify_checkpoint_checksum(checkpoint, expected) == expected


@pytest.mark.parametrize("expected", [None, "0" * 64])
def test_missing_or_mismatched_checksum_fails(tmp_path: Path, expected: str | None) -> None:
    checkpoint = tmp_path / "best_model.pth"
    checkpoint.write_bytes(b"fixture checkpoint")
    with pytest.raises(ManifestError):
        verify_checkpoint_checksum(checkpoint, expected)


def test_changed_class_mapping_is_rejected(tmp_path: Path) -> None:
    raw = json.loads(MODEL_MANIFEST_PATH.read_text(encoding="utf-8"))
    raw["training_classes"] = list(reversed(raw["training_classes"]))
    changed = tmp_path / "manifest.json"
    changed.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ManifestError, match="class order"):
        load_model_manifest(changed, VISION_RESPONSE_SCHEMA_PATH)
