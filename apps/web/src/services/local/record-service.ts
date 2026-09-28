import {
  EvidenceMetadataSchema,
  HandoffPreviewSchema,
  PermissionSchema,
  RecoveryRecordListRequestSchema,
  RecoveryRecordPageSchema,
  RecoveryRecordSchema,
  SafetyGuideReferenceSchema,
  UserRoleSchema,
  type Evidence,
  type EvidenceMetadata,
  type HandoffPreview,
  type RecoveryRecord,
} from "@scraptrace/contracts";

import { recordLocationId, toActorReference } from "@/auth/actors";
import { sha256Blob } from "@/services/domain/digest";
import { newLookupToken, newUuid } from "@/services/domain/identifiers";
import {
  PredictionFeedbackSchema,
  type PredictionFeedback,
} from "@/services/domain/model-administration";
import { classifyPresentedCode, decodeQrPayload } from "@/services/domain/qr-payload";
import { isTerminal } from "@/services/domain/records";
import { nowUtc } from "@/services/domain/time";
import type {
  AddEvidenceInput,
  CaptureInput,
  HandoffLookupResult,
  RecoveryRecordService,
  SubmitOutcome,
  UpdateDraftInput,
} from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { invalidTransition, notFound, serviceError, validationFailed } from "./errors";
import { ALL_DIRECTORY_LOCATIONS } from "./location-directory";
import {
  applyTransition,
  createDraftRecord,
  createEvidence,
  localQrPayload,
  storeWithDigest,
} from "./record-factory";
import { localCredentials, localTransferCode } from "./local-credentials";
import { findServableCard } from "./safety-service";

const permission = PermissionSchema.enum;
const role = UserRoleSchema.enum;

/** Evidence as an API returns it: the private storage reference never leaves the store. */
export const toEvidenceMetadata = (evidence: Evidence): EvidenceMetadata => {
  const metadata = Object.fromEntries(
    Object.entries(evidence).filter(([field]) => field !== "storage_reference"),
  );
  return EvidenceMetadataSchema.parse(metadata);
};

/** The minimised view a recycler receives before accepting an item (FR-HND-002). */
export const toHandoffPreview = (record: RecoveryRecord): HandoffPreview =>
  HandoffPreviewSchema.parse({
    record_id: record.record_id,
    human_reference: record.human_reference,
    record_kind: record.record_kind,
    category: record.category,
    ...(record.item_count === undefined ? {} : { item_count: record.item_count }),
    ...(record.approximate_weight ? { approximate_weight: record.approximate_weight } : {}),
    condition: record.condition,
    approximate_area: record.approximate_area,
    captured_at: record.captured_at,
    collector: record.collector,
    original_image_evidence_id: record.original_image_evidence_id,
    ...(record.destination ? { destination: record.destination } : {}),
    business_state: record.business_state,
    handoff_state: record.handoff_state,
  });

const RECYCLER_EVIDENCE_BY_STATE: Partial<
  Record<RecoveryRecord["business_state"], readonly string[]>
> = {
  awaiting_handoff: ["handoff_photo", "weight_measurement"],
  received: ["processing_completion"],
  under_review: ["handoff_photo", "weight_measurement", "processing_completion"],
};

/**
 * Collector record service.
 *
 * `createDraft` stores the accepted photograph as `original_item_photo` evidence before the
 * record, so a draft is never saved without the evidence its first transition requires
 * (FR-OFF-001). `submit` runs the two contract transitions that publish a record for handoff and
 * records the prediction outcome as stored feedback, which is labelled data for a future
 * controlled dataset release and never a retraining trigger (FR-VIS-008).
 */
export const createRecordService = (context: LocalServiceContext): RecoveryRecordService => {
  const { repository, actor } = context;

  const ownRecords = (): readonly RecoveryRecord[] =>
    repository.listRecords().filter((record) => record.collector.actor_id === actor.actorId);

  /** Records the acting role may see operationally, scoped by facility or programme. */
  const operationalRecords = (): readonly RecoveryRecord[] => {
    if (actor.role === role.collector) return ownRecords();
    if (actor.role === role.recycler) {
      return repository.listRecords().filter((record) => {
        const locationId = recordLocationId(record);
        return locationId === undefined || actor.locationIds.includes(locationId);
      });
    }
    return repository.listRecords();
  };

  const storeFeedback = (record: RecoveryRecord): PredictionFeedback | null => {
    const prediction = record.vision_result;
    if (!prediction) return null;
    return repository.putPredictionFeedback(
      PredictionFeedbackSchema.parse({
        feedback_id: newUuid(),
        recovery_record_id: record.record_id,
        evidence_id: record.original_image_evidence_id,
        model_name: prediction.model_name,
        model_version: prediction.model_version,
        predicted_category: prediction.suggested_category,
        confidence: prediction.confidence,
        low_confidence: prediction.low_confidence,
        confirmed_category: record.category_confirmation.confirmed_category,
        confirmation_source: record.category_confirmation.source,
        ...(record.category_confirmation.correction_reason
          ? { correction_reason: record.category_confirmation.correction_reason }
          : {}),
        feedback_state: "stored_for_review",
        created_at: nowUtc(),
      }),
    );
  };

  const referencesFor = (input: CaptureInput | UpdateDraftInput) => {
    // The reference records the card the collector actually read, in the language they read it.
    const card =
      findServableCard(repository, input.category, input.language) ??
      findServableCard(repository, input.category, "en");
    const safetyGuide = card
      ? SafetyGuideReferenceSchema.parse({
          card_id: card.card_id,
          card_version: card.version,
          category: card.category,
          language: card.language,
          approval_date: card.approval_date,
          review_date: card.review_date,
          source_references: card.sources.map((source) => source.reference),
        })
      : undefined;
    const chosen = ALL_DIRECTORY_LOCATIONS.find(
      (entry) => entry.location_id === input.destinationLocationId,
    );
    const destination = chosen
      ? {
          location_id: chosen.location_id,
          facility_type: chosen.facility_type,
          verification_status: chosen.verification_status,
          selected_at: nowUtc(),
        }
      : undefined;
    return { safetyGuide, destination };
  };

  return {
    async listOwn() {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["recovery_record:view_own"], { ownsResource: true });
      return ownRecords();
    },

    async listOperational() {
      await pause(context.delayMilliseconds);
      if (actor.role === role.collector) {
        requirePermission(context, permission["recovery_record:view_own"], { ownsResource: true });
        return ownRecords();
      }
      requirePermission(context, permission["recovery_record:view_operational"]);
      return operationalRecords();
    },

    async listPage(request) {
      await pause(context.delayMilliseconds);
      const parsed = RecoveryRecordListRequestSchema.parse(request);
      if (actor.role === role.collector) {
        requirePermission(context, permission["recovery_record:view_own"], { ownsResource: true });
      } else {
        requirePermission(context, permission["recovery_record:view_operational"]);
      }
      const field = parsed.sort.replace(/^-/, "") as "created_at" | "updated_at" | "captured_at";
      const direction = parsed.sort.startsWith("-") ? -1 : 1;
      const filtered = [...operationalRecords()]
        .filter((record) => !parsed.state || parsed.state.includes(record.business_state))
        .filter((record) => !parsed.category || parsed.category.includes(record.category))
        .filter(
          (record) =>
            !parsed.captured_from || record.captured_at.slice(0, 10) >= parsed.captured_from,
        )
        .filter(
          (record) => !parsed.captured_to || record.captured_at.slice(0, 10) <= parsed.captured_to,
        )
        .sort((left, right) => direction * left[field].localeCompare(right[field]));
      const offset = parsed.cursor ? Number.parseInt(parsed.cursor, 10) || 0 : 0;
      const items = filtered.slice(offset, offset + parsed.limit);
      const next = offset + parsed.limit < filtered.length ? String(offset + parsed.limit) : null;
      return RecoveryRecordPageSchema.parse({
        items,
        pagination: { next_cursor: next, has_more: next !== null },
      });
    },

    async getById(recordId) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record) return null;
      const scoped =
        actor.role === role.collector
          ? permission["recovery_record:view_own"]
          : permission["recovery_record:view_operational"];
      requirePermission(context, scoped, { record });
      return record;
    },

    async createDraft(input: CaptureInput) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["recovery_record:create"]);

      const settings = repository.getProgrammeSettings();
      if (!settings) throw validationFailed("Programme settings are not available.");
      if (input.category === "mixed_scrap" && !input.approximateWeight) {
        throw validationFailed("Mixed scrap requires an approximate weight.", [
          { field: "approximateWeight", reason: "required_for_mixed_scrap" },
        ]);
      }

      const digest = await sha256Blob(input.image);
      const recordId = newUuid();
      // Evidence is written first so the record never exists without its original photograph.
      const provisional = createEvidence({
        recordId,
        evidenceType: "original_item_photo",
        capturedBy: actor,
        captureSource: input.offline ? "approved_demo_fixture" : "in_app_camera",
        mimeType: input.image.type || "image/jpeg",
        fileSizeBytes: input.image.size,
        contentDigest: digest,
        ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
        ...(input.captureLocation ? { coordinates: input.captureLocation } : {}),
        connectivity: input.offline ? "offline" : "online",
        ...(input.visionResult
          ? {
              aiObservation: {
                model_name: input.visionResult.model_name,
                model_version: input.visionResult.model_version,
                original_prediction: input.visionResult.suggested_category,
                confidence: input.visionResult.confidence,
              },
            }
          : {}),
        ...(input.visionResult &&
        input.visionResult.suggested_category !== input.category &&
        input.confirmationSource === "human_correction"
          ? {
              humanCorrection: {
                original_value: input.visionResult.suggested_category,
                corrected_value: input.category,
                corrected_by: toActorReference(actor),
                corrected_at: nowUtc(),
                ...(input.correctionReason ? { reason: input.correctionReason } : {}),
              },
            }
          : {}),
      });

      const { safetyGuide, destination } = referencesFor(input);

      const draft = createDraftRecord({
        collector: actor,
        category: input.category,
        condition: input.condition,
        ...(input.itemCount !== undefined ? { itemCount: input.itemCount } : {}),
        ...(input.approximateWeight ? { approximateWeight: input.approximateWeight } : {}),
        areaLabel: input.areaLabel,
        countryCode: settings.country_code,
        ...(input.administrativeArea ? { administrativeArea: input.administrativeArea } : {}),
        ...(input.captureLocation ? { captureLocation: input.captureLocation } : {}),
        originalImageEvidenceId: provisional.evidence_id,
        ...(input.visionResult ? { visionResult: input.visionResult } : {}),
        confirmationSource: input.confirmationSource,
        ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
        ...(input.correctionReason ? { correctionReason: input.correctionReason } : {}),
        ...(input.estimatedPrice ? { estimatedPrice: input.estimatedPrice } : {}),
        ...(safetyGuide ? { safetyGuide } : {}),
        ...(destination ? { destination } : {}),
      });

      // Re-point the evidence at the identifier the record actually received.
      repository.putEvidence(
        { ...provisional, recovery_record_id: draft.record_id },
        input.imagePreview,
      );
      return repository.putRecord({
        ...draft,
        original_image_evidence_id: provisional.evidence_id,
      });
    },

    async updateDraft(recordId, input) {
      await pause(context.delayMilliseconds);
      const current = repository.findRecord(recordId);
      if (!current) throw notFound();
      requirePermission(context, permission["recovery_record:correct_own"], { record: current });
      if (current.business_state !== "draft") {
        throw invalidTransition("Only a draft record can be edited.");
      }
      if (input.baseRevision !== undefined && input.baseRevision !== current.revision) {
        throw serviceError("VERSION_CONFLICT", "The draft changed before it could be saved.", {
          safeDetails: { current_revision: current.revision },
        });
      }
      if (input.category === "mixed_scrap" && !input.approximateWeight) {
        throw validationFailed("Mixed scrap requires an approximate weight.", [
          { field: "approximateWeight", reason: "required_for_mixed_scrap" },
        ]);
      }

      if (input.image) {
        // The original photograph is never replaced; a new one is additional evidence.
        repository.putEvidence(
          createEvidence({
            recordId,
            evidenceType: "additional_item_photo",
            capturedBy: actor,
            captureSource: input.offline ? "approved_demo_fixture" : "in_app_camera",
            mimeType: input.image.type || "image/jpeg",
            fileSizeBytes: input.image.size,
            contentDigest: await sha256Blob(input.image),
            connectivity: input.offline ? "offline" : "online",
          }),
          input.imagePreview,
        );
      }

      const { safetyGuide, destination } = referencesFor(input);
      const updatedAt = nowUtc();
      const requiredCurrent = { ...current };
      delete requiredCurrent.item_count;
      delete requiredCurrent.approximate_weight;
      delete requiredCurrent.capture_location;
      delete requiredCurrent.vision_result;
      delete requiredCurrent.estimated_price;
      delete requiredCurrent.safety_guide;
      delete requiredCurrent.destination;
      const requiredArea = { ...current.approximate_area };
      delete requiredArea.administrative_area;
      const updated = RecoveryRecordSchema.parse({
        ...requiredCurrent,
        revision: current.revision + 1,
        record_kind: input.category === "mixed_scrap" ? "batch" : "item",
        category: input.category,
        ...(input.category !== "mixed_scrap" && input.itemCount !== undefined
          ? { item_count: input.itemCount }
          : {}),
        ...(input.approximateWeight ? { approximate_weight: input.approximateWeight } : {}),
        condition: input.condition,
        ...(input.captureLocation ? { capture_location: input.captureLocation } : {}),
        approximate_area: {
          ...requiredArea,
          label: input.areaLabel,
          ...(input.administrativeArea ? { administrative_area: input.administrativeArea } : {}),
        },
        // The original prediction is kept as received: associated once, never replaced.
        ...((current.vision_result ?? input.visionResult)
          ? { vision_result: current.vision_result ?? input.visionResult }
          : {}),
        category_confirmation: {
          confirmed_category: input.category,
          confirmed_by: toActorReference(actor),
          confirmed_at: updatedAt,
          source: input.confirmationSource,
          ...(input.correctionReason ? { correction_reason: input.correctionReason } : {}),
        },
        ...(input.estimatedPrice ? { estimated_price: input.estimatedPrice } : {}),
        ...(safetyGuide ? { safety_guide: safetyGuide } : {}),
        ...(destination ? { destination } : {}),
        sync: {
          ...current.sync,
          sync_state: input.offline ? "pending_synchronization" : "synchronized",
          local_revision: current.sync.local_revision + 1,
          ...(input.offline ? {} : { server_revision: current.revision + 1 }),
          last_attempt_at: updatedAt,
        },
        updated_at: updatedAt,
      });
      return repository.putRecord(updated);
    },

    async submit(recordId) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record) throw notFound();
      requirePermission(context, permission["recovery_record:create"], { record });
      if (record.business_state !== "draft") {
        if (record.business_state === "awaiting_handoff" || record.business_state === "submitted") {
          // Submitting the same draft twice is one logical mutation: the existing published
          // record is returned instead of a second record being created (BR-007).
          return { outcome: "submitted", record, replayed: true } satisfies SubmitOutcome;
        }
        throw invalidTransition("This record has already moved beyond submission.");
      }

      const originalPhoto = repository.findEvidence(record.original_image_evidence_id);
      const duplicates = originalPhoto
        ? repository.findRecordsWithEvidenceDigest(originalPhoto.content_digest, recordId)
        : [];

      const submitted = await applyTransition({
        repository,
        record,
        event: "submit_record",
        actorRole: role.collector,
        actor,
      });
      const published = await applyTransition({
        repository,
        record: submitted.record,
        event: "publish_for_handoff",
        actorRole: "system",
      });
      storeFeedback(published.record);

      if (duplicates.length > 0) {
        // Exact image reuse is a review flag, never an automatic approval or rejection
        // (FR-REC-007, BR-009). The record still publishes so the journey continues.
        const flagged = await storeWithDigest(repository, {
          ...published.record,
          review: {
            ...published.record.review,
            review_state: "open",
            flag_codes: [
              ...new Set([
                ...published.record.review.flag_codes,
                "DUPLICATE_EVIDENCE_DIGEST" as const,
              ]),
            ],
          },
        });
        return {
          outcome: "duplicate_image",
          record: flagged,
          flagCodes: ["DUPLICATE_EVIDENCE_DIGEST"],
        } satisfies SubmitOutcome;
      }
      return {
        outcome: "submitted",
        record: published.record,
        replayed: false,
      } satisfies SubmitOutcome;
    },

    async getQrCredentials(recordId) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record || record.collector.actor_id !== actor.actorId) throw notFound();
      requirePermission(context, permission["recovery_record:correct_own"], { record });
      return localCredentials(record);
    },

    async reissueQrCredentials(recordId) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record || record.collector.actor_id !== actor.actorId) throw notFound();
      requirePermission(context, permission["recovery_record:correct_own"], { record });
      if (record.business_state !== "awaiting_handoff") {
        throw invalidTransition("A QR code can be reissued only while the record awaits handoff.");
      }
      const reissued = repository.putRecord(
        RecoveryRecordSchema.parse({
          ...record,
          qr_payload: { ...localQrPayload(record), lookup_token: newLookupToken() },
        }),
      );
      return localCredentials(reissued);
    },

    async lookupForHandoff(scannedTextOrCode) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["handoff:accept"]);

      const presented = classifyPresentedCode(scannedTextOrCode);
      let record: RecoveryRecord | null = null;
      let credential: Extract<HandoffLookupResult, { outcome: "ready" }>["credential"] | null =
        null;
      if (presented.kind === "qr_text") {
        const decoded = decodeQrPayload(presented.text);
        if (!decoded.ok) {
          return decoded.reason === "unsupported_contract_version"
            ? { outcome: "unsupported_contract_version" }
            : { outcome: "not_found" };
        }
        record = repository.findRecordByLookupToken(decoded.payload.lookup_token);
        if (record && record.record_id !== decoded.payload.record_id) record = null;
        credential = { kind: "qr_token", lookupToken: decoded.payload.lookup_token };
      } else if (presented.kind === "manual_transfer_code") {
        for (const candidate of repository.listRecords()) {
          if (!candidate.qr_payload || candidate.business_state === "draft") continue;
          if ((await localTransferCode(candidate)) === presented.code) record = candidate;
        }
        credential = { kind: "manual_transfer_code", code: presented.code };
      }

      if (!record || !credential || record.business_state === "draft") {
        return { outcome: "not_found" } satisfies HandoffLookupResult;
      }
      const locationId = recordLocationId(record);
      if (locationId !== undefined && !actor.locationIds.includes(locationId)) {
        return { outcome: "other_facility" };
      }
      const preview = toHandoffPreview(record);
      if (record.handoff) {
        return {
          outcome: "already_received",
          record: preview,
          receivedAt: record.handoff.server_received_at,
        };
      }
      if (record.business_state !== "awaiting_handoff" || isTerminal(record)) {
        return { outcome: "not_ready", record: preview };
      }
      return { outcome: "ready", record: preview, credential };
    },

    async listEvents(recordId) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record) throw notFound();
      requirePermission(
        context,
        actor.role === role.collector
          ? permission["recovery_record:view_own"]
          : permission["recovery_record:view_operational"],
        { record },
      );
      return repository.listEvents(recordId);
    },

    async listEvidence(recordId) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record) throw notFound();
      requirePermission(
        context,
        actor.role === role.collector
          ? permission["recovery_record:view_own"]
          : permission["recovery_record:view_operational"],
        { record },
      );
      return repository.listEvidence(recordId).map(toEvidenceMetadata);
    },

    async addEvidence(recordId, input: AddEvidenceInput) {
      await pause(context.delayMilliseconds);
      const record = repository.findRecord(recordId);
      if (!record) throw notFound();
      if (actor.role === role.collector) {
        requirePermission(context, permission["recovery_record:correct_own"], { record });
        if (record.business_state !== "draft" || input.evidenceType !== "additional_item_photo") {
          throw invalidTransition("Photographs can be added only while the record is a draft.");
        }
      } else {
        requirePermission(context, permission["handoff:record"], { record });
        const allowed = RECYCLER_EVIDENCE_BY_STATE[record.business_state] ?? [];
        if (!allowed.includes(input.evidenceType)) {
          throw invalidTransition("Evidence cannot be added in the record's current state.");
        }
      }
      const stored = repository.putEvidence(
        createEvidence({
          recordId,
          evidenceType: input.evidenceType,
          capturedBy: actor,
          captureSource:
            actor.role === role.collector
              ? "in_app_camera"
              : input.offline
                ? "approved_demo_fixture"
                : "recycler_camera",
          mimeType: input.image.type || "image/jpeg",
          fileSizeBytes: input.image.size,
          contentDigest: await sha256Blob(input.image),
          connectivity: input.offline ? "offline" : "online",
        }),
        input.preview,
      );
      return toEvidenceMetadata(stored);
    },

    async getEvidenceImage(evidenceId) {
      await pause(0);
      return repository.findEvidenceImage(evidenceId);
    },
  };
};
