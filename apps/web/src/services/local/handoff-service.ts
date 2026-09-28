import {
  HandoffRequestSchema,
  HandoffResponseSchema,
  PermissionSchema,
  UserRoleSchema,
  type EvidenceType,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { toActorReference } from "@/auth/actors";
import { sha256Blob, sha256Json, sha256Text } from "@/services/domain/digest";
import { evaluateHandoffFlags } from "@/services/domain/flags";
import { idempotencyKeyFor } from "@/services/domain/identifiers";
import { isTerminal } from "@/services/domain/records";
import { nowUtc } from "@/services/domain/time";
import type { HandoffService, RecordHandoffInput } from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { invalidTransition, notFound, serviceError, validationFailed } from "./errors";
import { applyTransition, createEvidence, localQrPayload } from "./record-factory";

const permission = PermissionSchema.enum;
const role = UserRoleSchema.enum;

type HandoffRequest = z.infer<typeof HandoffRequestSchema>;
type HandoffResponse = z.infer<typeof HandoffResponseSchema>;

const DEFAULT_THRESHOLD_PERCENTAGE = 15;

/**
 * Recycler handoff (FR-HND-001 to FR-HND-007).
 *
 * The contract-shaped `record` call is the single place the handoff rules run:
 *
 * - a repeated identical request replays the first response instead of creating a second handoff
 *   (BR-007), and a reused key with a different payload is an idempotency conflict;
 * - a record that already holds a handoff returns `duplicate_scan` with the original receipt
 *   time, so a second scan shows what happened the first time rather than overwriting it;
 * - a weight difference beyond the configured programme threshold, a category disagreement,
 *   reused evidence or incomplete evidence produce named flags and a `discrepancy` outcome, which
 *   puts the record under review rather than blocking or silently approving it.
 */
export const createHandoffService = (context: LocalServiceContext): HandoffService => {
  const { repository, actor } = context;

  const recordHandoff = async (request: HandoffRequest): Promise<HandoffResponse> => {
    const parsed = HandoffRequestSchema.parse(request);
    const record = repository.findRecord(parsed.recovery_record_id);
    if (!record) throw notFound();
    requirePermission(context, permission["handoff:record"], { record });

    const { decision, stored } = repository.checkIdempotency(parsed.idempotency);
    if (decision.outcome === "replay" && stored) {
      const replayed = HandoffResponseSchema.parse(stored.response);
      return replayed.outcome === "duplicate_scan" ? replayed : { ...replayed, replayed: true };
    }
    if (decision.outcome === "conflict") {
      throw serviceError(
        "IDEMPOTENCY_CONFLICT",
        "The same idempotency key was reused with a different handoff payload.",
        { messageKey: "errors.idempotencyConflict" },
      );
    }

    if (record.handoff) {
      // A second scan of the same code shows the first receipt instead of creating another.
      const duplicate = HandoffResponseSchema.parse({
        outcome: "duplicate_scan",
        original_received_at: record.handoff.server_received_at,
        original_logical_result:
          record.review.flag_codes.length > 0 ? "discrepancy" : ("accepted" as const),
      });
      repository.recordIdempotency(parsed.idempotency, duplicate, nowUtc());
      return duplicate;
    }

    if (isTerminal(record) || record.business_state !== "awaiting_handoff") {
      const rejected = HandoffResponseSchema.parse({
        outcome: "rejected",
        reason_code: "RECORD_NOT_AWAITING_HANDOFF",
        message: "This record is not awaiting handoff, so a receipt cannot be recorded.",
        replayed: false,
      });
      repository.recordIdempotency(parsed.idempotency, rejected, nowUtc());
      return rejected;
    }
    // An invalid credential is a not-found error, never a domain outcome, so it reveals
    // nothing about the record (HandoffResponse contract).
    if (parsed.lookup_token !== localQrPayload(record).lookup_token) throw notFound();

    const settings = repository.getProgrammeSettings();
    const availableEvidence: ReadonlySet<EvidenceType> = new Set(
      repository.listEvidence(record.record_id).map((item) => item.evidence_type),
    );
    const duplicateDigest = repository
      .listEvidence(record.record_id)
      .some(
        (item) =>
          (item.evidence_type === "handoff_photo" || item.evidence_type === "weight_measurement") &&
          repository.findRecordsWithEvidenceDigest(item.content_digest, record.record_id).length >
            0,
      );

    const flags = evaluateHandoffFlags({
      declaredWeight: record.approximate_weight,
      measuredWeight: parsed.measured_weight,
      declaredCategory: record.category,
      confirmedCategory: parsed.confirmed_category,
      thresholdPercentage:
        settings?.weight_discrepancy_threshold_percentage ?? DEFAULT_THRESHOLD_PERCENTAGE,
      duplicateEvidenceDigest: duplicateDigest,
      availableEvidence,
    });

    const receivedAt = nowUtc();
    const { record: received } = await applyTransition({
      repository,
      record,
      event: "record_handoff",
      actorRole: role.recycler,
      actor,
      patch: {
        handoff: {
          recycler: parsed.recycler_reference,
          receiving_location_id: parsed.receiving_location_id,
          confirmed_category: parsed.confirmed_category,
          confirmed_condition: parsed.confirmed_condition,
          measured_weight: parsed.measured_weight,
          final_price: parsed.final_price,
          handed_off_at: parsed.handoff_time,
          server_received_at: receivedAt,
          evidence_ids: parsed.evidence_ids,
        },
        handoff_state: flags.length > 0 ? "disputed" : "received",
        review:
          flags.length > 0
            ? {
                ...record.review,
                review_state: "open",
                flag_codes: [...new Set([...record.review.flag_codes, ...flags])],
              }
            : record.review,
      },
    });

    const response = HandoffResponseSchema.parse(
      flags.length > 0
        ? { outcome: "discrepancy", flag_codes: flags, received_at: receivedAt, replayed: false }
        : {
            outcome: "accepted",
            recovery_record_id: received.record_id,
            received_at: receivedAt,
            replayed: false,
          },
    );
    repository.recordIdempotency(parsed.idempotency, response, receivedAt);
    return response;
  };

  return {
    record: async (request) => {
      await pause(context.delayMilliseconds);
      return recordHandoff(request);
    },

    async confirmReceipt(input: RecordHandoffInput) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(input.recordId);
      if (!record) throw notFound();
      requirePermission(context, permission["handoff:accept"], { record });
      if (record.handoff) {
        return recordHandoff(await buildRequest(input, localQrPayload(record).lookup_token));
      }
      if (isTerminal(record)) {
        throw invalidTransition("A terminal record cannot receive a new handoff.");
      }
      if (input.measuredWeight.value <= 0) {
        throw validationFailed("The measured weight must be greater than zero.", [
          { field: "measuredWeight", reason: "must_be_positive" },
        ]);
      }
      if (input.finalPriceAmount < 0) {
        throw validationFailed("The final price cannot be negative.", [
          { field: "finalPriceAmount", reason: "must_not_be_negative" },
        ]);
      }
      if (!actor.locationIds.includes(input.receivingLocationId)) {
        throw serviceError(
          "PERMISSION_DENIED",
          "The selected receiving location is not assigned to this facility.",
          { messageKey: "errors.facilityNotAssigned" },
        );
      }

      const capturedAt = nowUtc();
      // Four kinds of evidence are required by the handoff transition rule; the QR scan and the
      // recycler receipt are generated from the confirmation itself, the photographs are supplied.
      const scanEvidence = repository.putEvidence(
        createEvidence({
          recordId: record.record_id,
          evidenceType: "handoff_qr_scan",
          capturedBy: actor,
          captureSource: "system_generated",
          mimeType: "text/plain",
          fileSizeBytes: Math.max(1, input.evidence.scannedPayload.length),
          contentDigest: await sha256Text(input.evidence.scannedPayload),
          connectivity: input.offline ? "offline" : "online",
          capturedAt,
        }),
      );
      const receiptEvidence = repository.putEvidence(
        createEvidence({
          recordId: record.record_id,
          evidenceType: "recycler_receipt",
          capturedBy: actor,
          captureSource: "system_generated",
          mimeType: "application/json",
          fileSizeBytes: 256,
          contentDigest: await sha256Json({
            record_id: record.record_id,
            receiving_location_id: input.receivingLocationId,
            measured_weight: { ...input.measuredWeight },
            confirmed_category: input.confirmedCategory,
            confirmed_condition: input.confirmedCondition,
            recorded_at: capturedAt,
            ...(input.evidence.notes ? { notes: input.evidence.notes } : {}),
          }),
          connectivity: input.offline ? "offline" : "online",
          capturedAt,
        }),
      );
      const handoffPhoto = repository.putEvidence(
        createEvidence({
          recordId: record.record_id,
          evidenceType: "handoff_photo",
          capturedBy: actor,
          captureSource: input.offline ? "approved_demo_fixture" : "recycler_camera",
          mimeType: input.evidence.handoffPhoto.type || "image/jpeg",
          fileSizeBytes: input.evidence.handoffPhoto.size,
          contentDigest: await sha256Blob(input.evidence.handoffPhoto),
          connectivity: input.offline ? "offline" : "online",
          capturedAt,
        }),
        input.evidence.handoffPhotoPreview,
      );
      const weightPhoto = repository.putEvidence(
        createEvidence({
          recordId: record.record_id,
          evidenceType: "weight_measurement",
          capturedBy: actor,
          captureSource: input.offline ? "approved_demo_fixture" : "recycler_camera",
          mimeType: input.evidence.weightPhoto.type || "image/jpeg",
          fileSizeBytes: input.evidence.weightPhoto.size,
          contentDigest: await sha256Blob(input.evidence.weightPhoto),
          connectivity: input.offline ? "offline" : "online",
          capturedAt,
        }),
        input.evidence.weightPhotoPreview,
      );

      const request = await buildRequest(input, localQrPayload(record).lookup_token, [
        scanEvidence.evidence_id,
        receiptEvidence.evidence_id,
        handoffPhoto.evidence_id,
        weightPhoto.evidence_id,
      ]);
      return recordHandoff(request);
    },
  };

  async function buildRequest(
    input: RecordHandoffInput,
    lookupToken: string,
    evidenceIds?: readonly string[],
  ): Promise<HandoffRequest> {
    const record = repository.findRecord(input.recordId);
    if (!record) throw notFound();
    const ids =
      evidenceIds ??
      repository
        .listEvidence(record.record_id)
        .filter((item) => item.evidence_type !== "original_item_photo")
        .map((item) => item.evidence_id);
    const digestPayload = {
      recovery_record_id: record.record_id,
      lookup_token: lookupToken,
      receiving_location_id: input.receivingLocationId,
      confirmed_category: input.confirmedCategory,
      confirmed_condition: input.confirmedCondition,
      measured_weight: { ...input.measuredWeight },
      final_price_amount: input.finalPriceAmount,
      final_price_currency: input.finalPriceCurrency,
      evidence_ids: [...ids],
    };
    const payload = {
      recovery_record_id: record.record_id,
      lookup_token: lookupToken,
      collector_reference: record.collector,
      recycler_reference: toActorReference(actor),
      receiving_location_id: input.receivingLocationId,
      handoff_time: nowUtc(),
      confirmed_category: input.confirmedCategory,
      confirmed_condition: input.confirmedCondition,
      measured_weight: input.measuredWeight,
      final_price: { amount: input.finalPriceAmount, currency: input.finalPriceCurrency },
      evidence_ids: ids,
    };
    return HandoffRequestSchema.parse({
      ...payload,
      idempotency: {
        idempotency_key: idempotencyKeyFor("record_handoff", record.record_id, actor.actorId),
        // The handoff time is excluded from the digest so a genuine retry of the same
        // confirmation replays instead of looking like a different payload.
        request_digest: await sha256Json(digestPayload),
        scope: {
          actor_id: actor.actorId,
          operation: "record_handoff",
          resource_id: record.record_id,
        },
      },
    });
  }
};
