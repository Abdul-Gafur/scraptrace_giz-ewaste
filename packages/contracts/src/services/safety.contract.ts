import { z } from "zod";

import { SupportedLanguageSchema, LanguageMetadataSchema } from "../common/language.js";
import { UuidV7Schema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { SemanticVersionSchema } from "../schema-version.js";
import { EwasteCategorySchema } from "../recovery-record/recovery-record.schema.js";

export const SafetyQuestionAnswersSchema = z.strictObject({
  what_is_it: z.string().min(1).max(2_000),
  possible_dangers: z.string().min(1).max(2_000),
  prohibited_actions: z.string().min(1).max(2_000),
  safe_actions_now: z.string().min(1).max(2_000),
  suitable_destination: z.string().min(1).max(2_000),
});

export const SafetyGuidanceRequestSchema = z.strictObject({
  category: EwasteCategorySchema,
  requested_language: SupportedLanguageSchema,
  transformation_mode: z.enum(["none", "simplify", "translate", "prepare_for_speech"]),
  offline: z.boolean(),
});

const ApprovedSafetyGuidanceSchema = z.strictObject({
  outcome: z.literal("approved_guidance"),
  category: EwasteCategorySchema,
  language: LanguageMetadataSchema,
  safety_card_id: UuidV7Schema,
  safety_card_version: SemanticVersionSchema,
  source_references: z.array(z.string().min(1).max(500)).min(1),
  approval_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answers: SafetyQuestionAnswersSchema,
  transformation_mode: z.enum(["none", "simplify", "translate", "prepare_for_speech"]),
  grounding_references: z.array(z.string().min(1).max(200)).min(1),
  generated_at: UtcTimestampSchema.optional(),
  offline_available: z.boolean(),
  ai_assisted: z.boolean(),
});

const SafetyFallbackSchema = z.strictObject({
  outcome: z.literal("safe_fallback"),
  category: EwasteCategorySchema,
  language: LanguageMetadataSchema,
  reason: z.enum(["no_approved_card", "provider_unavailable", "invalid_generated_output", "offline_cache_unavailable"]),
  message: z.string().min(1).max(1_000),
  referral: z.literal("Contact a programme-verified receiving location or trained technician."),
  llm_called: z.literal(false),
});

export const SafetyGuidanceResponseSchema = z.discriminatedUnion("outcome", [
  ApprovedSafetyGuidanceSchema,
  SafetyFallbackSchema,
]);

export type SafetyQuestionAnswers = z.infer<typeof SafetyQuestionAnswersSchema>;
export type SafetyGuidanceResponse = z.infer<typeof SafetyGuidanceResponseSchema>;
