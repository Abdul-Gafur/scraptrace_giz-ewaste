# ScrapTrace Vision Service

The **Vision Service** manages dataset ingestion, exploratory analysis, model training, evaluation, and contract-compliant inference for electronic waste image classification.

The released model classifies one image as a whole. It does not detect, count, or localize multiple objects and does not produce bounding boxes. Low-confidence or ambiguous results must be confirmed manually.

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

The Python environment is managed using `uv` with Python 3.10.11 (declared in the repository `.python-version`):

```bash
# Create and activate virtual environment
uv venv --python 3.10.11 .venv
source .venv/bin/activate

# Install vision dependencies
uv pip install --python .venv/bin/python -r services/vision/requirements.txt
```

## Dataset Workflow

### 1. Download & Extract E-Waste Crops

Extracts bounding-box crops from the GIZ COCO dataset (~1,232 samples) and formats them into `data/processed/` (compact ~23 MB):

```bash
source .venv/bin/activate
python -m services.vision.extract_crops
```

### 2. Train Vision Classifier

Fine-tunes the manifest-selected lightweight backbone with data augmentations (lighting, angles, noise) and cosine learning rate scheduling. The current v0.2.0 release uses EfficientNet-B0:

```bash
source .venv/bin/activate
python -m services.vision.train
```

- Hardware Acceleration: Automatically leverages Apple Silicon **Metal Performance Shaders (MPS)** or NVIDIA **CUDA**.
- Checkpoints: Best model weights are persisted to `services/vision/checkpoints/best_model.pth`.
- Release manifest: `services/vision/checkpoints/model_manifest.json` defines the canonical class order, preprocessing, version, evaluation, and checkpoint digest.
- Metrics: Loss, accuracy, macro F1, and per-class reports are recorded in `services/vision/artifacts/training_metrics.json`.

### 3. Run Inference & Contract-Compliant Appraisal

Run appraisal on any image to produce a schema-valid response:

```bash
source .venv/bin/activate
python services/vision/predict.py /path/to/e_waste_image.jpg
```

Inference refuses to load a missing, corrupt, incompatible, or checksum-mismatched checkpoint. Before running a released model, set `checkpoint_sha256` in the manifest to the output of `shasum -a 256 services/vision/checkpoints/best_model.pth`. Diagnostics are written to `stderr`; `stdout` remains JSON.

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
  "model_name": "scraptrace-vision-efficientnet-b0",
  "model_version": "0.2.0",
  "inferred_at": "2026-09-26T12:30:00Z"
}
```

If top confidence is below the safety threshold (`< 0.40`), it gracefully outputs:

```json
{
  "outcome": "unable_to_classify",
  "reason": "low_confidence",
  "scores": [...],
  "model_name": "scraptrace-vision-efficientnet-b0",
  "model_version": "0.2.0",
  "inferred_at": "2026-09-26T12:30:00Z"
}
```
