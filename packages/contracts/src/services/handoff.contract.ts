import { z } from "zod";

import { ActorReferenceSchema, EvidenceIdSchema, OpaqueLookupTokenSchema, RecoveryRecordIdSchema, UuidV7Schema } from "../common/identifiers.js";
import { WeightSchema } from "../common/geography.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { IdempotencyMetadataSchema } from "../sync/idempotency.schema.js";
import { EwasteCategorySchema, ItemConditionSchema } from "../recovery-record/recovery-record.schema.js";

export const HandoffRequestSchema = z.strictObject({
  recovery_record_id: RecoveryRecordIdSchema,
  lookup_token: OpaqueLookupTokenSchema,
  collector_reference: ActorReferenceSchema,
  recycler_reference: ActorReferenceSchema,
  receiving_location_id: UuidV7Schema,
  handoff_time: UtcTimestampSchema,
  confirmed_category: EwasteCategorySchema,
  confirmed_condition: ItemConditionSchema,
  measured_weight: WeightSchema,
  final_price: z.strictObject({ amount: z.number().nonnegative(), currency: z.string().length(3).regex(/^[A-Z]{3}$/) }),
  evidence_ids: z.array(EvidenceIdSchema).min(2),
  idempotency: IdempotencyMetadataSchema,
});

export const HandoffResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("accepted"), recovery_record_id: RecoveryRecordIdSchema, received_at: UtcTimestampSchema, replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("rejected"), reason_code: z.string().min(1).max(80), message: z.string().min(1).max(500), replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("discrepancy"), flag_codes: z.array(z.string().min(1).max(80)).min(1), received_at: UtcTimestampSchema, replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("duplicate_scan"), original_received_at: UtcTimestampSchema, original_logical_result: z.enum(["accepted", "rejected", "discrepancy"]) }),
]);
