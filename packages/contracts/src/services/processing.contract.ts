import { z } from "zod";

import { WeightSchema } from "../common/geography.js";
import { ActorReferenceSchema, EvidenceIdSchema, RecoveryRecordIdSchema, UuidV7Schema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { ReviewFlagCodeSchema } from "../recovery-record/review-codes.js";
import { IdempotencyMetadataSchema } from "../sync/idempotency.schema.js";

export const ProcessingMethodSchema = z.enum(["reuse_referral", "repair_referral", "material_recovery", "safe_storage", "other_reviewed"]);

/** One recovered material and its positive weight with unit. */
export const MaterialEntrySchema = z.strictObject({ material: z.string().min(1).max(120), weight: WeightSchema });

/**
 * Final processing submission. `notes` is the recorded processing result
 * (`ProcessingInformation.result`), so it is required and shares that field's 1,000-character
 * limit. The request is authoritative: it replaces any draft material entries.
 * `idempotency.scope.operation` is `record_processing`.
 */
export const ProcessingRequestSchema = z.strictObject({
  recovery_record_id: RecoveryRecordIdSchema,
  recycler_reference: ActorReferenceSchema,
  processing_method: ProcessingMethodSchema,
  material_entries: z.array(MaterialEntrySchema).max(100),
  processing_timestamp: UtcTimestampSchema,
  completion_evidence_ids: z.array(EvidenceIdSchema).min(1),
  notes: z.string().min(1).max(1_000),
  idempotency: IdempotencyMetadataSchema,
});

/**
 * `processing_recorded`: no unresolved flag, so the record completed and the system approved it
 * (`approved_and_completed`). `review_required`: a new processing flag or an earlier handoff
 * flag moved the record to `under_review`. `rejected`: a domain refusal, such as a second
 * submission for the same record.
 */
export const ProcessingResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("processing_recorded"), recovery_record_id: RecoveryRecordIdSchema, server_revision: z.number().int().nonnegative(), replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("review_required"), recovery_record_id: RecoveryRecordIdSchema, flag_codes: z.array(ReviewFlagCodeSchema).min(1), replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("rejected"), error_code: z.enum(["VALIDATION_FAILED", "INVALID_STATE_TRANSITION", "PERMISSION_DENIED"]), message: z.string().min(1).max(500), replayed: z.boolean() }),
]);

/**
 * Creates or updates the server-held processing draft, so work survives a refresh or another
 * device. Field names and limits are those of `ProcessingRequest`; `null` clears an optional
 * field. Updating an existing draft requires `If-Match` with its `version`.
 */
export const ProcessingDraftUpdateSchema = z
  .strictObject({
    processing_method: ProcessingMethodSchema.optional(),
    notes: z.string().min(1).max(1_000).nullable().optional(),
    processing_timestamp: UtcTimestampSchema.nullable().optional(),
    completion_evidence_ids: z.array(EvidenceIdSchema).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const MaterialEntryUpdateSchema = MaterialEntrySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required.",
);

/** A draft material entry with its server-assigned identifier. */
export const MaterialEntryViewSchema = MaterialEntrySchema.extend({ entry_id: UuidV7Schema });

/** The processing draft, or the submitted processing, for one record. */
export const ProcessingDetailSchema = z.strictObject({
  record_id: RecoveryRecordIdSchema,
  status: z.enum(["draft", "submitted"]),
  processing_method: ProcessingMethodSchema.optional(),
  notes: z.string().min(1).max(1_000).optional(),
  processing_timestamp: UtcTimestampSchema.optional(),
  completion_evidence_ids: z.array(EvidenceIdSchema).max(100),
  material_entries: z.array(MaterialEntryViewSchema).max(100),
  /** Sum of the entries converted to kilograms, rounded to four decimals. */
  total_recovered_weight_kg: z.number().nonnegative(),
  /** Optimistic-concurrency token, echoed as the `ETag`. */
  version: z.number().int().positive(),
  submitted_at: UtcTimestampSchema.optional(),
  updated_at: UtcTimestampSchema,
});

export type ProcessingRequest = z.infer<typeof ProcessingRequestSchema>;
export type ProcessingResponse = z.infer<typeof ProcessingResponseSchema>;
export type ProcessingDraftUpdate = z.infer<typeof ProcessingDraftUpdateSchema>;
export type MaterialEntry = z.infer<typeof MaterialEntrySchema>;
export type ProcessingDetail = z.infer<typeof ProcessingDetailSchema>;
