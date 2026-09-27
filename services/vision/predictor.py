"""Reusable, release-manifest-backed ScrapTrace vision inference."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image

from services.vision.config import (
    CHECKPOINTS_DIR,
    MODEL_MANIFEST,
    MODEL_MANIFEST_PATH,
    VISION_RESPONSE_SCHEMA_PATH,
)
from services.vision.manifest import (
    ManifestError,
    ModelManifest,
    load_model_manifest,
    verify_checkpoint_checksum,
)


class ModelLoadError(RuntimeError):
    """Safe model-loading error suitable for readiness state."""


class InferenceError(RuntimeError):
    """Raised when a loaded model cannot complete inference."""


def format_utc_timestamp(value: datetime | None = None) -> str:
    moment = value or datetime.now(timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z"


@dataclass(frozen=True)
class PredictionScore:
    category: str
    score: float


@dataclass(frozen=True)
class VisionPrediction:
    scores: tuple[PredictionScore, ...]
    inferred_at: str

    @property
    def ranked(self) -> tuple[PredictionScore, ...]:
        return tuple(sorted(self.scores, key=lambda item: item.score, reverse=True))


def build_appraisal_response(
    prediction: VisionPrediction,
    manifest: ModelManifest,
    confidence_threshold: float,
    ambiguity_margin: float,
) -> dict[str, Any]:
    ranked = prediction.ranked
    if len(ranked) < 2:
        raise InferenceError("The classifier returned an invalid score vector.")
    top, runner_up = ranked[:2]
    scores = [
        {"category": item.category, "score": item.score} for item in prediction.scores
    ]
    if (
        top.score < confidence_threshold
        or top.score - runner_up.score < ambiguity_margin
    ):
        return {
            "outcome": "unable_to_classify",
            "reason": "low_confidence",
            "scores": scores,
            "model_name": manifest.model_name,
            "model_version": manifest.model_version,
            "inferred_at": prediction.inferred_at,
        }
    return {
        "outcome": "classified",
        "category": top.category,
        "scores": scores,
        "confidence": top.score,
        "model_name": manifest.model_name,
        "model_version": manifest.model_version,
        "inferred_at": prediction.inferred_at,
    }


class VisionPredictor:
    """One-time-loaded classifier shared by the API and command-line adapter."""

    def __init__(
        self,
        checkpoint_path: Path | None = None,
        manifest_path: Path = MODEL_MANIFEST_PATH,
        response_schema_path: Path = VISION_RESPONSE_SCHEMA_PATH,
        device: str = "cpu",
    ) -> None:
        self.checkpoint_path = checkpoint_path or (
            CHECKPOINTS_DIR / MODEL_MANIFEST.checkpoint_filename
        )
        self.manifest_path = manifest_path
        self.response_schema_path = response_schema_path
        self.device_name = device
        self.manifest: ModelManifest | None = None
        self.model: Any | None = None
        self.transform: Any | None = None
        self.load_error: str | None = "Model has not been loaded."

    def _resolve_device(self) -> str:
        import torch

        if self.device_name == "auto":
            if torch.cuda.is_available():
                return "cuda"
            if torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        if self.device_name == "cuda" and not torch.cuda.is_available():
            raise ModelLoadError("The configured inference device is unavailable.")
        if self.device_name == "mps" and not torch.backends.mps.is_available():
            raise ModelLoadError("The configured inference device is unavailable.")
        if self.device_name not in {"cpu", "cuda", "mps"}:
            raise ModelLoadError("The configured inference device is unsupported.")
        return self.device_name

    def load(self) -> None:
        try:
            manifest = load_model_manifest(
                self.manifest_path, self.response_schema_path
            )
            if self.checkpoint_path.name != manifest.checkpoint_filename:
                raise ManifestError(
                    "The configured checkpoint does not match the model manifest."
                )
            verify_checkpoint_checksum(self.checkpoint_path, manifest.checkpoint_sha256)
            device = self._resolve_device()
            from services.vision.dataset import get_transforms
            from services.vision.model import load_checkpoint

            model = load_checkpoint(
                str(self.checkpoint_path),
                model_name=manifest.architecture,
                device=device,
                expected_categories=manifest.training_classes,
            )
            model.eval()
            self.device_name = device
            self.manifest = manifest
            self.model = model
            self.transform = get_transforms(is_train=False)
            self.load_error = None
        except Exception as exc:
            self.manifest = None
            self.model = None
            self.transform = None
            self.load_error = str(exc) or "The model could not be loaded."
            raise ModelLoadError(self.load_error) from exc

    def is_ready(self) -> bool:
        return (
            self.model is not None
            and self.manifest is not None
            and self.transform is not None
        )

    def predict(self, image: Image.Image) -> VisionPrediction:
        model = self.model
        transform = self.transform
        manifest = self.manifest
        if model is None or transform is None or manifest is None:
            raise ModelLoadError("The model is unavailable.")
        try:
            import torch
            import torch.nn.functional as functional

            tensor = transform(image.convert("RGB")).unsqueeze(0).to(self.device_name)
            with torch.inference_mode():
                probabilities = (
                    functional.softmax(model(tensor), dim=1).squeeze(0).cpu().tolist()
                )
        except Exception as exc:
            raise InferenceError("The model could not complete inference.") from exc
        if len(probabilities) != len(manifest.contract_categories):
            raise InferenceError("The classifier returned an invalid score vector.")
        scores = tuple(
            PredictionScore(
                category=category, score=round(float(probabilities[index]), 6)
            )
            for index, category in enumerate(manifest.contract_categories)
        )
        return VisionPrediction(scores=scores, inferred_at=format_utc_timestamp())

    def appraise(
        self,
        image: Image.Image,
        confidence_threshold: float,
        ambiguity_margin: float,
    ) -> dict[str, Any]:
        prediction = self.predict(image)
        manifest = self.manifest
        assert manifest is not None
        return build_appraisal_response(
            prediction,
            manifest,
            confidence_threshold=confidence_threshold,
            ambiguity_margin=ambiguity_margin,
        )
