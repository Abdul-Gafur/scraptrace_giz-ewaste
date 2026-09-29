"""Command-line adapter for the manifest-backed ScrapTrace vision predictor."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from config import CONFIDENCE_THRESHOLD, MODEL_MANIFEST
from predictor import VisionPredictor, format_utc_timestamp

AMBIGUITY_MARGIN = 0.05


class VisionClassifier:
    """Compatibility wrapper used by setup scripts and the CLI."""

    def __init__(self, checkpoint_path: Path | None = None) -> None:
        self.predictor = VisionPredictor(checkpoint_path=checkpoint_path, device="auto")

    def predict(self, image_input: str | Path | Image.Image) -> dict[str, Any]:
        inferred_at = format_utc_timestamp()
        if isinstance(image_input, (str, Path)):
            try:
                with Image.open(image_input) as opened:
                    image = opened.convert("RGB")
            except (OSError, UnidentifiedImageError):
                return {
                    "outcome": "unable_to_classify",
                    "reason": "invalid_image",
                    "model_name": MODEL_MANIFEST.model_name,
                    "model_version": MODEL_MANIFEST.model_version,
                    "inferred_at": inferred_at,
                }
        elif isinstance(image_input, Image.Image):
            image = image_input.convert("RGB")
        else:
            return {
                "outcome": "unable_to_classify",
                "reason": "unsupported_image",
                "model_name": MODEL_MANIFEST.model_name,
                "model_version": MODEL_MANIFEST.model_version,
                "inferred_at": inferred_at,
            }
        print("Loading the verified model release.", file=sys.stderr)
        self.predictor.load()
        return self.predictor.appraise(
            image,
            confidence_threshold=CONFIDENCE_THRESHOLD,
            ambiguity_margin=AMBIGUITY_MARGIN,
        )


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if len(arguments) != 1:
        print("Usage: python predict.py <path_to_image>", file=sys.stderr)
        return 1
    result = VisionClassifier().predict(arguments[0])
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
