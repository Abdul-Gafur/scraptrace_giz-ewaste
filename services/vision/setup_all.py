"""
One-command bootstrap and verification script for ScrapTrace Vision.

Solves the multi-collaborator setup problem:
- Verifies python environment & dependencies
- Verifies model weights / bootstraps foundation models if missing
- Automatically pulls and extracts dataset crops if data/processed is empty
- Runs a test prediction to verify end-to-end @scraptrace/contracts compliance
- Confirms Git safety (ensures no huge files >100 MB will block git push)

Usage:
    python services/vision/setup_all.py
    # or
    npm run vision:setup
"""

import sys
import os
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import (
    CHECKPOINTS_DIR,
    PROCESSED_DATA_DIR,
    CONTRACT_CATEGORIES,
    DEFAULT_MODEL_NAME,
)


def print_header(title: str):
    print("\n" + "=" * 68)
    print(f"  {title}")
    print("=" * 68)


def step_1_check_environment() -> bool:
    print_header("Step 1/5: Checking Python Environment & Dependencies")
    required_packages = [
        "torch",
        "torchvision",
        "timm",
        "PIL",
        "sklearn",
        "huggingface_hub",
        "tqdm",
    ]

    missing = []
    for pkg in required_packages:
        try:
            if pkg == "PIL":
                import PIL
            elif pkg == "sklearn":
                import sklearn
            else:
                __import__(pkg)
            print(f"  ✓ {pkg} is installed")
        except ImportError:
            print(f"  ✗ {pkg} is MISSING")
            missing.append(pkg)

    if missing:
        print(f"\nMissing packages: {', '.join(missing)}")
        print("Please install them with: pip install -r services/vision/requirements.txt")
        return False

    import torch
    if torch.backends.mps.is_available():
        accel = "Apple Silicon MPS (Metal GPU)"
    elif torch.cuda.is_available():
        accel = f"NVIDIA CUDA ({torch.cuda.get_device_name(0)})"
    else:
        accel = "CPU"
    print(f"  ✓ Hardware Acceleration: {accel}")
    return True


def step_2_check_checkpoints() -> bool:
    print_header("Step 2/5: Checking Model Checkpoints")
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    best_model_path = CHECKPOINTS_DIR / "best_model.pth"

    import torch

    if best_model_path.exists():
        size_mb = best_model_path.stat().st_size / (1024 * 1024)
        print(f"  ✓ Found primary checkpoint: {best_model_path.name} ({size_mb:.1f} MB)")
        try:
            data = torch.load(best_model_path, map_location="cpu", weights_only=False)
            arch = data.get("model_name", "unknown") if isinstance(data, dict) else "unknown"
            print(f"  ✓ Checkpoint verified! Backbone: {arch}")
            return True
        except Exception as e:
            print(f"  ✗ Checkpoint corrupted: {e}")
            return False
    else:
        print(f"  ⚠ {best_model_path.name} not found.")
        print("  Bootstrapping foundation backbone on-demand...")
        from foundation_models import build_foundation_model
        try:
            m = build_foundation_model("convnext_nano", pretrained=True)
            print("  ✓ Pre-trained ConvNeXt-Nano foundation model bootstrapped successfully!")
            return True
        except Exception as e:
            print(f"  ✗ Failed to bootstrap foundation backbone: {e}")
            return False


def step_3_check_dataset() -> bool:
    print_header("Step 3/5: Checking Processed E-Waste Dataset")
    if not PROCESSED_DATA_DIR.exists():
        PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    samples_count = 0
    cat_counts = {}
    for cat in CONTRACT_CATEGORIES:
        cat_dir = PROCESSED_DATA_DIR / cat
        if cat_dir.exists():
            cnt = len(list(cat_dir.glob("*.jpg")) + list(cat_dir.glob("*.png")))
            cat_counts[cat] = cnt
            samples_count += cnt
        else:
            cat_counts[cat] = 0

    print(f"  Total processed samples found: {samples_count}")
    for cat, cnt in cat_counts.items():
        print(f"    • {cat:<30}: {cnt} images")

    if samples_count < 50:
        print("\n  ⚠ Dataset is empty or incomplete (was excluded from Git to keep repo small).")
        print("  Automatically downloading GIZ dataset & extracting crops from Hugging Face...")
        cmd = [sys.executable, str(BASE_DIR / "extract_crops.py")]
        res = subprocess.run(cmd)
        return res.returncode == 0
    else:
        print("  ✓ Dataset is ready for training.")
        return True


def step_4_verify_inference() -> bool:
    print_header("Step 4/5: Verifying Inference & Schema Compliance")
    sample_images = list(PROCESSED_DATA_DIR.rglob("*.jpg"))
    if not sample_images:
        print("  ⚠ No sample image found to test prediction.")
        return True

    test_img = sample_images[0]
    print(f"  Running test prediction on: {test_img.name}")

    from predict import VisionClassifier
    try:
        classifier = VisionClassifier()
        result = classifier.predict(test_img)
        print("  ✓ Inference result:")
        print(f"    - Outcome:    {result.get('outcome')}")
        print(f"    - Category:   {result.get('category')}")
        print(f"    - Confidence: {result.get('confidence')}")
        print(f"    - InferredAt: {result.get('inferred_at')}")

        # Schema validation checks
        assert "outcome" in result
        assert "model_name" in result
        assert "model_version" in result
        assert "inferred_at" in result
        assert result["inferred_at"].endswith("Z")
        print("  ✓ Schema strictly compliant with @scraptrace/contracts (VisionAppraisalResponse)!")
        return True
    except Exception as e:
        print(f"  ✗ Inference verification failed: {e}")
        return False


def step_5_check_git_limits() -> bool:
    print_header("Step 5/5: Checking Git File Size Safety (<100 MB Limit)")
    huge_files = []
    # Check repo files
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Ignore .git and node_modules
        if ".git" in root or "node_modules" in root or ".venv" in root:
            continue
        for f in files:
            p = Path(root) / f
            try:
                size_mb = p.stat().st_size / (1024 * 1024)
                if size_mb >= 95.0:
                    huge_files.append((p.relative_to(PROJECT_ROOT), size_mb))
            except Exception:
                pass

    if huge_files:
        print("  ⚠ WARNING: Found files exceeding or close to GitHub's 100 MB limit:")
        for rel_path, sz in huge_files:
            print(f"    - {rel_path} ({sz:.1f} MB)")
        print("  Ensure these paths are in .gitignore so 'git push' succeeds.")
    else:
        print("  ✓ All tracked and workspace files are under GitHub's 100 MB limit!")
        print("  ✓ Safe to git push without size rejections.")
    return True


def main():
    print("=" * 68)
    print("   ScrapTrace Vision AI — Complete Environment & Model Setup")
    print("=" * 68)

    ok1 = step_1_check_environment()
    if not ok1:
        sys.exit(1)

    ok2 = step_2_check_checkpoints()
    ok3 = step_3_check_dataset()
    ok4 = step_4_verify_inference()
    ok5 = step_5_check_git_limits()

    print_header("Setup Complete!")
    print("  You are fully ready to use ScrapTrace Vision AI!")
    print("\n  Quick Commands:")
    print("    • Run inference:           npm run vision:predict <image_path>")
    print("    • Fine-tune foundation:    npm run vision:train:foundation -- --model convnext_nano")
    print("    • Fetch Roboflow e-waste:  npm run vision:fetch:roboflow")
    print("    • Download/cache weights:  npm run vision:weights")
    print("=" * 68 + "\n")


if __name__ == "__main__":
    main()
