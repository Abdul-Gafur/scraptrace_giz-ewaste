import { z } from "zod";

import { ActorReferenceSchema, EvidenceIdSchema, HumanReadableReferenceSchema, QrPayloadSchema, RecoveryRecordIdSchema, UuidV7Schema } from "../common/identifiers.js";
import { ApproximateAreaSchema, GeoCoordinatesSchema, WeightSchema } from "../common/geography.js";
import { Sha256DigestSchema } from "../common/integrity.js";
import { SupportedLanguageSchema } from "../common/language.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { CONTRACT_SCHEMA_VERSION, SemanticVersionSchema } from "../schema-version.js";
import { addPredictionConsistencyIssues } from "./prediction-consistency.js";
import { HandoffStateSchema, ProcessingStateSchema, RecoveryRecordStateSchema, ReviewStateSchema, SynchronizationStateSchema } from "./recovery-record.states.js";

export const EWASTE_CATEGORIES = [
  "refrigerators",
  "laptops_and_desktop_computers",
  "televisions",
  "microwaves",
  "air_conditioners",
  "compressors",
  "mixed_scrap",
] as const;

export const EwasteCategorySchema = z.enum(EWASTE_CATEGORIES);
export const RecordKindSchema = z.enum(["item", "batch"]);
export const ItemConditionSchema = z.enum(["working", "repairable", "damaged", "unknown"]);

export const CategoryScoreSchema = z.strictObject({
  category: EwasteCategorySchema,
  score: z.number().min(0).max(1),
});

export const SevenCategoryScoresSchema = z
  .array(CategoryScoreSchema)
  .length(7)
  .superRefine((scores, context) => {
    const categories = new Set(scores.map((score) => score.category));
    if (categories.size !== EWASTE_CATEGORIES.length) {
      context.addIssue({ code: "custom", message: "Scores must contain each category exactly once." });
    }
  });

export const VisionResultSchema = z
  .strictObject({
    prediction_id: UuidV7Schema,
    model_name: z.string().min(1).max(120),
    model_version: SemanticVersionSchema,
    inferred_at: UtcTimestampSchema,
    scores: SevenCategoryScoresSchema,
    suggested_category: EwasteCategorySchema,
    confidence: z.number().min(0).max(1),
    low_confidence: z.boolean(),
  })
  .superRefine(addPredictionConsistencyIssues);

export const CategoryConfirmationSchema = z.strictObject({
  confirmed_category: EwasteCategorySchema,
  confirmed_by: ActorReferenceSchema,
  confirmed_at: UtcTimestampSchema,
  source: z.enum(["accepted_prediction", "manual_selection", "human_correction"]),
  correction_reason: z.string().min(1).max(500).optional(),
});

export const PriceEstimateSchema = z
  .strictObject({
    category: EwasteCategorySchema,
    condition: ItemConditionSchema,
    count: z.number().int().positive().optional(),
    approximate_weight: WeightSchema.optional(),
    minimum_amount: z.number().nonnegative().finite(),
    maximum_amount: z.number().nonnegative().finite(),
    currency: z.string().length(3).regex(/^[A-Z]{3}$/),
    basis: z.string().min(1).max(240),
    source: z.string().min(1).max(240),
    effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    disclaimer: z.string().min(1).max(500),
  })
  .superRefine((value, context) => {
    if (value.maximum_amount < value.minimum_amount) {
      context.addIssue({ code: "custom", path: ["maximum_amount"], message: "Maximum estimate must not be below the minimum estimate." });
    }
    if (value.category === "mixed_scrap" && !value.approximate_weight) {
      context.addIssue({ code: "custom", path: ["approximate_weight"], message: "Mixed-scrap estimates require an approximate weight." });
    }
  });

export const SafetyGuideReferenceSchema = z.strictObject({
  card_id: UuidV7Schema,
  card_version: SemanticVersionSchema,
  category: EwasteCategorySchema,
  language: SupportedLanguageSchema,
  approval_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_references: z.array(z.string().min(1).max(500)).min(1),
});

export const DestinationSelectionSchema = z.strictObject({
  location_id: UuidV7Schema,
  facility_type: z.enum(["scrapyard", "collection_centre", "recycler"]),
  verification_status: z.enum(["unverified", "programme_verified", "expired", "suspended"]),
  selected_at: UtcTimestampSchema,
});

export const HandoffInformationSchema = z.strictObject({
  recycler: ActorReferenceSchema,
  receiving_location_id: UuidV7Schema,
  confirmed_category: EwasteCategorySchema,
  confirmed_condition: ItemConditionSchema,
  measured_weight: WeightSchema,
  final_price: z.strictObject({
    amount: z.number().nonnegative().finite(),
    currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  }),
  handed_off_at: UtcTimestampSchema,
  server_received_at: UtcTimestampSchema,
  evidence_ids: z.array(EvidenceIdSchema).min(2),
});

export const ProcessingInformationSchema = z.strictObject({
  recycler: ActorReferenceSchema,
  method: z.enum(["reuse_referral", "repair_referral", "material_recovery", "safe_storage", "other_reviewed"]),
  result: z.string().min(1).max(500),
  material_entries: z.array(z.strictObject({ material: z.string().min(1).max(120), weight: WeightSchema })).max(100),
  processed_at: UtcTimestampSchema,
  evidence_ids: z.array(EvidenceIdSchema).min(1),
});

export const ReviewInformationSchema = z
  .strictObject({
    review_state: ReviewStateSchema,
    flag_codes: z.array(z.string().min(1).max(80)).max(50),
    assigned_reviewer: ActorReferenceSchema.optional(),
    evidence_considered: z.array(EvidenceIdSchema).max(100),
    decision: z.enum(["approve", "reject", "request_correction"]).optional(),
    reason_code: z.string().min(1).max(80).optional(),
    reviewer_note: z.string().max(1_000).optional(),
    requested_correction: z.string().max(1_000).optional(),
    decided_at: UtcTimestampSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.decision && (!value.reason_code || !value.decided_at || !value.assigned_reviewer)) {
      context.addIssue({ code: "custom", message: "A decision requires reviewer, reason code, and decision timestamp." });
    }
  });

export const RecoveryRecordSyncMetadataSchema = z.strictObject({
  sync_state: SynchronizationStateSchema,
  device_instance_id: UuidV7Schema,
  local_revision: z.number().int().nonnegative(),
  server_revision: z.number().int().nonnegative().optional(),
  last_attempt_at: UtcTimestampSchema.optional(),
});

const RecoveryRecordBaseSchema = z
  .strictObject({
    contract_schema_version: z.literal(CONTRACT_SCHEMA_VERSION),
    record_id: RecoveryRecordIdSchema,
    human_reference: HumanReadableReferenceSchema,
    qr_payload: QrPayloadSchema,
    revision: z.number().int().nonnegative(),
    record_kind: RecordKindSchema,
    category: EwasteCategorySchema,
    item_count: z.number().int().positive().optional(),
    approximate_weight: WeightSchema.optional(),
    condition: ItemConditionSchema,
    original_image_evidence_id: EvidenceIdSchema,
    collector: ActorReferenceSchema,
    captured_at: UtcTimestampSchema,
    capture_location: GeoCoordinatesSchema.optional(),
    approximate_area: ApproximateAreaSchema,
    vision_result: VisionResultSchema.optional(),
    category_confirmation: CategoryConfirmationSchema,
    estimated_price: PriceEstimateSchema.optional(),
    safety_guide: SafetyGuideReferenceSchema.optional(),
    destination: DestinationSelectionSchema.optional(),
    handoff: HandoffInformationSchema.optional(),
    processing: ProcessingInformationSchema.optional(),
    review: ReviewInformationSchema,
    business_state: RecoveryRecordStateSchema,
    handoff_state: HandoffStateSchema,
    processing_state: ProcessingStateSchema,
    sync: RecoveryRecordSyncMetadataSchema,
    created_at: UtcTimestampSchema,
    updated_at: UtcTimestampSchema,
    integrity_digest: Sha256DigestSchema.optional(),
    previous_integrity_digest: Sha256DigestSchema.optional(),
  });

export const RecoveryRecordIntegrityPayloadSchema = RecoveryRecordBaseSchema.pick({
  contract_schema_version: true,
  record_id: true,
  human_reference: true,
  record_kind: true,
  category: true,
  item_count: true,
  approximate_weight: true,
  condition: true,
  original_image_evidence_id: true,
  collector: true,
  captured_at: true,
  capture_location: true,
  approximate_area: true,
  vision_result: true,
  category_confirmation: true,
  created_at: true,
});

export const RecoveryRecordSchema = RecoveryRecordBaseSchema.superRefine((value, context) => {
    if (value.qr_payload.record_id !== value.record_id) {
      context.addIssue({ code: "custom", path: ["qr_payload", "record_id"], message: "QR record ID must match the record." });
    }
    if (value.category === "mixed_scrap" && value.record_kind !== "batch") {
      context.addIssue({ code: "custom", path: ["record_kind"], message: "Mixed scrap must be recorded as a batch." });
    }
    if (value.category === "mixed_scrap" && !value.approximate_weight) {
      context.addIssue({ code: "custom", path: ["approximate_weight"], message: "Mixed scrap requires approximate weight." });
    }
    if (value.category_confirmation.confirmed_category !== value.category) {
      context.addIssue({ code: "custom", path: ["category_confirmation", "confirmed_category"], message: "Confirmed category must drive the record category." });
    }
  });

export type EwasteCategory = z.infer<typeof EwasteCategorySchema>;
export type VisionResult = z.infer<typeof VisionResultSchema>;
export type RecoveryRecordIntegrityPayload = z.infer<typeof RecoveryRecordIntegrityPayloadSchema>;
export type RecoveryRecord = z.infer<typeof RecoveryRecordSchema>;
