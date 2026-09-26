"""
Configuration and taxonomy mapping for ScrapTrace e-waste vision models.
Ensures 100% compliance with @scraptrace/contracts JSON schema.
"""

from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"
ARTIFACTS_DIR = BASE_DIR / "artifacts"

# Authoritative ScrapTrace Categories (matching packages/contracts)
CONTRACT_CATEGORIES = [
    "refrigerators",
    "laptops_and_desktop_computers",
    "televisions",
    "microwaves",
    "air_conditioners",
    "compressors",
    "mixed_scrap",
]

NUM_CLASSES = len(CONTRACT_CATEGORIES)
CATEGORY_TO_IDX = {cat: idx for idx, cat in enumerate(CONTRACT_CATEGORIES)}
IDX_TO_CATEGORY = {idx: cat for idx, cat in enumerate(CONTRACT_CATEGORIES)}

# Mapping from common dataset/label names (e.g. from GIZ Hugging Face) to contract categories
HF_LABEL_MAPPING = {
    "fridges": "refrigerators",
    "fridge": "refrigerators",
    "refrigerator": "refrigerators",
    "refrigerators": "refrigerators",
    "laptops/pcs": "laptops_and_desktop_computers",
    "laptops_pcs": "laptops_and_desktop_computers",
    "laptops": "laptops_and_desktop_computers",
    "pcs": "laptops_and_desktop_computers",
    "laptops_and_desktop_computers": "laptops_and_desktop_computers",
    "tv": "televisions",
    "tvs": "televisions",
    "television": "televisions",
    "televisions": "televisions",
    "microwaves": "microwaves",
    "microwave": "microwaves",
    "ac": "air_conditioners",
    "acs": "air_conditioners",
    "air conditioner": "air_conditioners",
    "air_conditioner": "air_conditioners",
    "air_conditioners": "air_conditioners",
    "compressors": "compressors",
    "compressor": "compressors",
    "mixed scrap": "mixed_scrap",
    "mixed scraps": "mixed_scrap",
    "mixed_scrap": "mixed_scrap",
    "mixed_scraps": "mixed_scrap",
}

# Model and training hyperparameters
DEFAULT_MODEL_NAME = "mobilenetv3_large_100"
IMAGE_SIZE = 224
BATCH_SIZE = 32
NUM_EPOCHS = 15
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4
CONFIDENCE_THRESHOLD = 0.40  # Below this threshold, output 'unable_to_classify'
SEED = 42
