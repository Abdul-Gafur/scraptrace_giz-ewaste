"""
Roboflow E-Waste Dataset Ingestion & Preprocessing Script.
Fetches external e-waste datasets (e.g. razin/e-waste-c8eii, electronic-waste-dataset)
from Roboflow Universe and harmonizes them into ScrapTrace's 7 authoritative contract categories.

This expands training data volume without committing large datasets to GitHub.
Collaborators can run this on their local machines to augment training data.
"""

import os
import sys
import argparse
from pathlib import Path
from PIL import Image
from tqdm import tqdm

from config import (
    PROCESSED_DATA_DIR,
    IMAGE_SIZE,
    CONTRACT_CATEGORIES,
    CATEGORY_TO_IDX,
)

# Mapping from Roboflow Universe classes to ScrapTrace contract categories
ROBOFLOW_TO_CONTRACT = {
    # Laptops & Desktops
    "laptop": "laptops_and_desktop_computers",
    "laptops": "laptops_and_desktop_computers",
    "desktop-pc": "laptops_and_desktop_computers",
    "computer-keyboard": "laptops_and_desktop_computers",
    "keyboard": "laptops_and_desktop_computers",
    "monitors": "laptops_and_desktop_computers",
    "crt-monitor": "laptops_and_desktop_computers",
    "computer-mouse": "laptops_and_desktop_computers",
    "mouse": "laptops_and_desktop_computers",
    
    # Televisions
    "tv": "televisions",
    "tvs": "televisions",
    "television": "televisions",
    "crt-tv": "televisions",
    
    # Refrigerators
    "refrigerator": "refrigerators",
    "refrigerators": "refrigerators",
    "fridge": "refrigerators",
    "cooling-display": "refrigerators",
    "cooled-dispenser": "refrigerators",
    
    # Air Conditioners
    "air-conditioner": "air_conditioners",
    "air conditioner": "air_conditioners",
    "dehumidifier": "air_conditioners",
    
    # Microwaves
    "microwave": "microwaves",
    "microwaves": "microwaves",
    
    # Compressors
    "compressor": "compressors",
    "compressors": "compressors",
    
    # Mixed Scrap & PCB Components
    "pcb": "mixed_scrap",
    "circuit-board": "mixed_scrap",
    "drycell": "mixed_scrap",
    "battery": "mixed_scrap",
    "coincell": "mixed_scrap",
    "e-waste": "mixed_scrap",
    "electronic-waste": "mixed_scrap",
}

AVAILABLE_PROJECTS = {
    "razin": {
        "workspace": "razin",
        "project": "e-waste-c8eii",
        "version": 1,
        "description": "YOLOv11 E-Waste (Laptops, Monitors, Fridges, Keyboards, PCBs)",
    },
    "electronic_waste": {
        "workspace": "electronic-waste",
        "project": "electronic-waste-dataset",
        "version": 1,
        "description": "Electronic Waste Dataset (ACs, CRT-TVs, Microwaves, PCs, Fridges)",
    },
}


def download_from_roboflow(api_key: str, project_name: str = "razin", output_dir: Path = None):
    """
    Downloads dataset via official Roboflow Python SDK.
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        print("Installing roboflow SDK...")
        os.system(f"{sys.executable} -m pip install roboflow")
        from roboflow import Roboflow

    proj_info = AVAILABLE_PROJECTS.get(project_name, AVAILABLE_PROJECTS["razin"])
    print(f"Connecting to Roboflow Universe: {proj_info['workspace']}/{proj_info['project']}...")

    rf = Roboflow(api_key=api_key)
    project = rf.workspace(proj_info["workspace"]).project(proj_info["project"])
    dataset = project.version(proj_info["version"]).download("folder", location=str(output_dir))
    return dataset


def process_downloaded_images(source_dir: Path):
    """
    Scans downloaded images, crops / resizes to 224x224, maps classes,
    and integrates them into data/processed/.
    """
    print(f"Processing downloaded images from: {source_dir}...")
    stats = {cat: 0 for cat in CONTRACT_CATEGORIES}

    # Search for all image files
    extensions = ("*.jpg", "*.jpeg", "*.png")
    image_files = []
    for ext in extensions:
        image_files.extend(source_dir.rglob(ext))

    print(f"Found {len(image_files)} images to inspect.")

    for img_path in tqdm(image_files, desc="Harmonizing crops"):
        # Determine category from parent directory name or filename
        parent_name = img_path.parent.name.lower().replace("_", "-")
        target_cat = None
        for rf_key, contract_cat in ROBOFLOW_TO_CONTRACT.items():
            if rf_key in parent_name or rf_key in img_path.name.lower():
                target_cat = contract_cat
                break

        if not target_cat:
            continue

        try:
            img = Image.open(img_path).convert("RGB")
            # Resize with Lanczos to standard contract dimension
            img_resized = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
            out_name = f"rf_{img_path.stem}.jpg"
            dest = PROCESSED_DATA_DIR / target_cat / out_name
            dest.parent.mkdir(parents=True, exist_ok=True)
            img_resized.save(dest, quality=90)
            stats[target_cat] += 1
        except Exception:
            continue

    print("\nRoboflow harmonization complete!")
    for cat, count in stats.items():
        if count > 0:
            print(f"  + Added {count} images to {cat}")
    print(f"Total new images integrated into data/processed: {sum(stats.values())}")


def main():
    parser = argparse.ArgumentParser(description="Fetch and harmonize Roboflow e-waste datasets.")
    parser.add_argument(
        "--api-key",
        type=str,
        default=os.getenv("ROBOFLOW_API_KEY"),
        help="Roboflow API key (free at https://app.roboflow.com)",
    )
    parser.add_argument(
        "--project",
        type=str,
        choices=list(AVAILABLE_PROJECTS.keys()),
        default="razin",
        help="Which Roboflow dataset to download",
    )
    parser.add_argument(
        "--local-dir",
        type=str,
        default=None,
        help="Process an already-downloaded local folder of images instead of downloading via API",
    )
    args = parser.parse_args()

    if args.local_dir:
        process_downloaded_images(Path(args.local_dir))
        return

    if not args.api_key:
        print("=" * 60)
        print("Roboflow E-Waste Dataset Ingestion")
        print("=" * 60)
        print("To download directly from Roboflow Universe:")
        print("1. Get a free API key at https://app.roboflow.com")
        print("2. Run:")
        print(f"   python services/vision/fetch_roboflow_data.py --api-key YOUR_API_KEY --project {args.project}")
        print("\nOr, if you downloaded images manually from Universe, run:")
        print("   python services/vision/fetch_roboflow_data.py --local-dir /path/to/extracted/folder")
        print("=" * 60)
        sys.exit(0)

    tmp_download_dir = Path("/tmp/roboflow_ewaste")
    download_from_roboflow(args.api_key, args.project, tmp_download_dir)
    process_downloaded_images(tmp_download_dir)


if __name__ == "__main__":
    main()
