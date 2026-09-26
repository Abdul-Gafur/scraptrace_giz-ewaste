"""
Inference service for ScrapTrace e-waste image classification.
Produces contract-compliant appraisal responses matching VisionAppraisalResponseSchema.
"""

import sys
import json
from datetime import datetime, timezone
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
MODEL_NAME = "scraptrace-vision-mobilenetv3"

class VisionClassifier:
    def __init__(self, checkpoint_path: Path = None):
        self.device = torch.device("mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu"))
        self.transform = get_transforms(is_train=False)

        if checkpoint_path is None:
            checkpoint_path = CHECKPOINTS_DIR / "best_model.pth"

        self.checkpoint_path = checkpoint_path
        if checkpoint_path.exists():
            print(f"Loading checkpoint from: {checkpoint_path} on {self.device}")
            self.model = load_checkpoint(str(checkpoint_path), device=str(self.device))
        else:
            print(f"Warning: No checkpoint found at {checkpoint_path}. Running with pre-trained backbone.")
            from model import build_model
            self.model = build_model(DEFAULT_MODEL_NAME, pretrained=True)
            self.model.to(self.device)
            self.model.eval()

    def predict(self, image_input) -> dict:
        """
        Classifies an input image and outputs a VisionAppraisalResponse JSON structure.
        """
        inferred_at = datetime.now(timezone.utc).isoformat()

        if isinstance(image_input, (str, Path)):
            try:
                img = Image.open(image_input).convert("RGB")
            except Exception as e:
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
        top_confidence = round(float(probs[top_idx]), 4)

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
        print("Usage: python predict.py <path_to_image>")
        sys.exit(1)

    classifier = VisionClassifier()
    result = classifier.predict(sys.argv[1])
    print(json.dumps(result, indent=2))
