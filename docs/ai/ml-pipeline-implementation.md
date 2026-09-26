# ScrapTrace Computer Vision ML Pipeline

## 1. Overview & Architecture

The **ScrapTrace Vision ML Pipeline** classifies electronic waste items captured in Ghanaian scrapyards into seven authoritative categories required by `@scraptrace/contracts`. The model is designed for low-latency, edge-friendly execution with an offline-first architecture suitable for resource-constrained field environments (such as Agbogbloshie).

### Key Technical Specifications

| Parameter | Specification |
|---|---|
| **Task** | Multi-class image classification (7 categories) |
| **Model Architecture** | MobileNetV3-Large (`mobilenetv3_large_100`) |
| **Pretrained Weights** | ImageNet-1K feature backbone |
| **Input Resolution** | $224 \times 224 \times 3$ RGB |
| **Model Parameters** | ~4.2 Million |
| **Checkpoint Size** | 16 MB (`best_model.pth`) |
| **Primary Acceleration** | Apple Silicon Metal Performance Shaders (MPS) / NVIDIA CUDA / CPU fallback |
| **Training Runtime** | ~2.3 minutes (15 epochs on Apple M-series MPS) |
| **Output Contract** | Strict compliance with `VisionAppraisalResponseSchema` (`@scraptrace/contracts`) |

---

## 2. Taxonomy & Contract Alignment

The pipeline maps the raw GIZ e-waste dataset labels and COCO annotations to the 7 authoritative categories defined in `packages/contracts/src/recovery-record/recovery-record.schema.ts`:

| # | Contract Category | GIZ / COCO Source Labels | Class ID |
|---|---|---|---|
| 1 | `refrigerators` | `Fridges`, `fridge`, `refrigerator` | 0 |
| 2 | `laptops_and_desktop_computers` | `Computers`, `Laptops`, `laptops/pcs`, `pcs` | 1 |
| 3 | `televisions` | `TV`, `tv`, `television`, `tvs` | 2 |
| 4 | `microwaves` | `Microwave`, `microwaves` | 3 |
| 5 | `air_conditioners` | `ACs`, `ac`, `air conditioner`, `air_conditioner` | 4 |
| 6 | `compressors` | `Compressors`, `compressor` | 5 |
| 7 | `mixed_scrap` | `unsure`, `mixed scrap`, `mixed_scraps` | 6 |

---

## 3. Data Pipeline & Extraction

### Source Data
* **Repository**: Hugging Face `GIZ/e-waste-dataset-COCO-labels` + `GIZ/E-Waste-Database`
* **Annotations**: 1,790 labeled bounding boxes across 752 images in `COCO with Pictures/result.json`

### Memory-Efficient Crop Pipeline (`services/vision/extract_crops.py`)
Rather than downloading the full ~20 GB raw database:
1. `extract_crops.py` parses `result.json` to identify bounding box coordinates $[x, y, w, h]$.
2. Adds a **10% contextual padding** around each bounding box.
3. Resizes crops to $224 \times 224$ via high-quality Lanczos resampling.
4. Organizes them into `data/processed/<category>/<category>_<ann_id>.jpg`.
5. **Zero-Setup Fallback**: Automatically checks local HF cache first; if missing (e.g. clean clone), downloads only the 752 annotated source images on demand directly from the COCO repo.
6. **Total footprint**: **1,232 images** taking only **23 MB** on disk.

### Dataset Distribution
```text
  laptops_and_desktop_computers : 288 samples
  compressors                   : 218 samples
  air_conditioners              : 213 samples
  refrigerators                 : 187 samples
  televisions                   : 170 samples
  microwaves                    : 140 samples
  mixed_scrap                   :  16 samples (underrepresented minority class)
  --------------------------------------------------
  Total                         : 1,232 samples
```

---

## 4. Scrapyard Data Augmentations (`services/vision/dataset.py`)

Scrapyard photos exhibit extreme variations in harsh outdoor equatorial sunlight, dust, angle tilt, partial occlusion, and budget smartphone sensor quality. Training data is augmented on-the-fly:

```python
train_transforms = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.2),
    transforms.RandomRotation(degrees=15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])
```

---

## 5. Training Strategy & Optimization (`services/vision/train.py`)

### Stratified Splitting
* **Train**: 75% (924 samples)
* **Validation**: 15% (184 samples)
* **Test**: 10% (124 samples)
* Stratified splitting guarantees that minority classes (`mixed_scrap`) maintain representation across all three sets.

### Class Imbalance Compensation
Inverse class-frequency loss weighting prevents majority classes (laptops, compressors) from dominating the gradients over sparse classes:
$$w_c = \frac{N}{\sum_{k} \frac{1}{N_k}} \cdot \frac{1}{N_c}$$

### Hyperparameters
* **Optimizer**: AdamW ($\beta_1=0.9, \beta_2=0.999$, weight decay $= 10^{-4}$)
* **Learning Rate**: $10^{-4}$ with `CosineAnnealingLR` schedule across 15 epochs
* **Batch Size**: 32
* **Loss Function**: Weighted Cross-Entropy Loss
* **Checkpointing**: Persisted when validation macro-F1 achieves a new maximum.

---

## 6. Evaluation Results against SRS Criteria

The project's Software Requirements Specification (SRS) requires:
> *"Held-out evaluation reports macro-F1 of at least 0.70 and every one of the seven category recalls is at least 0.50."*

### Test Set Performance (Best Checkpoint — Epoch 13)

| Metric | Target Floor | Achieved Result | Status |
|---|---|---|---|
| **Macro F1 Score** | $\ge 0.70$ | **0.8135** | ✅ **Passed (+11.3% above floor)** |
| **Overall Accuracy** | — | **87.10%** | ✅ **Passed** |
| **Weighted F1 Score** | — | **0.8696** | ✅ **Passed** |

### Per-Category Performance

| Category | Precision | Recall (Floor $\ge 0.50$) | F1-Score | Test Support |
|---|---|---|---|---|
| **Compressors** | 0.8800 | **1.0000** | **0.9362** | 22 |
| **Laptops & Desktops** | 0.9310 | **0.9310** | **0.9310** | 29 |
| **Refrigerators** | 0.9412 | **0.8421** | **0.8889** | 19 |
| **Televisions** | 0.7619 | **0.9412** | **0.8421** | 17 |
| **Air Conditioners** | 0.9375 | **0.7143** | **0.8108** | 21 |
| **Microwaves** | 0.7857 | **0.7857** | **0.7857** | 14 |
| **Mixed Scrap** | 0.5000 | **0.5000** | **0.5000** | 2 |

All 7 categories meet or exceed the SRS 0.50 recall floor.

---

## 7. Contract Compliance & Inference (`services/vision/predict.py`)

### Schema Conformance
The inference module strictly satisfies `VisionAppraisalResponseSchema` from `@scraptrace/contracts`:
1. **Timestamp Format**: Strict ISO 8601 UTC timestamp ending in `Z` with 3-digit milliseconds (`YYYY-MM-DDTHH:MM:SS.mmmZ`).
2. **Confidence Consistency**: `confidence` is bound to the exact floating-point value of the winning category in `scores` (satisfies `addPredictionConsistencyIssues` machine-epsilon test).
3. **Low-Confidence Safeguard**: Predictions below `CONFIDENCE_THRESHOLD = 0.40` automatically output:
   ```json
   {
     "outcome": "unable_to_classify",
     "reason": "low_confidence",
     "scores": [...],
     "model_name": "scraptrace-vision-mobilenetv3",
     "model_version": "0.1.0",
     "inferred_at": "2026-09-26T13:39:08.533Z"
   }
   ```
4. **Standard Streams**: Diagnostics and loading information are sent to `stderr`; `stdout` outputs pure parseable JSON.

---

## 8. Integration Blueprints

### Integration Blueprint A: HTTP REST Endpoint (Server Inference)

Expose `predict.py` via FastAPI inside `services/vision/server.py`:
```python
from fastapi import FastAPI, UploadFile, File
from predict import VisionClassifier
from PIL import Image
import io

app = FastAPI(title="ScrapTrace Vision Appraisal")
classifier = VisionClassifier()

@app.post("/v1/vision/appraise")
async def appraise_image(file: UploadFile = File(...)):
    img = Image.open(io.BytesIO(await file.read()))
    return classifier.predict(img)
```

In the Next.js web application (`apps/web/src/services/http/http-services.ts`):
```typescript
import { VisionAppraisalResponseSchema } from "@scraptrace/contracts";

export const createHttpServices = (apiBaseUrl: string): FrontendServices => ({
  // ...
  vision: {
    async appraise(request) {
      const formData = new FormData();
      formData.append("evidence_id", request.evidence_id);
      const res = await fetch(`${apiBaseUrl}/v1/vision/appraise`, { method: "POST", body: formData });
      return VisionAppraisalResponseSchema.parse(await res.json());
    },
  },
});
```

### Integration Blueprint B: Offline Edge Inference via ONNX (Browser PWA)

For field operations with no cellular connectivity:
1. Export `best_model.pth` to ONNX:
   ```python
   import torch
   from model import load_checkpoint

   model = load_checkpoint("services/vision/checkpoints/best_model.pth")
   dummy = torch.randn(1, 3, 224, 224)
   torch.onnx.export(model, dummy, "apps/web/public/models/scraptrace_mobilenetv3.onnx")
   ```
2. Run inference in-browser via `onnxruntime-web` directly on camera captures with WebAssembly / WebGPU acceleration.

---

## 9. Operational Commands

```bash
# 1. Download & extract 224x224 crops (23 MB)
npm run vision:download

# 2. Train MobileNetV3 classifier (uses Apple Silicon MPS or CUDA)
npm run vision:train

# 3. Test appraisal inference on an image
npm run vision:predict path/to/sample.jpg
```

---

## 10. Known Limitations & Roadmap

* **`mixed_scrap` Representation**: The 16 challenge crops are limited. Future versions (v0.2.0) should employ synthetic image compositing (CutMix / Mosaic) or collect extra ground-truth photos of unsorted scrap heaps.
* **Price Heuristics**: The contract supports an optional `estimate` property. A scrap metal price matrix (Ghana Cedis per kg based on condition and category) can be plugged directly into the response payload.
