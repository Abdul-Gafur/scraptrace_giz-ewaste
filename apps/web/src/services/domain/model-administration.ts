import {
  ActorIdSchema,
  EwasteCategorySchema,
  EvidenceIdSchema,
  RecoveryRecordIdSchema,
  SemanticVersionSchema,
  Sha256DigestSchema,
  UtcTimestampSchema,
  UuidV7Schema,
} from "@scraptrace/contracts";
import { z } from "zod";

/**
 * Model administration records.
 *
 * The trained artefact is a single-label image classifier over the seven contract categories.
 * It is not an object detector: it produces no bounding boxes and no item counts, and the
 * registry states that explicitly so no screen can imply otherwise.
 */

export const MODEL_TASK = "single_label_image_classification" as const;

export const CategoryMetricsSchema = z.strictObject({
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
  support: z.number().int().nonnegative(),
});

/** `registered` versions exist in the registry; exactly one may be `active`. */
export const ModelStatusSchema = z.enum(["active", "registered", "retired"]);

export const ModelRegistryEntrySchema = z.strictObject({
  model_name: z.string().min(1).max(120),
  model_version: SemanticVersionSchema,
  architecture: z.string().min(1).max(120),
  task: z.literal(MODEL_TASK),
  status: ModelStatusSchema,
  supported_categories: z.array(EwasteCategorySchema).length(7),
  checkpoint_filename: z.string().min(1).max(200),
  /** `null` when the training run did not record a checksum; never invented. */
  checkpoint_sha256: Sha256DigestSchema.nullable(),
  training_data_version: z.string().min(1).max(200),
  evaluation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overall_accuracy: z.number().min(0).max(1),
  macro_f1: z.number().min(0).max(1),
  per_category_metrics: z.record(EwasteCategorySchema, CategoryMetricsSchema),
  known_limitations: z.array(z.string().min(1).max(500)).min(1),
  /** Recorded when another artefact in the repository reports a different run. */
  metadata_conflicts: z.array(z.string().min(1).max(500)),
});

export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;

export const ModelConfigurationSchema = z.strictObject({
  active_model_version: SemanticVersionSchema,
  /** Below this score a prediction is treated as low confidence and needs confirmation. */
  confidence_threshold: z.number().min(0.05).max(0.95),
  low_confidence_routing: z.enum(["manual_confirmation", "manual_confirmation_and_feedback"]),
  /** Categories that always require manual confirmation regardless of score. */
  manual_review_categories: z.array(EwasteCategorySchema).max(7),
  updated_at: UtcTimestampSchema,
  updated_by: ActorIdSchema.optional(),
});

export type ModelConfiguration = z.infer<typeof ModelConfigurationSchema>;

/**
 * A stored correction. `stored_for_review` means a collector disagreed with the prediction;
 * `approved_for_training_dataset` means an authorised reviewer marked it usable in a future,
 * separately released dataset. Neither state changes the active model: nothing in this
 * repository retrains or deploys a model (FR-VIS-008, BR-012).
 */
export const FeedbackStateSchema = z.enum([
  "stored_for_review",
  "approved_for_training_dataset",
  "rejected_for_training",
]);

export const PredictionFeedbackSchema = z.strictObject({
  feedback_id: UuidV7Schema,
  recovery_record_id: RecoveryRecordIdSchema,
  evidence_id: EvidenceIdSchema,
  model_name: z.string().min(1).max(120),
  model_version: SemanticVersionSchema,
  predicted_category: EwasteCategorySchema,
  confidence: z.number().min(0).max(1),
  low_confidence: z.boolean(),
  confirmed_category: EwasteCategorySchema,
  /** Mirrors `CategoryConfirmationSchema.source`. */
  confirmation_source: z.enum(["accepted_prediction", "manual_selection", "human_correction"]),
  correction_reason: z.string().min(1).max(500).optional(),
  feedback_state: FeedbackStateSchema,
  reviewed_by: ActorIdSchema.optional(),
  reviewed_at: UtcTimestampSchema.optional(),
  created_at: UtcTimestampSchema,
});

export type PredictionFeedback = z.infer<typeof PredictionFeedbackSchema>;

export const isCorrection = (feedback: PredictionFeedback): boolean =>
  feedback.predicted_category !== feedback.confirmed_category;
