import { z } from "zod";

import { ActorReferenceSchema, EvidenceIdSchema, HumanReadableReferenceSchema, RecoveryRecordIdSchema, UuidV7Schema } from "../common/identifiers.js";
import { CursorPaginationRequestSchema, pageSchema } from "../common/pagination.js";
import { IsoDateSchema, UtcTimestampSchema } from "../common/timestamps.js";
import { EvidenceMetadataSchema } from "../evidence/evidence.schema.js";
import { RecoveryRecordEventSchema } from "../recovery-record/recovery-record.events.js";
import { EwasteCategorySchema, RecoveryRecordSchema } from "../recovery-record/recovery-record.schema.js";
import { RecoveryRecordStateSchema, ReviewStateSchema } from "../recovery-record/recovery-record.states.js";
import {
  REASON_CODES_BY_DECISION,
  ReviewDecisionSchema,
  ReviewFlagCodeSchema,
  ReviewReasonCodeSchema,
  ReviewReasonForReviewSchema,
  isReasonCodeForDecision,
} from "../recovery-record/review-codes.js";
import { IdempotencyMetadataSchema } from "../sync/idempotency.schema.js";

/**
 * A reviewer's decision (FR-REV-005, FR-REV-006).
 *
 * - `reason_code` must be one of `REASON_CODES_BY_DECISION[decision]`.
 * - `review_reason_codes` are the case flags the decision addresses, or `MANUAL_REVIEW`.
 * - `previous_review_state` and `previous_record_state` are an optimistic-concurrency check:
 *   they must equal the case detail the reviewer read, otherwise `VERSION_CONFLICT`.
 * - `decision_timestamp` is the reviewer's clock; it must fall between case opening and now.
 *   The server records its own receipt time separately.
 * - `idempotency.scope.operation` is `record_review_decision`.
 */
export const ProgrammeReviewRequestSchema = z
  .strictObject({
    recovery_record_id: RecoveryRecordIdSchema,
    review_reason_codes: z.array(ReviewReasonForReviewSchema).min(1).max(20),
    assigned_reviewer: ActorReferenceSchema,
    evidence_considered: z.array(EvidenceIdSchema).min(1),
    decision: ReviewDecisionSchema,
    reason_code: ReviewReasonCodeSchema,
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
    if (!isReasonCodeForDecision(value.decision, value.reason_code)) {
      context.addIssue({
        code: "custom",
        path: ["reason_code"],
        message: `Use one of: ${REASON_CODES_BY_DECISION[value.decision].join(", ")}.`,
      });
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

export const REVIEW_QUEUE_STATUSES = ["open", "awaiting_information", "approved", "rejected"] as const;

/**
 * Server-side review queue filters (query parameters). Without `status` the queue shows
 * `open` and `awaiting_information` cases; repeat `status` for several. Dates are inclusive UTC
 * days of case opening. The server always limits results to the reviewer's programme and to
 * cases unassigned or assigned to them.
 */
export const ReviewQueueFiltersSchema = CursorPaginationRequestSchema.extend({
  status: z.array(z.enum(REVIEW_QUEUE_STATUSES)).max(4).optional(),
  flag_code: ReviewFlagCodeSchema.optional(),
  opened_from: IsoDateSchema.optional(),
  opened_to: IsoDateSchema.optional(),
  facility_id: UuidV7Schema.optional(),
  sort: z.enum(["opened_at", "-opened_at"]).default("opened_at"),
});

/** One review case in the queue. Absent optional fields are omitted, never `null`. */
export const ReviewCaseSummarySchema = z.strictObject({
  case_id: UuidV7Schema,
  record_id: RecoveryRecordIdSchema,
  human_reference: HumanReadableReferenceSchema,
  category: EwasteCategorySchema,
  status: ReviewStateSchema,
  flag_codes: z.array(ReviewFlagCodeSchema).max(50),
  opened_at: UtcTimestampSchema,
  facility_id: UuidV7Schema.optional(),
  assigned_reviewer_id: UuidV7Schema.optional(),
  record_business_state: RecoveryRecordStateSchema,
  /** True while the record is `under_review`, so a decision can be recorded. */
  decision_eligible: z.boolean(),
  latest_decision: z
    .strictObject({
      decision: ReviewDecisionSchema,
      reason_code: ReviewReasonCodeSchema,
      decided_at: UtcTimestampSchema,
    })
    .optional(),
});

export const ReviewCasePageSchema = pageSchema(ReviewCaseSummarySchema);

/** A recorded decision as reviewers see it, including the Restricted reviewer note. */
export const ReviewDecisionViewSchema = z.strictObject({
  decision_id: UuidV7Schema,
  reviewer: ActorReferenceSchema,
  decision: ReviewDecisionSchema,
  reason_code: ReviewReasonCodeSchema,
  reviewer_note: z.string().min(1).max(1_000),
  requested_correction: z.string().min(1).max(1_000).optional(),
  review_reason_codes: z.array(ReviewReasonForReviewSchema).min(1).max(20),
  evidence_considered: z.array(EvidenceIdSchema).max(100),
  decision_evidence_id: EvidenceIdSchema,
  decision_timestamp: UtcTimestampSchema,
  recorded_at: UtcTimestampSchema,
  previous_review_state: ReviewStateSchema,
  resulting_review_state: ReviewStateSchema,
  previous_record_state: RecoveryRecordStateSchema,
  resulting_record_state: RecoveryRecordStateSchema,
});

/** Everything a reviewer needs for one case in a single response (FR-REV-004). */
export const ReviewCaseDetailSchema = z.strictObject({
  case: ReviewCaseSummarySchema,
  record: RecoveryRecordSchema,
  evidence: z.array(EvidenceMetadataSchema).max(500),
  timeline: z.array(RecoveryRecordEventSchema).max(1_000),
  decisions: z.array(ReviewDecisionViewSchema).max(100),
});

export type ProgrammeReviewRequest = z.infer<typeof ProgrammeReviewRequestSchema>;
export type ProgrammeReviewResponse = z.infer<typeof ProgrammeReviewResponseSchema>;
export type ReviewQueueFilters = z.input<typeof ReviewQueueFiltersSchema>;
export type ReviewCaseSummary = z.infer<typeof ReviewCaseSummarySchema>;
export type ReviewCasePage = z.infer<typeof ReviewCasePageSchema>;
export type ReviewDecisionView = z.infer<typeof ReviewDecisionViewSchema>;
export type ReviewCaseDetail = z.infer<typeof ReviewCaseDetailSchema>;
