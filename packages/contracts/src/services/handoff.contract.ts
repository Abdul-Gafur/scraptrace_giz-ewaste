import { z } from "zod";

import { ActorReferenceSchema, EvidenceIdSchema, ManualTransferCodeSchema, OpaqueLookupTokenSchema, RecoveryRecordIdSchema, UuidV7Schema } from "../common/identifiers.js";
import { WeightSchema } from "../common/geography.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { IdempotencyMetadataSchema } from "../sync/idempotency.schema.js";
import { EwasteCategorySchema, ItemConditionSchema } from "../recovery-record/recovery-record.schema.js";
import { HandoffRejectionReasonSchema, ReviewFlagCodeSchema } from "../recovery-record/review-codes.js";

/**
 * Records a recycler's receipt. The request carries exactly one presented credential: the
 * `lookup_token` from a scanned QR, or the `manual_transfer_code` the collector read out. The
 * server verifies it again; a lookup never hands out either credential (ADR-009).
 * `evidence_ids` are the recycler's uploaded handoff and weight photographs; the server adds
 * the QR-scan and receipt evidence itself. `idempotency.scope.operation` is `record_handoff`.
 */
export const HandoffRequestSchema = z
  .strictObject({
    recovery_record_id: RecoveryRecordIdSchema,
    lookup_token: OpaqueLookupTokenSchema.optional(),
    manual_transfer_code: ManualTransferCodeSchema.optional(),
    collector_reference: ActorReferenceSchema,
    recycler_reference: ActorReferenceSchema,
    receiving_location_id: UuidV7Schema,
    handoff_time: UtcTimestampSchema,
    confirmed_category: EwasteCategorySchema,
    confirmed_condition: ItemConditionSchema,
    measured_weight: WeightSchema,
    final_price: z.strictObject({ amount: z.number().nonnegative(), currency: z.string().length(3).regex(/^[A-Z]{3}$/) }),
    evidence_ids: z.array(EvidenceIdSchema).min(2),
    notes: z.string().min(1).max(1_000).optional(),
    idempotency: IdempotencyMetadataSchema,
  })
  .superRefine((value, context) => {
    if ((value.lookup_token === undefined) === (value.manual_transfer_code === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["lookup_token"],
        message: "Present exactly one credential: the scanned lookup token or the manual transfer code.",
      });
    }
  });

/**
 * `accepted` and `discrepancy` create the handoff (HTTP 201). `discrepancy` opens the review
 * case in the same transaction and names its flags. `duplicate_scan` reports an existing
 * handoff and creates nothing. `rejected` is a domain outcome for a record that is not awaiting
 * handoff; invalid credentials are a `RESOURCE_NOT_FOUND` error, not an outcome.
 */
export const HandoffResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("accepted"), recovery_record_id: RecoveryRecordIdSchema, received_at: UtcTimestampSchema, replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("rejected"), reason_code: HandoffRejectionReasonSchema, message: z.string().min(1).max(500), replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("discrepancy"), flag_codes: z.array(ReviewFlagCodeSchema).min(1), received_at: UtcTimestampSchema, replayed: z.boolean() }),
  z.strictObject({ outcome: z.literal("duplicate_scan"), original_received_at: UtcTimestampSchema, original_logical_result: z.enum(["accepted", "rejected", "discrepancy"]) }),
]);

export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;
export type HandoffResponse = z.infer<typeof HandoffResponseSchema>;
