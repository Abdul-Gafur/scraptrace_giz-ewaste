import { z } from "zod";

import { EvidenceIdSchema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { SemanticVersionSchema } from "../schema-version.js";
import { addPredictionConsistencyIssues } from "../recovery-record/prediction-consistency.js";
import { CategoryConfirmationSchema, EwasteCategorySchema, ItemConditionSchema, PriceEstimateSchema, SevenCategoryScoresSchema } from "../recovery-record/recovery-record.schema.js";

export const VisionAppraisalRequestSchema = z.strictObject({
  evidence_id: EvidenceIdSchema,
  price_estimation_inputs: z.strictObject({
    item_count: z.number().int().positive().optional(),
    condition: ItemConditionSchema,
    approximate_weight_kg: z.number().positive().optional(),
  }).optional(),
});

const VisionClassifiedSchema = z
  .strictObject({
    outcome: z.literal("classified"),
    category: EwasteCategorySchema,
    scores: SevenCategoryScoresSchema,
    confidence: z.number().min(0).max(1),
    model_name: z.string().min(1).max(120),
    model_version: SemanticVersionSchema,
    inferred_at: UtcTimestampSchema,
    estimate: PriceEstimateSchema.optional(),
  })
  .superRefine((value, context) =>
    addPredictionConsistencyIssues(
      { scores: value.scores, suggested_category: value.category, confidence: value.confidence },
      context,
    ),
  );

const VisionUnableToClassifySchema = z.strictObject({
  outcome: z.literal("unable_to_classify"),
  reason: z.enum(["low_confidence", "unsupported_image", "invalid_image", "service_unavailable"]),
  scores: SevenCategoryScoresSchema.optional(),
  model_name: z.string().min(1).max(120),
  model_version: SemanticVersionSchema,
  inferred_at: UtcTimestampSchema,
});

export const VisionAppraisalResponseSchema = z.discriminatedUnion("outcome", [
  VisionClassifiedSchema,
  VisionUnableToClassifySchema,
]);

export const VisionHumanCorrectionSchema = CategoryConfirmationSchema;

export type VisionAppraisalRequest = z.infer<typeof VisionAppraisalRequestSchema>;
export type VisionAppraisalResponse = z.infer<typeof VisionAppraisalResponseSchema>;
