# ScrapTrace Vision Service

The **Vision Service** manages dataset ingestion, exploratory analysis, foundation model training, evaluation, and contract-compliant inference for electronic waste image classification.

## Supported Taxonomy

The service maps raw image annotations to the 7 authoritative categories defined in `@scraptrace/contracts`:

1. `refrigerators`
2. `laptops_and_desktop_computers`
3. `televisions`
4. `microwaves`
5. `air_conditioners`
6. `compressors`
7. `mixed_scrap`

---

## Collaborator Quickstart (Get Everything with One Command)

If you just cloned or pulled the repository, you can set up, verify checkpoints, download data crops, and test inference with a single command:

```bash
npm run vision:setup
# Or directly:
python services/vision/setup_all.py
```

This automated script performs:
1. **Dependency check**: Verifies PyTorch, torchvision, timm, scikit-learn, etc.
2. **Checkpoint verification**: Confirms `best_model.pth` (16 MB, tracked in Git) or bootstraps pre-trained foundation weights.
3. **Dataset verification**: If `data/processed` is empty (it is excluded from Git to keep the repo fast and light), it automatically downloads the GIZ e-waste dataset from Hugging Face and extracts crops.
4. **End-to-End inference**: Runs a sample image through the classifier and verifies 100% compliance with `@scraptrace/contracts` schema (`VisionAppraisalResponse`).
5. **Git size safety**: Verifies that no files exceed GitHub's 100 MB limit so your `git push` will never fail.

---

## Foundation Models & Fine-Tuning

To prevent overfitting and achieve >90% per-category accuracy, ScrapTrace supports modern foundation vision backbones with automated weights streaming:

| Model Key | Backbone | Pre-Training | Weights Size | Notes |
|---|---|---|---|---|
| `convnext_nano` | Meta ConvNeXt-Nano | ImageNet-12K (12,000 object classes) | ~58 MB | State-of-the-art transfer learning, robust against noise |
| `siglip_base` | Google SigLIP (ViT-B/16) | Web-scale Vision-Language (ARIS e-waste) | ~330 MB | **Huge**: Auto-cached locally, excluded from Git |
| `efficientnet_b0` | EfficientNet-B0 | ImageNet-1K | 16 MB | Fast and compact baseline (`best_model.pth`) |
| `mobilenetv3_large`| MobileNetV3-Large | ImageNet-1K | 16 MB | Optimized for mobile/edge scrapyard devices |

### Fine-Tuning a Foundation Model

```bash
# Linear probe mode (freeze backbone, train classifier head — zero overfitting guarantee)
npm run vision:train:foundation -- --model convnext_nano --freeze-backbone --epochs 15

# Full fine-tuning with cosine annealing schedule
npm run vision:train:foundation -- --model convnext_nano --epochs 20 --lr 3e-4

# Train Google SigLIP Vision Transformer
npm run vision:train:foundation -- --model siglip_base --epochs 10
```

---

## Roboflow E-Waste Dataset Ingestion

To expand the dataset with external real-world e-waste imagery (monitors, keyboards, PCBs, CRT-TVs, refrigerators) from Roboflow Universe:

```bash
# Ingest and harmonize Roboflow YOLOv11 E-Waste dataset into data/processed/
npm run vision:fetch:roboflow -- --project razin

# Or ingest general electronic waste dataset
npm run vision:fetch:roboflow -- --project electronic_waste
```

---

## Model Weights & Git Limit Protection

GitHub enforces a **100 MB hard file limit**:
- Small checkpoints (e.g. `services/vision/checkpoints/best_model.pth` at 16 MB) **are tracked** and pushed to GitHub.
- Large foundation weights (e.g. SigLIP at 330 MB or large raw datasets) **are excluded from Git** via `.gitignore`.
- Collaborators can run `python services/vision/download_weights.py` to cache or bootstrap any foundation weights on-demand:

```bash
# Download and cache foundation model weights locally
npm run vision:weights

# Audit repository to ensure no file exceeds GitHub's 100 MB limit
npm run vision:audit:size
```

---

## Running Inference (Contract-Compliant Appraisal)

Run appraisal on any image to produce a schema-valid response:

```bash
npm run vision:predict path/to/e_waste_image.jpg
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
  "model_name": "scraptrace-vision-classifier",
  "model_version": "0.1.0",
  "inferred_at": "2026-09-26T22:45:26.111Z"
}
```

If top confidence is below the safety threshold (`< 0.40`), it gracefully outputs:

```json
{
  "outcome": "unable_to_classify",
  "reason": "low_confidence",
  "scores": [...],
  "model_name": "scraptrace-vision-classifier",
  "model_version": "0.1.0",
  "inferred_at": "2026-09-26T22:45:26.111Z"
}
```
