import {
  PermissionSchema,
  ProcessingRequestSchema,
  ProcessingResponseSchema,
  RecoveryRecordPageSchema,
  UserRoleSchema,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { toActorReference } from "@/auth/actors";
import { sha256Blob, sha256Json } from "@/services/domain/digest";
import { evaluateProcessingFlags, toKilograms } from "@/services/domain/flags";
import { idempotencyKeyFor, newUuid } from "@/services/domain/identifiers";
import { isTerminal } from "@/services/domain/records";
import { nowUtc } from "@/services/domain/time";
import type { ProcessingService, RecordProcessingInput } from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { invalidTransition, notFound, serviceError, validationFailed } from "./errors";
import { applyTransition, createEvidence } from "./record-factory";

const permission = PermissionSchema.enum;
const role = UserRoleSchema.enum;

type ProcessingRequest = z.infer<typeof ProcessingRequestSchema>;
type ProcessingResponse = z.infer<typeof ProcessingResponseSchema>;

/**
 * Processing evidence (FR-REV-001, FR-REV-002, FR-REV-007).
 *
 * Recording processing always advances the record to `processing_recorded`. What happens next
 * depends on the flags the record carries: an unflagged record continues to `completed` and then
 * to `approved_and_completed` through the system's unflagged-completion transition, while a
 * flagged record is moved to `under_review` for a human decision. A terminal record is refused
 * rather than silently edited.
 */
export const createProcessingService = (context: LocalServiceContext): ProcessingService => {
  const { repository, actor } = context;

  const recordProcessing = async (request: ProcessingRequest): Promise<ProcessingResponse> => {
    const parsed = ProcessingRequestSchema.parse(request);
    const record = repository.findRecord(parsed.recovery_record_id);
    if (!record) throw notFound();
    requirePermission(context, permission["processing:record"], { record });

    const { decision, stored } = repository.checkIdempotency(parsed.idempotency);
    if (decision.outcome === "replay" && stored) {
      return { ...ProcessingResponseSchema.parse(stored.response), replayed: true };
    }
    if (decision.outcome === "conflict") {
      throw serviceError(
        "IDEMPOTENCY_CONFLICT",
        "The same idempotency key was reused with a different processing payload.",
        { messageKey: "errors.idempotencyConflict" },
      );
    }

    if (isTerminal(record)) {
      const rejected = ProcessingResponseSchema.parse({
        outcome: "rejected",
        error_code: "INVALID_STATE_TRANSITION",
        message: "A decided record cannot be edited. Record an amendment instead.",
        replayed: false,
      });
      repository.recordIdempotency(parsed.idempotency, rejected, nowUtc());
      return rejected;
    }
    if (record.business_state !== "received") {
      const rejected = ProcessingResponseSchema.parse({
        outcome: "rejected",
        error_code: "INVALID_STATE_TRANSITION",
        message: "Processing can only be recorded after the handoff has been received.",
        replayed: false,
      });
      repository.recordIdempotency(parsed.idempotency, rejected, nowUtc());
      return rejected;
    }

    const newFlags = evaluateProcessingFlags({
      receivedWeight: record.handoff?.measured_weight,
      materialWeights: parsed.material_entries.map((entry) => entry.weight),
      requiresMaterialWeights: parsed.processing_method === "material_recovery",
    });
    const allFlags = [...new Set([...record.review.flag_codes, ...newFlags])];

    const { record: processed } = await applyTransition({
      repository,
      record,
      event: "record_processing",
      actorRole: role.recycler,
      actor,
      patch: {
        processing: {
          recycler: parsed.recycler_reference,
          method: parsed.processing_method,
          result: (parsed.notes ?? `Processing recorded: ${parsed.processing_method}.`).slice(
            0,
            500,
          ),
          material_entries: parsed.material_entries,
          processed_at: parsed.processing_timestamp,
          evidence_ids: parsed.completion_evidence_ids,
        },
        processing_state: "evidence_recorded",
        review:
          allFlags.length > 0
            ? { ...record.review, review_state: "open", flag_codes: allFlags }
            : record.review,
      },
    });

    let response: ProcessingResponse;
    if (allFlags.length > 0) {
      const { record: underReview } = await applyTransition({
        repository,
        record: processed,
        event: "flag_for_review",
        actorRole: "system",
        reason: `Flags requiring review: ${allFlags.join(", ")}`,
      });
      response = ProcessingResponseSchema.parse({
        outcome: "review_required",
        recovery_record_id: underReview.record_id,
        flag_codes: allFlags,
        replayed: false,
      });
    } else {
      const { record: completed } = await applyTransition({
        repository,
        record: processed,
        event: "mark_processing_complete",
        actorRole: role.recycler,
        actor,
        patch: { processing_state: "completed" },
      });
      const { record: approved } = await applyTransition({
        repository,
        record: completed,
        event: "approve_unflagged_completion",
        actorRole: "system",
        patch: { review: { ...completed.review, review_state: "not_required" } },
      });
      response = ProcessingResponseSchema.parse({
        outcome: "processing_recorded",
        recovery_record_id: approved.record_id,
        server_revision: approved.revision,
        replayed: false,
      });
    }
    repository.recordIdempotency(parsed.idempotency, response, nowUtc());
    return response;
  };

  const storeCompletionEvidence = async (
    recordId: string,
    image: Blob,
    offline: boolean,
    preview?: string,
  ) =>
    repository.putEvidence(
      createEvidence({
        recordId,
        evidenceType: "processing_completion",
        capturedBy: actor,
        captureSource: offline ? "approved_demo_fixture" : "recycler_camera",
        mimeType: image.type || "image/jpeg",
        fileSizeBytes: image.size,
        contentDigest: await sha256Blob(image),
        connectivity: offline ? "offline" : "online",
      }),
      preview,
    );

  const receivedRecord = (recordId: string) => {
    const record = repository.findRecord(recordId);
    if (!record) throw notFound();
    requirePermission(context, permission["processing:record"], { record });
    return record;
  };

  return {
    record: async (request) => {
      await pause(context.delayMilliseconds);
      return recordProcessing(request);
    },

    async listQueue(request) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["processing:record"]);
      const queue = repository
        .listRecords()
        .filter(
          (record) =>
            record.business_state === "received" &&
            record.handoff !== undefined &&
            actor.locationIds.includes(record.handoff.receiving_location_id),
        )
        .sort((left, right) =>
          (left.handoff?.server_received_at ?? "").localeCompare(
            right.handoff?.server_received_at ?? "",
          ),
        );
      const limit = request.limit ?? 25;
      const offset = request.cursor ? Number.parseInt(request.cursor, 10) || 0 : 0;
      const next = offset + limit < queue.length ? String(offset + limit) : null;
      return RecoveryRecordPageSchema.parse({
        items: queue.slice(offset, offset + limit),
        pagination: { next_cursor: next, has_more: next !== null },
      });
    },

    async getDraft(recordId) {
      await pause(context.delayMilliseconds);
      receivedRecord(recordId);
      return repository.getProcessingDraft(recordId);
    },

    async saveDraft(recordId, input) {
      await pause(context.delayMilliseconds);
      const record = receivedRecord(recordId);
      if (record.business_state !== "received") {
        throw invalidTransition("Processing can only be prepared after the handoff is received.");
      }
      const existing = repository.getProcessingDraft(recordId);
      const evidence = input.completionEvidence
        ? await storeCompletionEvidence(
            recordId,
            input.completionEvidence,
            input.offline,
            input.completionEvidencePreview,
          )
        : null;
      const entries = input.materialEntries.map((entry) => ({
        entry_id: entry.entryId ?? newUuid(),
        material: entry.material.trim(),
        weight: entry.weight,
      }));
      return repository.putProcessingDraft({
        record_id: record.record_id,
        status: "draft",
        processing_method: input.method,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        ...(input.processedAt ? { processing_timestamp: input.processedAt } : {}),
        completion_evidence_ids: evidence
          ? [evidence.evidence_id]
          : [...(existing?.completion_evidence_ids ?? [])],
        material_entries: entries,
        total_recovered_weight_kg: Number(
          entries.reduce((total, entry) => total + toKilograms(entry.weight), 0).toFixed(4),
        ),
        version: (existing?.version ?? 0) + 1,
        updated_at: nowUtc(),
      });
    },

    async submitProcessing(input: RecordProcessingInput) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(input.recordId);
      if (!record) throw notFound();
      requirePermission(context, permission["processing:record"], { record });
      if (isTerminal(record)) {
        throw invalidTransition("A decided record cannot be edited.");
      }
      if (input.notes.trim().length === 0) {
        throw validationFailed("A processing result is required.", [
          { field: "notes", reason: "required" },
        ]);
      }
      const invalidEntry = input.materialEntries.find(
        (entry) =>
          entry.material.trim().length === 0 ||
          !Number.isFinite(entry.weight.value) ||
          entry.weight.value <= 0,
      );
      if (invalidEntry) {
        throw validationFailed("Every recovered material needs a name and a positive weight.", [
          { field: "materialEntries", reason: "invalid_entry" },
        ]);
      }

      const evidenceIds = input.completionEvidence
        ? [
            (
              await storeCompletionEvidence(
                record.record_id,
                input.completionEvidence,
                input.offline,
                input.completionEvidencePreview,
              )
            ).evidence_id,
          ]
        : [...(input.completionEvidenceIds ?? [])];
      if (evidenceIds.length === 0) {
        throw validationFailed("A processing or completion photograph is required.", [
          { field: "completionEvidence", reason: "required" },
        ]);
      }

      const payload = {
        recovery_record_id: record.record_id,
        recycler_reference: toActorReference(actor),
        processing_method: input.method,
        material_entries: input.materialEntries.map((entry) => ({
          material: entry.material.trim(),
          weight: entry.weight,
        })),
        processing_timestamp: input.processedAt,
        completion_evidence_ids: evidenceIds,
        notes: input.notes.trim().slice(0, 1_000),
      };

      return recordProcessing(
        ProcessingRequestSchema.parse({
          ...payload,
          idempotency: {
            idempotency_key: idempotencyKeyFor(
              "record_processing",
              record.record_id,
              actor.actorId,
            ),
            request_digest: await sha256Json({
              recovery_record_id: record.record_id,
              processing_method: input.method,
              material_entries: payload.material_entries.map((entry) => ({
                material: entry.material,
                value: entry.weight.value,
                unit: entry.weight.unit,
              })),
              notes: input.notes.trim(),
            }),
            scope: {
              actor_id: actor.actorId,
              operation: "record_processing",
              resource_id: record.record_id,
            },
          },
        }),
      );
    },
  };
};
