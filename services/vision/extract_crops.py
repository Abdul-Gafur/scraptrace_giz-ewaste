"""
Extract labeled e-waste crops from COCO annotations + cached GIZ images.
Produces 224x224 cropped images organized by contract category in data/processed/.
"""

import json
import sys
from pathlib import Path
from collections import Counter

from PIL import Image
from tqdm import tqdm
from huggingface_hub import hf_hub_download, HfApi

from config import (
    PROCESSED_DATA_DIR,
    IMAGE_SIZE,
    HF_LABEL_MAPPING,
    CONTRACT_CATEGORIES,
    CATEGORY_TO_IDX,
)

# COCO category → ScrapTrace contract category
COCO_TO_CONTRACT = {
    "ACs": "air_conditioners",
    "Compressors": "compressors",
    "Computers": "laptops_and_desktop_computers",
    "Fridges": "refrigerators",
    "Laptops": "laptops_and_desktop_computers",
    "Microwave": "microwaves",
    "TV": "televisions",
    "unsure": "mixed_scrap",
}

HF_IMAGE_REPO = "GIZ/E-Waste-Database"
HF_COCO_REPO = "GIZ/e-waste-dataset-COCO-labels"
COCO_JSON_PATH = "COCO with Pictures/result.json"
COCO_IMAGES_PREFIX = "COCO with Pictures/images/"

CROP_PAD_RATIO = 0.10  # 10% padding around bounding box


def download_coco_json() -> dict:
    """Download and parse the COCO result.json annotations."""
    print("[1/4] Downloading COCO annotations (result.json)...")
    json_path = hf_hub_download(HF_COCO_REPO, COCO_JSON_PATH, repo_type="dataset")
    with open(json_path) as f:
        return json.load(f)


def build_filename_to_sha256() -> dict:
    """Build mapping from filename → sha256 for GIZ/E-Waste-Database blobs."""
    print("[2/4] Building filename → sha256 index for GIZ/E-Waste-Database...")
    api = HfApi()
    mapping = {}
    for f in api.list_repo_tree(HF_IMAGE_REPO, repo_type="dataset"):
        if hasattr(f, "lfs") and f.lfs:
            mapping[f.path] = f.lfs.sha256
    print(f"  Indexed {len(mapping)} LFS files.")
    return mapping


def resolve_blob_path(sha256: str) -> Path:
    """Resolve a sha256 hash to the local HF cache blob path."""
    blobs_dir = Path.home() / ".cache/huggingface/hub/datasets--GIZ--E-Waste-Database/blobs"
    blob_path = blobs_dir / sha256
    return blob_path if blob_path.exists() else None


def extract_crops(coco: dict, file_to_sha: dict):
    """Crop bounding boxes from cached images, resize to IMAGE_SIZE, save by category."""
    print("[3/4] Extracting and resizing labeled crops...")

    cat_id_to_name = {c["id"]: c["name"] for c in coco["categories"]}

    # Group annotations by image_id
    img_id_to_anns = {}
    for ann in coco["annotations"]:
        img_id_to_anns.setdefault(ann["image_id"], []).append(ann)

    # Build image_id → image metadata
    img_id_to_meta = {img["id"]: img for img in coco["images"]}

    # Create output directories
    for cat in CONTRACT_CATEGORIES:
        (PROCESSED_DATA_DIR / cat).mkdir(parents=True, exist_ok=True)

    stats = Counter()
    skipped_no_cache = 0
    skipped_bad_crop = 0

    for img_id, anns in tqdm(img_id_to_anns.items(), desc="Processing images"):
        meta = img_id_to_meta[img_id]
        raw_fn = meta["file_name"].split("/")[-1]

        # Strip COCO hash prefix: "ee1afe01-Motocycle.jpg" → "Motocycle.jpg"
        #                          "12345678__PXL_..." → "PXL_..."
        if "__" in raw_fn:
            clean_fn = raw_fn.split("__", 1)[-1]
        elif "-" in raw_fn:
            clean_fn = raw_fn.split("-", 1)[-1]
        else:
            clean_fn = raw_fn

        # 1. Try local cache first if available
        blob_path = None
        if file_to_sha:
            sha256 = file_to_sha.get(clean_fn)
            if sha256:
                blob_path = resolve_blob_path(sha256)

        # 2. Fallback: download on-demand from GIZ/e-waste-dataset-COCO-labels
        if not blob_path or not blob_path.exists():
            try:
                coco_rel_path = f"COCO with Pictures/{meta['file_name']}"
                blob_path = Path(hf_hub_download(HF_COCO_REPO, coco_rel_path, repo_type="dataset"))
            except Exception:
                skipped_no_cache += 1
                continue

        try:
            img = Image.open(blob_path).convert("RGB")
        except Exception:
            skipped_bad_crop += 1
            continue

        w, h = img.size

        for ann in anns:
            coco_cat = cat_id_to_name[ann["category_id"]]
            contract_cat = COCO_TO_CONTRACT.get(coco_cat)
            if not contract_cat:
                continue

            # COCO bbox: [x, y, width, height]
            bx, by, bw, bh = ann["bbox"]

            # Add padding
            pad_x = bw * CROP_PAD_RATIO
            pad_y = bh * CROP_PAD_RATIO
            x1 = max(0, int(bx - pad_x))
            y1 = max(0, int(by - pad_y))
            x2 = min(w, int(bx + bw + pad_x))
            y2 = min(h, int(by + bh + pad_y))

            if (x2 - x1) < 10 or (y2 - y1) < 10:
                skipped_bad_crop += 1
                continue

            crop = img.crop((x1, y1, x2, y2))
            crop = crop.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)

            out_name = f"{contract_cat}_{ann['id']:05d}.jpg"
            crop.save(PROCESSED_DATA_DIR / contract_cat / out_name, quality=90)
            stats[contract_cat] += 1

    return stats, skipped_no_cache, skipped_bad_crop


def write_manifest(stats: Counter):
    """Save a manifest JSON summarizing the extracted dataset."""
    manifest = {
        "source": "GIZ/e-waste-dataset-COCO-labels + GIZ/E-Waste-Database",
        "image_size": IMAGE_SIZE,
        "contract_categories": CONTRACT_CATEGORIES,
        "samples_per_category": dict(stats),
        "total_samples": sum(stats.values()),
    }
    manifest_path = PROCESSED_DATA_DIR / "dataset_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Manifest saved to {manifest_path}")


def main():
    print("=" * 60)
    print("ScrapTrace Vision — COCO Crop Extraction Pipeline")
    print("=" * 60)

    coco = download_coco_json()
    file_to_sha = build_filename_to_sha256()
    stats, skipped_cache, skipped_crop = extract_crops(coco, file_to_sha)

    print("\n[4/4] Extraction complete!")
    print(f"  Total crops saved: {sum(stats.values())}")
    print(f"  Skipped (not in local cache): {skipped_cache}")
    print(f"  Skipped (bad crop / unreadable): {skipped_crop}")
    print("\n  Per-category breakdown:")
    for cat in CONTRACT_CATEGORIES:
        print(f"    {cat}: {stats.get(cat, 0)}")

    write_manifest(stats)
    print("\nDone! Crops are ready in:", PROCESSED_DATA_DIR)


if __name__ == "__main__":
    main()
