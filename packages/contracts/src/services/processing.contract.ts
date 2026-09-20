import { z } from "zod";

import { WeightSchema } from "../common/geography.js";
import { ActorReferenceSchema, EvidenceIdSchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { IdempotencyMetadataSchema } from "../sync/idempotency.schema.js";

export const ProcessingRequestSchema = z.strictObject({
  recovery_record_id: RecoveryRecordIdSchema,
  recycler_reference: ActorReferenceSchema,
  processing_method: z.enum(["reuse_referral", "repair_referral", "material_recovery", "safe_storage", "other_reviewed"]),
  material_entries: z.array(z.strictObject({ material: z.string().min(1).max(120), weight: WeightSchema })).max(100),
  processing_timestamp: UtcTimestampSchema,
  completion_evidence_ids: z.array(EvidenceIdSchema).min(1),
  notes: z.string().max(1_000).optional(),
  idempotency: IdempotencyMetadataSchema,
});

export const ProcessingResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("processing_recorded"), recovery_record_id: RecoveryRecordIdSchema, server_revision: z.number().int().nonnegative(), replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("review_required"), recovery_record_id: RecoveryRecordIdSchema, flag_codes: z.array(z.string().min(1).max(80)).min(1), replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("rejected"), error_code: z.enum(["VALIDATION_FAILED", "INVALID_STATE_TRANSITION", "PERMISSION_DENIED"]), message: z.string().min(1).max(500), replayed: z.boolean() }),
]);

