import { z } from "zod";

import { ActorReferenceSchema, EvidenceIdSchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { RecoveryRecordStateSchema, ReviewStateSchema } from "../recovery-record/recovery-record.states.js";
import { IdempotencyMetadataSchema } from "../sync/idempotency.schema.js";

export const ProgrammeReviewRequestSchema = z
  .strictObject({
    recovery_record_id: RecoveryRecordIdSchema,
    review_reason_codes: z.array(z.string().min(1).max(80)).min(1),
    assigned_reviewer: ActorReferenceSchema,
    evidence_considered: z.array(EvidenceIdSchema).min(1),
    decision: z.enum(["approve", "reject", "request_correction"]),
    reason_code: z.string().min(1).max(80),
    reviewer_note: z.string().min(1).max(1_000),
    requested_correction: z.string().min(1).max(1_000).optional(),
    decision_timestamp: UtcTimestampSchema,
    previous_review_state: ReviewStateSchema,
    previous_record_state: RecoveryRecordStateSchema,
    idempotency: IdempotencyMetadataSchema,
  })
  .superRefine((value, context) => {
    if (value.decision === "request_correction" && !value.requested_correction) {
      context.addIssue({ code: "custom", path: ["requested_correction"], message: "Requested correction details are required." });
    }
  });

export const ProgrammeReviewResponseSchema = z.strictObject({
  recovery_record_id: RecoveryRecordIdSchema,
  previous_review_state: ReviewStateSchema,
  resulting_review_state: ReviewStateSchema,
  previous_record_state: RecoveryRecordStateSchema,
  resulting_record_state: RecoveryRecordStateSchema,
  decision_timestamp: UtcTimestampSchema,
  replayed: z.boolean(),
});

