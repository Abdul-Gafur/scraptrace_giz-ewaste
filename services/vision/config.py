"""
Configuration and taxonomy mapping for ScrapTrace e-waste vision models.
Ensures 100% compliance with @scraptrace/contracts JSON schema.
"""

from pathlib import Path

from services.vision.manifest import load_model_manifest

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
CHECKPOINTS_DIR = BASE_DIR / "checkpoints"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODEL_MANIFEST_PATH = CHECKPOINTS_DIR / "model_manifest.json"
VISION_RESPONSE_SCHEMA_PATH = (
    PROJECT_ROOT / "packages/contracts/schemas/vision_appraisal_response.schema.json"
)

MODEL_MANIFEST = load_model_manifest(MODEL_MANIFEST_PATH, VISION_RESPONSE_SCHEMA_PATH)

# Checked against the generated TypeScript/Zod contract at import time.
CONTRACT_CATEGORIES = MODEL_MANIFEST.contract_categories

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
DEFAULT_MODEL_NAME = MODEL_MANIFEST.architecture
IMAGE_SIZE = MODEL_MANIFEST.input_width
IMAGE_MEAN = MODEL_MANIFEST.normalization_mean
IMAGE_STD = MODEL_MANIFEST.normalization_std
BATCH_SIZE = 32
NUM_EPOCHS = 15
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4
CONFIDENCE_THRESHOLD = 0.40  # CLI default; API value is environment-configurable.
SEED = 42
