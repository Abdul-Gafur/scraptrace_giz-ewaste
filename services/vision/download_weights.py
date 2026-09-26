"""
Model Weights Downloader & Git Size Manager for ScrapTrace Vision.

Ensures any collaborator can fetch or bootstrap all required pre-trained weights
and foundation model checkpoints locally without running into GitHub's 100 MB hard file limit.

Rules:
- Files < 100 MB (e.g. best_model.pth at 16 MB) are tracked in Git.
- Files > 100 MB (e.g. SigLIP at 330 MB, large checkpoints) CANNOT be pushed to GitHub.
  This script downloads and caches them on-demand on the collaborator's machine.
"""

import sys
import os
import argparse
from pathlib import Path
import torch

# Ensure services/vision is on path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import CHECKPOINTS_DIR, NUM_CLASSES, CONTRACT_CATEGORIES
from foundation_models import FOUNDATION_MODELS, build_foundation_model

GITHUB_FILE_SIZE_LIMIT_MB = 100.0


def format_bytes(bytes_num: int) -> str:
    """Format bytes into human-readable MB / GB."""
    mb = bytes_num / (1024 * 1024)
    if mb >= 1024:
        return f"{mb / 1024:.2f} GB"
    return f"{mb:.2f} MB"


def check_existing_checkpoints():
    """Inspects all checkpoints in checkpoints/ and checks their Git compatibility."""
    print("=" * 65)
    print("ScrapTrace Vision — Local Checkpoints Status")
    print("=" * 65)

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    checkpoints = list(CHECKPOINTS_DIR.glob("*.pth")) + list(CHECKPOINTS_DIR.glob("*.pt"))

    if not checkpoints:
        print("No local .pth or .pt checkpoints found in services/vision/checkpoints/.")
        return

    for cp in sorted(checkpoints):
        size_bytes = cp.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        if size_mb < GITHUB_FILE_SIZE_LIMIT_MB:
            status = f"✓ {size_mb:.1f} MB (Git Safe — under 100 MB limit)"
        else:
            status = f"⚠ {size_mb:.1f} MB (HUGE — exceeds GitHub 100 MB limit! Must remain gitignored)"

        print(f"  • {cp.name:<30} {status}")
        try:
            data = torch.load(cp, map_location="cpu", weights_only=False)
            if isinstance(data, dict):
                arch = data.get("model_name", "unknown")
                epoch = data.get("epoch", "N/A")
                val_f1 = data.get("val_f1", "N/A")
                print(f"    Architecture: {arch} | Epoch: {epoch} | Val F1: {val_f1}")
        except Exception as e:
            print(f"    (Could not parse metadata: {e})")


def download_or_cache_model(model_key: str):
    """
    Downloads or verifies the pre-trained weights for the specified foundation model.
    Timm and Hugging Face store cached weights in ~/.cache/huggingface/hub or ~/.cache/torch/hub.
    """
    info = FOUNDATION_MODELS.get(model_key)
    if not info:
        print(f"Error: Unknown model '{model_key}'. Available: {list(FOUNDATION_MODELS.keys())}")
        return False

    approx_mb = info.get("approx_size_mb", 0)
    is_huge = approx_mb >= GITHUB_FILE_SIZE_LIMIT_MB

    print("\n" + "-" * 65)
    print(f"Downloading / Caching: {model_key}")
    print(f"Description: {info['description']}")
    print(f"Estimated Weights Size: ~{approx_mb} MB")
    if is_huge:
        print("NOTE: This model exceeds GitHub's 100 MB limit. Weights are cached locally")
        print("      in ~/.cache/ and will NOT be committed to git, preventing push failures.")
    else:
        print("NOTE: This model is compact and safe for lightweight deployments.")
    print("-" * 65)

    try:
        model = build_foundation_model(model_key=model_key, pretrained=True)
        total_params = sum(p.numel() for p in model.parameters()) / 1e6
        print(f"✓ Model successfully built and verified! Total parameters: {total_params:.2f}M")
        return True
    except Exception as e:
        print(f"✗ Failed to download/initialize {model_key}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Download and verify vision model weights for ScrapTrace."
    )
    parser.add_argument(
        "--model",
        type=str,
        default="all",
        choices=["all", "check-only"] + list(FOUNDATION_MODELS.keys()),
        help="Which model weights to download / cache (default: all)",
    )
    args = parser.parse_args()

    check_existing_checkpoints()

    if args.model == "check-only":
        return

    print("\n" + "=" * 65)
    print("Foundation Weights Caching (Hugging Face / PyTorch Hub)")
    print("=" * 65)

    if args.model == "all":
        # Prioritize lightweight and medium first, then huge models
        models_to_download = ["efficientnet_b0", "mobilenetv3_large", "convnext_nano", "siglip_base"]
    else:
        models_to_download = [args.model]

    successes = []
    for m in models_to_download:
        ok = download_or_cache_model(m)
        if ok:
            successes.append(m)

    print("\n" + "=" * 65)
    print(f"Summary: Successfully verified {len(successes)}/{len(models_to_download)} models.")
    print("Collaborators can now run training or inference without missing weights!")
    print("=" * 65)


if __name__ == "__main__":
    main()
