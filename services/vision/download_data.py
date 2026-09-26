"""
Dataset downloader and explorer for GIZ E-Waste Database.
Fetches data from Hugging Face (GIZ/E-Waste-Database), inspects features,
and organizes it into data/raw for model training.
"""

import sys
import json
from pathlib import Path
from tqdm import tqdm

from config import (
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
    CONTRACT_CATEGORIES,
    HF_LABEL_MAPPING,
    CATEGORY_TO_IDX,
)

def download_and_inspect():
    print("=" * 60)
    print("ScrapTrace Vision - GIZ E-Waste Dataset Setup")
    print("=" * 60)

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    try:
        from datasets import load_dataset
        import pandas as pd
    except ImportError:
        print("Error: 'datasets' or 'pandas' not installed. Please activate .venv.")
        sys.exit(1)

    print("\n[1/3] Connecting to Hugging Face: GIZ/E-Waste-Database...")
    try:
        # Load dataset
        ds = load_dataset("GIZ/E-Waste-Database")
        print(f"Successfully connected! Dataset splits found: {list(ds.keys())}")
    except Exception as e:
        print(f"Warning: Direct load_dataset failed with: {e}")
        print("Attempting to inspect repository via huggingface_hub snapshot or parquet...")
        try:
            from huggingface_hub import HfApi
            api = HfApi()
            files = api.list_repo_files("GIZ/E-Waste-Database", repo_type="dataset")
            print(f"Files in GIZ/E-Waste-Database: {files[:20]}")
            # Try loading default
            ds = load_dataset("GIZ/E-Waste-Database", trust_remote_code=True)
        except Exception as e2:
            print(f"Could not automatically load Hugging Face dataset: {e2}")
            print("\nPlease ensure your network allows connecting to huggingface.co.")
            sys.exit(1)

    print("\n[2/3] Inspecting dataset features and distribution...")
    all_records = []
    
    for split_name, split_data in ds.items():
        print(f"\n--- Split: {split_name} ({len(split_data)} items) ---")
        features = split_data.features
        print(f"Features: {features}")

        # Check label column name
        label_col = None
        for candidate in ["label", "category", "class", "target", "labels"]:
            if candidate in features:
                label_col = candidate
                break

        image_col = None
        for candidate in ["image", "img", "file"]:
            if candidate in features:
                image_col = candidate
                break

        print(f"Image column: {image_col}, Label column: {label_col}")

        # Determine class distribution
        labels_distribution = {}
        for idx in range(min(len(split_data), 500)):
            item = split_data[idx]
            raw_label = item.get(label_col) if label_col else "unknown"
            if isinstance(raw_label, int) and hasattr(features[label_col], "names"):
                raw_label = features[label_col].names[raw_label]
            normalized = str(raw_label).lower().strip()
            mapped = HF_LABEL_MAPPING.get(normalized, normalized)
            labels_distribution[mapped] = labels_distribution.get(mapped, 0) + 1

        print(f"Sample distribution (first {min(len(split_data), 500)} items):")
        for cat, cnt in sorted(labels_distribution.items()):
            valid_flag = "✓ (Valid Contract Category)" if cat in CONTRACT_CATEGORIES else "⚠ (Unmapped)"
            print(f"  - {cat}: {cnt} {valid_flag}")

    print("\n[3/3] Exporting metadata manifest...")
    manifest_path = PROCESSED_DATA_DIR / "dataset_manifest.json"
    manifest = {
        "dataset_name": "GIZ/E-Waste-Database",
        "splits": {k: len(v) for k, v in ds.items()},
        "contract_categories": CONTRACT_CATEGORIES,
    }
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest written to: {manifest_path}")
    print("\nDataset ready for model training!")

if __name__ == "__main__":
    download_and_inspect()
