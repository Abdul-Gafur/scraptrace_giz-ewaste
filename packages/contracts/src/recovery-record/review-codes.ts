import { z } from "zod";

/**
 * Named review flags (FR-HND-006, FR-REV-002). A flag records that a value needs human
 * judgement. It is never proof of wrongdoing (BR-009) and never silently blocks or approves a
 * record. Server rules raise every Phase 1 flag; clients display them and never invent them.
 */
export const REVIEW_FLAG_CODES = [
  "WEIGHT_DISCREPANCY",
  "CATEGORY_DISAGREEMENT",
  "DUPLICATE_EVIDENCE_DIGEST",
  "INCOMPLETE_EVIDENCE",
  "MISSING_MATERIAL_WEIGHTS",
  "PROCESSED_WEIGHT_ABOVE_RECEIVED",
] as const;

export const ReviewFlagCodeSchema = z.enum(REVIEW_FLAG_CODES);

/** The reason a reviewer gives when a record reached review without a named flag. */
export const MANUAL_REVIEW_REASON = "MANUAL_REVIEW" as const;

/** Codes a decision may cite as the reason the record was reviewed. */
export const ReviewReasonForReviewSchema = z.enum([...REVIEW_FLAG_CODES, MANUAL_REVIEW_REASON]);

/** Reviewer decision reason codes. Stable identifiers; wording belongs to each client. */
export const REVIEW_REASON_CODES = [
  "EVIDENCE_SUFFICIENT",
  "WEIGHT_EXPLAINED",
  "EVIDENCE_INSUFFICIENT",
  "CATEGORY_INCORRECT",
  "WEIGHT_UNEXPLAINED",
  "ADDITIONAL_EVIDENCE_REQUIRED",
] as const;

export const ReviewReasonCodeSchema = z.enum(REVIEW_REASON_CODES);

export const ReviewDecisionSchema = z.enum(["approve", "reject", "request_correction"]);

/** The reason codes each decision outcome accepts. */
export const REASON_CODES_BY_DECISION = {
  approve: ["EVIDENCE_SUFFICIENT", "WEIGHT_EXPLAINED"],
  reject: ["EVIDENCE_INSUFFICIENT", "CATEGORY_INCORRECT", "WEIGHT_UNEXPLAINED"],
  request_correction: ["ADDITIONAL_EVIDENCE_REQUIRED", "EVIDENCE_INSUFFICIENT"],
} as const satisfies Record<z.infer<typeof ReviewDecisionSchema>, readonly ReviewReasonCode[]>;

/** Handoff outcomes that are domain results rather than error envelopes. */
export const HandoffRejectionReasonSchema = z.enum(["RECORD_NOT_AWAITING_HANDOFF"]);

export type ReviewFlagCode = z.infer<typeof ReviewFlagCodeSchema>;
export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const isReviewFlagCode = (value: string): value is ReviewFlagCode =>
  (REVIEW_FLAG_CODES as readonly string[]).includes(value);

export const isReasonCodeForDecision = (decision: ReviewDecision, reasonCode: string): boolean =>
  (REASON_CODES_BY_DECISION[decision] as readonly string[]).includes(reasonCode);
