import {
  ModelRegistryEntrySchema,
  type ModelRegistryEntry,
} from "@/services/domain/model-administration";

/**
 * The registered model artefact, transcribed from
 * `services/vision/checkpoints/model_manifest.json` — the manifest that
 * `services/vision/config.py` loads and validates against the generated contract schema.
 *
 * Nothing here is estimated. Fields the training run did not record are reported as such, and
 * `checkpoint_sha256` stays null rather than being filled with a plausible-looking value.
 *
 * `metadata_conflicts` records a real disagreement in the repository: the manifest describes a
 * MobileNetV3-Large run, while `services/vision/artifacts/training_metrics.json` describes an
 * EfficientNet-B0 run with different figures. The manifest is shown because it is the artefact
 * the service validates, and the conflict is surfaced rather than hidden.
 */
export const MODEL_REGISTRY: readonly ModelRegistryEntry[] = [
  ModelRegistryEntrySchema.parse({
    model_name: "scraptrace-vision-mobilenetv3",
    model_version: "0.1.0",
    architecture: "mobilenetv3_large_100",
    task: "single_label_image_classification",
    status: "active",
    supported_categories: [
      "refrigerators",
      "laptops_and_desktop_computers",
      "televisions",
      "microwaves",
      "air_conditioners",
      "compressors",
      "mixed_scrap",
    ],
    checkpoint_filename: "best_model.pth",
    checkpoint_sha256: null,
    training_data_version:
      "GIZ/e-waste-dataset-COCO-labels + GIZ/E-Waste-Database (revision not recorded in the training artifact)",
    evaluation_date: "2026-09-26",
    overall_accuracy: 0.871,
    macro_f1: 0.8135,
    per_category_metrics: {
      refrigerators: { precision: 0.9412, recall: 0.8421, f1: 0.8889, support: 19 },
      laptops_and_desktop_computers: { precision: 0.931, recall: 0.931, f1: 0.931, support: 29 },
      televisions: { precision: 0.7619, recall: 0.9412, f1: 0.8421, support: 17 },
      microwaves: { precision: 0.7857, recall: 0.7857, f1: 0.7857, support: 14 },
      air_conditioners: { precision: 0.9375, recall: 0.7143, f1: 0.8108, support: 21 },
      compressors: { precision: 0.88, recall: 1, f1: 0.9362, support: 22 },
      mixed_scrap: { precision: 0.5, recall: 0.5, f1: 0.5, support: 2 },
    },
    known_limitations: [
      "Single-image, seven-class classification only; the model does not detect, count, or localize objects.",
      "The mixed_scrap evaluation set contained only two examples and is not representative of field diversity.",
      "Field performance may differ under occlusion, poor lighting, unusual viewpoints, or out-of-distribution items.",
      "Low-confidence and ambiguous predictions require manual category confirmation.",
    ],
    metadata_conflicts: [
      "services/vision/artifacts/training_metrics.json records a different run (efficientnet_b0, accuracy 0.8387, macro F1 0.7806). The manifest is shown because it is the artefact the vision service validates.",
    ],
  }),
];

export const activeModel = (): ModelRegistryEntry => {
  const active = MODEL_REGISTRY.find((entry) => entry.status === "active");
  if (!active) throw new Error("The model registry has no active entry.");
  return active;
};

export const findModelVersion = (version: string): ModelRegistryEntry | undefined =>
  MODEL_REGISTRY.find((entry) => entry.model_version === version);
