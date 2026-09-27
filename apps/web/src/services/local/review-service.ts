import {
  PermissionSchema,
  ProgrammeReviewRequestSchema,
  ProgrammeReviewResponseSchema,
  UserRoleSchema,
  type RecoveryRecord,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { toActorReference } from "@/auth/actors";
import { sha256Json } from "@/services/domain/digest";
import { idempotencyKeyFor } from "@/services/domain/identifiers";
import { isTerminal } from "@/services/domain/records";
import { nowUtc } from "@/services/domain/time";
import type { ReviewDecisionInput, ReviewService } from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { invalidTransition, notFound, serviceError, validationFailed } from "./errors";
import { applyTransition, createEvidence } from "./record-factory";

const permission = PermissionSchema.enum;
const actingRole = UserRoleSchema.enum;

type ReviewRequest = z.infer<typeof ProgrammeReviewRequestSchema>;
type ReviewResponse = z.infer<typeof ProgrammeReviewResponseSchema>;

/** The three decision outcomes the contract defines, and the transition each one performs. */
const DECISION_EVENT = {
  approve: "approve_review",
  reject: "reject_review",
  request_correction: "request_correction",
} as const;

const RESULTING_REVIEW_STATE = {
  approve: "approved",
  reject: "rejected",
  request_correction: "awaiting_information",
} as const;

const PERMISSION_FOR_DECISION = {
  approve: permission["review:approve"],
  reject: permission["review:reject"],
  request_correction: permission["review:request_correction"],
} as const;

/**
 * Programme review (FR-REV-004 to FR-REV-008).
 *
 * Each decision needs its own contract permission, a reason code and a reviewer note. The
 * decision is applied through the contract transition for that outcome, which is what makes
 * `approve` terminal, `reject` terminal and `request_correction` a return to the reviewer's queue
 * with the record still under review. A record that already holds a terminal decision is
 * read-only: a second decision is refused rather than replacing the first.
 */
export const createReviewService = (context: LocalServiceContext): ReviewService => {
  const { repository, actor } = context;

  const decide = async (request: ReviewRequest): Promise<ReviewResponse> => {
    const parsed = ProgrammeReviewRequestSchema.parse(request);
    const record = repository.findRecord(parsed.recovery_record_id);
    if (!record) throw notFound();
    requirePermission(context, PERMISSION_FOR_DECISION[parsed.decision], { record });

    const { decision, stored } = repository.checkIdempotency(parsed.idempotency);
    if (decision.outcome === "replay" && stored) {
      return { ...ProgrammeReviewResponseSchema.parse(stored.response), replayed: true };
    }
    if (decision.outcome === "conflict") {
      throw serviceError(
        "IDEMPOTENCY_CONFLICT",
        "The same idempotency key was reused with a different decision payload.",
        { messageKey: "errors.idempotencyConflict" },
      );
    }

    if (isTerminal(record)) {
      throw invalidTransition(
        "This record already holds a final decision and cannot be decided again.",
        "errors.alreadyDecided",
      );
    }
    if (record.business_state !== "under_review") {
      throw invalidTransition("Only a record under review can receive a decision.");
    }

    const decisionTimestamp = parsed.decision_timestamp;
    const reviewerReference = toActorReference(actor);
    const { record: decided } = await applyTransition({
      repository,
      record,
      event: DECISION_EVENT[parsed.decision],
      actorRole: actingRole.programme_reviewer,
      actor,
      reason: `${parsed.reason_code}: ${parsed.reviewer_note}`.slice(0, 1_000),
      patch: {
        review: {
          ...record.review,
          review_state: RESULTING_REVIEW_STATE[parsed.decision],
          assigned_reviewer: reviewerReference,
          evidence_considered: parsed.evidence_considered,
          decision: parsed.decision,
          reason_code: parsed.reason_code,
          reviewer_note: parsed.reviewer_note,
          ...(parsed.requested_correction
            ? { requested_correction: parsed.requested_correction }
            : {}),
          decided_at: decisionTimestamp,
          // An approval resolves the flags that caused the review; a rejection or a correction
          // request keeps them visible so the reason for the decision stays readable.
          flag_codes: parsed.decision === "approve" ? [] : record.review.flag_codes,
        },
      },
    });

    const response = ProgrammeReviewResponseSchema.parse({
      recovery_record_id: decided.record_id,
      previous_review_state: parsed.previous_review_state,
      resulting_review_state: decided.review.review_state,
      previous_record_state: parsed.previous_record_state,
      resulting_record_state: decided.business_state,
      decision_timestamp: decisionTimestamp,
      replayed: false,
    });
    repository.recordIdempotency(parsed.idempotency, response, nowUtc());
    return response;
  };

  return {
    decide: async (request) => {
      await pause(context.delayMilliseconds);
      return decide(request);
    },

    async listQueue() {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["review:evidence"]);
      return repository
        .listRecords()
        .filter(
          (record) =>
            record.business_state === "under_review" ||
            (record.review.flag_codes.length > 0 && record.review.review_state !== "not_required"),
        )
        .sort((first, second) => second.updated_at.localeCompare(first.updated_at));
    },

    async submitDecision(input: ReviewDecisionInput) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(input.recordId);
      if (!record) throw notFound();
      requirePermission(context, PERMISSION_FOR_DECISION[input.decision], { record });

      if (input.reviewerNote.trim().length === 0) {
        throw validationFailed("A reviewer note is required for every decision.", [
          { field: "reviewerNote", reason: "required" },
        ]);
      }
      if (input.decision === "request_correction" && !input.requestedCorrection?.trim()) {
        throw validationFailed("Describe the correction the record needs.", [
          { field: "requestedCorrection", reason: "required" },
        ]);
      }

      const evidence = repository.listEvidence(record.record_id);
      const decisionTimestamp = nowUtc();
      // The decision itself is recorded as `reviewer_decision` evidence, which the contract
      // transition for every outcome requires.
      const decisionEvidence = repository.putEvidence(
        createEvidence({
          recordId: record.record_id,
          evidenceType: "reviewer_decision",
          capturedBy: actor,
          captureSource: "system_generated",
          mimeType: "application/json",
          fileSizeBytes: 256,
          contentDigest: await sha256Json({
            record_id: record.record_id,
            decision: input.decision,
            reason_code: input.reasonCode,
            reviewer_note: input.reviewerNote.trim(),
            decided_at: decisionTimestamp,
          }),
          connectivity: "online",
          capturedAt: decisionTimestamp,
        }),
      );

      const consideredEvidence = [
        ...evidence.map((item) => item.evidence_id),
        decisionEvidence.evidence_id,
      ];
      const reviewReasonCodes =
        record.review.flag_codes.length > 0 ? record.review.flag_codes : ["MANUAL_REVIEW"];

      const payload = {
        recovery_record_id: record.record_id,
        review_reason_codes: reviewReasonCodes,
        assigned_reviewer: toActorReference(actor),
        evidence_considered: consideredEvidence,
        decision: input.decision,
        reason_code: input.reasonCode,
        reviewer_note: input.reviewerNote.trim().slice(0, 1_000),
        ...(input.requestedCorrection
          ? { requested_correction: input.requestedCorrection.trim().slice(0, 1_000) }
          : {}),
        decision_timestamp: decisionTimestamp,
        previous_review_state: record.review.review_state,
        previous_record_state: record.business_state,
      };

      return decide(
        ProgrammeReviewRequestSchema.parse({
          ...payload,
          idempotency: {
            idempotency_key: idempotencyKeyFor(
              `review_${input.decision}`,
              record.record_id,
              actor.actorId,
            ),
            request_digest: await sha256Json({
              recovery_record_id: record.record_id,
              decision: input.decision,
              reason_code: input.reasonCode,
              reviewer_note: payload.reviewer_note,
              requested_correction: payload.requested_correction ?? "",
            }),
            scope: {
              actor_id: actor.actorId,
              operation: `review_${input.decision}`,
              resource_id: record.record_id,
            },
          },
        }),
      );
    },
  };
};

export const reviewQueueRecords = (records: readonly RecoveryRecord[]): readonly RecoveryRecord[] =>
  records.filter((record) => record.business_state === "under_review");
