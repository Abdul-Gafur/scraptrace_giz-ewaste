from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from services.vision.config import (
    MODEL_MANIFEST,
    MODEL_MANIFEST_PATH,
    VISION_RESPONSE_SCHEMA_PATH,
)
from services.vision.manifest import sha256_file
from services.vision.predictor import (
    ModelLoadError,
    PredictionScore,
    VisionPrediction,
    VisionPredictor,
    build_appraisal_response,
)


def prediction(top: float = 0.8, second: float = 0.04) -> VisionPrediction:
    values = [0.03, second, top, 0.03, 0.04, 0.03, 0.03]
    return VisionPrediction(
        scores=tuple(
            PredictionScore(category=category, score=values[index])
            for index, category in enumerate(MODEL_MANIFEST.contract_categories)
        ),
        inferred_at="2026-09-26T12:30:00.000Z",
    )


def test_classified_prediction_structure_is_deterministic() -> None:
    response = build_appraisal_response(prediction(), MODEL_MANIFEST, 0.4, 0.05)
    assert response["outcome"] == "classified"
    assert response["category"] == "televisions"
    assert response["confidence"] == response["scores"][2]["score"]


@pytest.mark.parametrize(
    ("top", "second", "margin"),
    [(0.39, 0.04, 0.0), (0.55, 0.53, 0.05)],
)
def test_low_confidence_and_ambiguity_require_manual_confirmation(
    top: float, second: float, margin: float
) -> None:
    response = build_appraisal_response(
        prediction(top, second), MODEL_MANIFEST, 0.4, margin
    )
    assert response["outcome"] == "unable_to_classify"
    assert response["reason"] == "low_confidence"
    assert len(response["scores"]) == 7


def test_missing_checkpoint_fails_clearly(tmp_path: Path) -> None:
    predictor = VisionPredictor(
        checkpoint_path=tmp_path / "best_model.pth",
        manifest_path=MODEL_MANIFEST_PATH,
        response_schema_path=VISION_RESPONSE_SCHEMA_PATH,
    )
    with pytest.raises(ModelLoadError, match="checkpoint is unavailable"):
        predictor.load()
    assert not predictor.is_ready()


def manifest_for_checkpoint(tmp_path: Path, checkpoint: Path) -> Path:
    raw = json.loads(MODEL_MANIFEST_PATH.read_text(encoding="utf-8"))
    raw["checkpoint_sha256"] = sha256_file(checkpoint)
    path = tmp_path / "model_manifest.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    return path


def test_corrupt_checkpoint_fails_safely(tmp_path: Path) -> None:
    checkpoint = tmp_path / "best_model.pth"
    checkpoint.write_bytes(b"not a torch checkpoint")
    predictor = VisionPredictor(
        checkpoint_path=checkpoint,
        manifest_path=manifest_for_checkpoint(tmp_path, checkpoint),
        response_schema_path=VISION_RESPONSE_SCHEMA_PATH,
    )
    with pytest.raises(ModelLoadError):
        predictor.load()
    assert not predictor.is_ready()


def test_checkpoint_loading_and_preprocessing(tmp_path: Path) -> None:
    import torch
    from PIL import Image

    from services.vision.dataset import get_transforms
    from services.vision.model import build_model

    checkpoint = tmp_path / "best_model.pth"
    model = build_model(pretrained=False)
    torch.save(
        {
            "model_name": MODEL_MANIFEST.architecture,
            "categories": list(MODEL_MANIFEST.training_classes),
            "model_state_dict": model.state_dict(),
        },
        checkpoint,
    )
    predictor = VisionPredictor(
        checkpoint_path=checkpoint,
        manifest_path=manifest_for_checkpoint(tmp_path, checkpoint),
        response_schema_path=VISION_RESPONSE_SCHEMA_PATH,
    )
    predictor.load()
    assert predictor.is_ready()
    result = predictor.appraise(Image.new("RGB", (224, 224)), 0.4, 0.05)
    assert result["outcome"] in {"classified", "unable_to_classify"}

    transform = get_transforms(is_train=False)
    resize, _, normalize = transform.transforms
    assert resize.size == (224, 224)
    assert tuple(normalize.mean) == MODEL_MANIFEST.normalization_mean
    assert tuple(normalize.std) == MODEL_MANIFEST.normalization_std


def test_cli_stdout_is_json_and_diagnostics_use_stderr(tmp_path: Path) -> None:
    invalid = tmp_path / "not-image.jpg"
    invalid.write_bytes(b"not an image")
    command = [sys.executable, "services/vision/predict.py", str(invalid)]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    assert payload["reason"] == "invalid_image"
    assert payload["model_name"] == MODEL_MANIFEST.model_name
    assert payload["model_version"] == MODEL_MANIFEST.model_version
    assert completed.stderr == ""


def test_cli_model_diagnostics_stay_out_of_stdout(tmp_path: Path) -> None:
    from PIL import Image

    valid = tmp_path / "image.png"
    Image.new("RGB", (32, 32)).save(valid)
    command = [sys.executable, "services/vision/predict.py", str(valid)]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    assert payload["model_name"] and payload["model_version"]
    assert "Loading the verified" in completed.stderr
    assert str(valid) not in completed.stderr


def test_real_checkpoint_smoke_if_release_is_present() -> None:
    checkpoint = Path("services/vision/checkpoints/best_model.pth")
    if not checkpoint.exists() or MODEL_MANIFEST.checkpoint_sha256 is None:
        pytest.skip("approved checkpoint release is not present in this workspace")
    from PIL import Image

    predictor = VisionPredictor(checkpoint_path=checkpoint)
    predictor.load()
    result = predictor.appraise(Image.new("RGB", (224, 224)), 0.4, 0.05)
    assert result["outcome"] in {"classified", "unable_to_classify"}
