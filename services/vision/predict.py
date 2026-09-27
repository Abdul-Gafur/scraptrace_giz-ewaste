"""Command-line adapter for the shared ScrapTrace vision predictor."""

from __future__ import annotations

import json
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from PIL import Image, UnidentifiedImageError

from services.vision.config import CONFIDENCE_THRESHOLD, MODEL_MANIFEST
from services.vision.predictor import (
    ModelLoadError,
    VisionPredictor,
    format_utc_timestamp,
)


def _unable(reason: str) -> dict[str, object]:
    return {
        "outcome": "unable_to_classify",
        "reason": reason,
        "model_name": MODEL_MANIFEST.model_name,
        "model_version": MODEL_MANIFEST.model_version,
        "inferred_at": format_utc_timestamp(),
    }


def main(arguments: list[str] | None = None) -> int:
    args = arguments if arguments is not None else sys.argv[1:]
    if len(args) != 1:
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
