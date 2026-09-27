"""Command-line adapter for the shared ScrapTrace vision predictor."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

import torch
import torch.nn.functional as F

from config import (
    CHECKPOINTS_DIR,
    CONTRACT_CATEGORIES,
    CONFIDENCE_THRESHOLD,
    DEFAULT_MODEL_NAME,
)
from dataset import get_transforms
from model import load_checkpoint

MODEL_VERSION = "0.1.0"
MODEL_NAME = "scraptrace-vision-classifier"


def format_utc_timestamp(dt: datetime = None) -> str:
    """Format datetime as strict UTC ISO 8601 string ending in Z, e.g. 2026-09-26T13:30:14.101Z."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    # Format with 3 decimal places for milliseconds and trailing Z to satisfy UtcTimestampSchema
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:23] + "Z"


class VisionClassifier:
    def __init__(self, checkpoint_path: Path = None):
        self.device = torch.device(
            "mps"
            if torch.backends.mps.is_available()
            else ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.transform = get_transforms(is_train=False)

        if checkpoint_path is None:
            checkpoint_path = CHECKPOINTS_DIR / "best_model.pth"

        self.checkpoint_path = checkpoint_path
        from foundation_models import ensure_model_available
        self.model = ensure_model_available(checkpoint_path)


    def predict(self, image_input) -> dict:
        """
        Classifies an input image and outputs a VisionAppraisalResponse JSON structure.
        """
        inferred_at = format_utc_timestamp()

        if isinstance(image_input, (str, Path)):
            try:
                img = Image.open(image_input).convert("RGB")
            except Exception:
                return {
                    "outcome": "unable_to_classify",
                    "reason": "invalid_image",
                    "model_name": MODEL_NAME,
                    "model_version": MODEL_VERSION,
                    "inferred_at": inferred_at,
                }
        elif isinstance(image_input, Image.Image):
            img = image_input.convert("RGB")
        else:
            return {
                "outcome": "unable_to_classify",
                "reason": "unsupported_image",
                "model_name": MODEL_NAME,
                "model_version": MODEL_VERSION,
                "inferred_at": inferred_at,
            }

        tensor = self.transform(img).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        scores = [
            {"category": cat, "score": round(float(probs[idx]), 4)}
            for idx, cat in enumerate(CONTRACT_CATEGORIES)
        ]

        top_idx = int(probs.argmax())
        top_category = CONTRACT_CATEGORIES[top_idx]
        top_confidence = scores[top_idx]["score"]

        if top_confidence < CONFIDENCE_THRESHOLD:
            return {
                "outcome": "unable_to_classify",
                "reason": "low_confidence",
                "scores": scores,
                "model_name": MODEL_NAME,
                "model_version": MODEL_VERSION,
                "inferred_at": inferred_at,
            }

        return {
            "outcome": "classified",
            "category": top_category,
            "scores": scores,
            "confidence": top_confidence,
            "model_name": MODEL_NAME,
            "model_version": MODEL_VERSION,
            "inferred_at": inferred_at,
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py <path_to_image>", file=sys.stderr)
        return 2

    try:
        with Image.open(args[0]) as source:
            image = source.convert("RGB")
    except (OSError, UnidentifiedImageError):
        print(json.dumps(_unable("invalid_image"), indent=2))
        return 0

    predictor = VisionPredictor(device="cpu")
    try:
        print("Loading the verified ScrapTrace vision model.", file=sys.stderr)
        predictor.load()
        result = predictor.appraise(
            image,
            confidence_threshold=CONFIDENCE_THRESHOLD,
            ambiguity_margin=0.0,
        )
    except ModelLoadError as exc:
        print(f"Model unavailable: {exc}", file=sys.stderr)
        result = _unable("service_unavailable")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
