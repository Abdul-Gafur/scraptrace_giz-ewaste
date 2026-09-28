import {
  IDEMPOTENT_OPERATIONS,
  PermissionSchema,
  ProgrammeReviewRequestSchema,
  ProgrammeReviewResponseSchema,
  ReviewCaseDetailSchema,
  ReviewCasePageSchema,
  ReviewCaseSummarySchema,
  ReviewQueueFiltersSchema,
  UserRoleSchema,
  type RecoveryRecord,
  type ReviewCaseDetail,
  type ReviewCaseSummary,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { DEMO_FACILITY_ID, recordLocationId, toActorReference } from "@/auth/actors";
import { sha256Json } from "@/services/domain/digest";
import { idempotencyKeyFor } from "@/services/domain/identifiers";
import { isTerminal } from "@/services/domain/records";
import { nowUtc } from "@/services/domain/time";
import type { ReviewDecisionInput, ReviewService } from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { invalidTransition, notFound, serviceError, validationFailed } from "./errors";
import { ALL_DIRECTORY_LOCATIONS } from "./location-directory";
import { applyTransition, createEvidence } from "./record-factory";
import { toEvidenceMetadata } from "./record-service";

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

  const caseDetail = (record: RecoveryRecord): ReviewCaseDetail => {
    const evidence = repository.listEvidence(record.record_id);
    const decisionEvidence = evidence.filter((item) => item.evidence_type === "reviewer_decision");
    const review = record.review;
    const latestEvidence = decisionEvidence.at(-1);
    return ReviewCaseDetailSchema.parse({
      case: caseSummary(record),
      record,
      evidence: evidence.map(toEvidenceMetadata),
      timeline: repository.listEvents(record.record_id),
      decisions:
        review.decision && review.reason_code && review.decided_at && latestEvidence
          ? [
              {
                decision_id: latestEvidence.evidence_id,
                reviewer: review.assigned_reviewer ?? toActorReference(actor),
                decision: review.decision,
                reason_code: review.reason_code,
                reviewer_note: review.reviewer_note ?? review.reason_code,
                ...(review.requested_correction
                  ? { requested_correction: review.requested_correction }
                  : {}),
                review_reason_codes:
                  review.flag_codes.length > 0 ? review.flag_codes : ["MANUAL_REVIEW"],
                evidence_considered: review.evidence_considered,
                decision_evidence_id: latestEvidence.evidence_id,
                decision_timestamp: review.decided_at,
                recorded_at: latestEvidence.provenance.captured_at,
                previous_review_state: "open",
                resulting_review_state: review.review_state,
                previous_record_state: "under_review",
                resulting_record_state: record.business_state,
              },
            ]
          : [],
    });
  };

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
    if (
      parsed.previous_review_state !== record.review.review_state ||
      parsed.previous_record_state !== record.business_state
    ) {
      throw serviceError("VERSION_CONFLICT", "The review changed before this decision was made.");
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

    async listCases(filters) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["review:evidence"]);
      const parsed = ReviewQueueFiltersSchema.parse(filters);
      const statuses = parsed.status ?? ["open", "awaiting_information"];
      const cases = repository
        .listRecords()
        .filter((record) => record.review.review_state !== "not_required")
        .map(caseSummary)
        .filter((summary) => (statuses as readonly string[]).includes(summary.status))
        .filter((summary) => !parsed.flag_code || summary.flag_codes.includes(parsed.flag_code))
        .filter((summary) => !parsed.facility_id || summary.facility_id === parsed.facility_id)
        .filter((summary) => !parsed.record_id || summary.record_id === parsed.record_id)
        .filter(
          (summary) => !parsed.opened_from || summary.opened_at.slice(0, 10) >= parsed.opened_from,
        )
        .filter(
          (summary) => !parsed.opened_to || summary.opened_at.slice(0, 10) <= parsed.opened_to,
        )
        .sort(
          (left, right) =>
            (parsed.sort === "-opened_at" ? -1 : 1) * left.opened_at.localeCompare(right.opened_at),
        );
      const offset = parsed.cursor ? Number.parseInt(parsed.cursor, 10) || 0 : 0;
      const next = offset + parsed.limit < cases.length ? String(offset + parsed.limit) : null;
      return ReviewCasePageSchema.parse({
        items: cases.slice(offset, offset + parsed.limit),
        pagination: { next_cursor: next, has_more: next !== null },
      });
    },

    async getCase(caseId) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["review:evidence"]);
      const record = repository.findRecord(caseId);
      if (!record || record.review.review_state === "not_required") throw notFound();
      return caseDetail(record);
    },

    async findCaseForRecord(recordId) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["review:evidence"]);
      const record = repository.findRecord(recordId);
      if (!record || record.review.review_state === "not_required") return null;
      return caseDetail(record);
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
        ...evidence
          .map((item) => item.evidence_id)
          .filter((evidenceId) => input.evidenceConsidered.includes(evidenceId)),
        decisionEvidence.evidence_id,
      ];
      const reviewReasonCodes = input.reviewReasonCodes;

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
        previous_review_state: input.previousReviewState,
        previous_record_state: input.previousRecordState,
      };

      return decide(
        ProgrammeReviewRequestSchema.parse({
          ...payload,
          idempotency: {
            idempotency_key: idempotencyKeyFor(
              `${IDEMPOTENT_OPERATIONS.recordReviewDecision}:${input.decision}`,
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
              operation: IDEMPOTENT_OPERATIONS.recordReviewDecision,
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

const facilityOf = (locationId: string | undefined): string | undefined => {
  if (!locationId) return undefined;
  const entry = ALL_DIRECTORY_LOCATIONS.find((location) => location.location_id === locationId);
  // Every location in the demonstration directory belongs to the demonstration facility.
  return entry ? DEMO_FACILITY_ID : undefined;
};

/**
 * The browser-backed store keeps one review per record, so a record's identifier doubles as its
 * case identifier. The API has separate case identifiers; screens never assume they are equal.
 */
export const caseSummary = (record: RecoveryRecord): ReviewCaseSummary => {
  const facility = facilityOf(recordLocationId(record));
  const review = record.review;
  return ReviewCaseSummarySchema.parse({
    case_id: record.record_id,
    record_id: record.record_id,
    human_reference: record.human_reference,
    category: record.category,
    status: review.review_state,
    flag_codes: review.flag_codes,
    opened_at: record.handoff?.server_received_at ?? record.updated_at,
    ...(facility ? { facility_id: facility } : {}),
    ...(review.assigned_reviewer
      ? { assigned_reviewer_id: review.assigned_reviewer.actor_id }
      : {}),
    record_business_state: record.business_state,
    decision_eligible: record.business_state === "under_review",
    ...(review.decision && review.reason_code && review.decided_at
      ? {
          latest_decision: {
            decision: review.decision,
            reason_code: review.reason_code,
            decided_at: review.decided_at,
          },
        }
      : {}),
  });
};
