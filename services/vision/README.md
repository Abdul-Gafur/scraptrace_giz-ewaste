# ScrapTrace Vision Service

The **Vision Service** manages dataset ingestion, exploratory analysis, model training, evaluation, and contract-compliant inference for electronic waste image classification.

## Supported Taxonomy

The service maps raw image annotations to the 7 authoritative categories defined in `@scraptrace/contracts`:

1. `refrigerators`
2. `laptops_and_desktop_computers`
3. `televisions`
4. `microwaves`
5. `air_conditioners`
6. `compressors`
7. `mixed_scrap`

## Environment Setup

The Python environment is managed using `uv` with Python 3.12:

```bash
# Create and activate virtual environment
uv venv --python 3.12 .venv
source .venv/bin/activate

# Install vision dependencies
uv pip install -r services/vision/requirements.txt
```

## Dataset Workflow

### 1. Download & Extract E-Waste Crops

Extracts bounding-box crops from the GIZ COCO dataset (~1,232 samples) and formats them into `data/processed/` (compact ~23 MB):

```bash
source .venv/bin/activate
python services/vision/extract_crops.py
```

### 2. Train Vision Classifier

Fine-tunes a lightweight MobileNetV3 backbone with data augmentations (lighting, angles, noise) and cosine learning rate scheduling:

```bash
source .venv/bin/activate
python services/vision/train.py
```

- Hardware Acceleration: Automatically leverages Apple Silicon **Metal Performance Shaders (MPS)** or NVIDIA **CUDA**.
- Checkpoints: Best model weights are persisted to `services/vision/checkpoints/best_model.pth`.
- Metrics: Loss, accuracy, macro F1, and per-class reports are recorded in `services/vision/artifacts/training_metrics.json`.

### 3. Run Inference & Contract-Compliant Appraisal

Run appraisal on any image to produce a schema-valid response:

```bash
source .venv/bin/activate
python services/vision/predict.py /path/to/e_waste_image.jpg
```

Output example:

```json
{
  "outcome": "classified",
  "category": "televisions",
  "scores": [
    { "category": "refrigerators", "score": 0.02 },
    { "category": "laptops_and_desktop_computers", "score": 0.03 },
    { "category": "televisions", "score": 0.88 },
    { "category": "microwaves", "score": 0.02 },
    { "category": "air_conditioners", "score": 0.02 },
    { "category": "compressors", "score": 0.01 },
    { "category": "mixed_scrap", "score": 0.02 }
  ],
  "confidence": 0.88,
  "model_name": "scraptrace-vision-mobilenetv3",
  "model_version": "0.1.0",
  "inferred_at": "2026-09-26T12:30:00Z"
}
```

If top confidence is below the safety threshold (`< 0.40`), it gracefully outputs:

```json
{
  "outcome": "unable_to_classify",
  "reason": "low_confidence",
  "scores": [...],
  "model_name": "scraptrace-vision-mobilenetv3",
  "model_version": "0.1.0",
  "inferred_at": "2026-09-26T12:30:00Z"
}
```
