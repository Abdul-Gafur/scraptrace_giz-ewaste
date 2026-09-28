import {
  CONTRACT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  EvidenceSchema,
  RecoveryRecordEventSchema,
  RecoveryRecordSchema,
  computeRecoveryRecordDigest,
  transitionRecoveryRecord,
  type ActorReference,
  type Evidence,
  type EvidenceType,
  type EwasteCategory,
  type GeoCoordinates,
  type RecoveryRecord,
  type RecoveryRecordEvent,
  type LifecycleEventType,
  type QrPayload,
  type TransitionActorRole,
  type VisionResult,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { DEMO_DEVICE_ID, toActorReference, type ActorContext } from "@/auth/actors";
import {
  newEventId,
  newEvidenceId,
  newHumanReference,
  newLookupToken,
  newRecoveryRecordId,
} from "@/services/domain/identifiers";
import { nowUtc, toUtcTimestamp } from "@/services/domain/time";

import { invalidTransition } from "./errors";
import type { ScrapTraceRepository } from "./repository";

/** The application version stamped into evidence provenance. */
export const APPLICATION_VERSION = "0.1.0";

export type Weight = z.infer<typeof RecoveryRecordSchema>["approximate_weight"];

export interface NewRecordInput {
  readonly collector: ActorContext;
  readonly category: EwasteCategory;
  readonly condition: "working" | "repairable" | "damaged" | "unknown";
  readonly itemCount?: number;
  readonly approximateWeight?: { readonly value: number; readonly unit: "kg" | "g" };
  readonly areaLabel: string;
  readonly countryCode: string;
  readonly administrativeArea?: string;
  readonly captureLocation?: GeoCoordinates;
  readonly originalImageEvidenceId: string;
  readonly visionResult?: VisionResult;
  readonly confirmationSource: "accepted_prediction" | "manual_selection" | "human_correction";
  readonly correctionReason?: string;
  readonly capturedAt?: string;
  readonly estimatedPrice?: RecoveryRecord["estimated_price"];
  readonly safetyGuide?: RecoveryRecord["safety_guide"];
  readonly destination?: RecoveryRecord["destination"];
}

/**
 * Builds a contract-valid draft record. Mixed scrap is forced to a batch with an approximate
 * weight, which the contract requires and the price rule depends on (BR-005).
 */
export const createDraftRecord = (input: NewRecordInput): RecoveryRecord => {
  const recordId = newRecoveryRecordId();
  const capturedAt = input.capturedAt ?? nowUtc();
  const collectorReference: ActorReference = toActorReference(input.collector);
  const isBatch = input.category === "mixed_scrap";
  return RecoveryRecordSchema.parse({
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    record_id: recordId,
    human_reference: newHumanReference(),
    qr_payload: {
      contract_version: CONTRACT_SCHEMA_VERSION,
      record_id: recordId,
      lookup_token: newLookupToken(),
    },
    revision: 0,
    record_kind: isBatch ? "batch" : "item",
    category: input.category,
    ...(input.itemCount !== undefined && !isBatch ? { item_count: input.itemCount } : {}),
    ...(input.approximateWeight ? { approximate_weight: input.approximateWeight } : {}),
    condition: input.condition,
    original_image_evidence_id: input.originalImageEvidenceId,
    collector: collectorReference,
    captured_at: capturedAt,
    ...(input.captureLocation ? { capture_location: input.captureLocation } : {}),
    approximate_area: {
      label: input.areaLabel,
      ...(input.administrativeArea ? { administrative_area: input.administrativeArea } : {}),
      country_code: input.countryCode,
    },
    ...(input.visionResult ? { vision_result: input.visionResult } : {}),
    category_confirmation: {
      confirmed_category: input.category,
      confirmed_by: collectorReference,
      confirmed_at: capturedAt,
      source: input.confirmationSource,
      ...(input.correctionReason ? { correction_reason: input.correctionReason } : {}),
    },
    ...(input.estimatedPrice ? { estimated_price: input.estimatedPrice } : {}),
    ...(input.safetyGuide ? { safety_guide: input.safetyGuide } : {}),
    ...(input.destination ? { destination: input.destination } : {}),
    review: { review_state: "not_required", flag_codes: [], evidence_considered: [] },
    business_state: "draft",
    handoff_state: "not_started",
    processing_state: "not_started",
    sync: {
      sync_state: "pending_synchronization",
      device_instance_id: DEMO_DEVICE_ID,
      local_revision: 0,
    },
    created_at: capturedAt,
    updated_at: capturedAt,
  });
};

export interface NewEvidenceInput {
  readonly recordId: string;
  readonly evidenceType: EvidenceType;
  readonly capturedBy: ActorContext;
  readonly captureSource:
    | "in_app_camera"
    | "recycler_camera"
    | "document_scanner"
    | "approved_demo_fixture"
    | "system_generated";
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly contentDigest: string;
  readonly coordinates?: GeoCoordinates;
  readonly connectivity: "offline" | "online";
  readonly aiObservation?: {
    readonly model_name: string;
    readonly model_version: string;
    readonly original_prediction: string;
    readonly confidence: number;
  };
  readonly humanCorrection?: {
    readonly original_value: string;
    readonly corrected_value: string;
    readonly corrected_by: ActorReference;
    readonly corrected_at: string;
    readonly reason?: string;
  };
  readonly capturedAt?: string;
}

/**
 * Builds a contract-valid evidence record. `object_key` is a storage key, never a public or
 * signed URL, which the contract enforces.
 */
export const createEvidence = (input: NewEvidenceInput): Evidence => {
  const evidenceId = newEvidenceId();
  const capturedAt = input.capturedAt ?? nowUtc();
  return EvidenceSchema.parse({
    evidence_schema_version: CONTRACT_SCHEMA_VERSION,
    evidence_id: evidenceId,
    recovery_record_id: input.recordId,
    evidence_type: input.evidenceType,
    storage_reference: {
      storage_provider: "browser-demonstration-store",
      object_key: `records/${input.recordId}/${input.evidenceType}/${evidenceId}`,
    },
    mime_type: input.mimeType,
    file_size_bytes: Math.max(1, Math.round(input.fileSizeBytes)),
    content_digest: input.contentDigest,
    provenance: {
      capture_source: input.captureSource,
      captured_by: toActorReference(input.capturedBy),
      device_instance_id: DEMO_DEVICE_ID,
      captured_at: capturedAt,
      server_received_at: capturedAt,
      ...(input.coordinates ? { coordinates: input.coordinates } : {}),
      application_version: APPLICATION_VERSION,
      connectivity: input.connectivity,
      ...(input.aiObservation ? { ai_observation: input.aiObservation } : {}),
      ...(input.humanCorrection ? { human_correction: input.humanCorrection } : {}),
    },
    validation_status: "accepted",
  });
};

/** Evidence identifiers of a record, as the transition rules need them. */
export const availableEvidenceTypes = (
  repository: ScrapTraceRepository,
  recordId: string,
): ReadonlySet<EvidenceType> =>
  new Set(repository.listEvidence(recordId).map((item) => item.evidence_type));

/**
 * The QR payload of a record in the browser-backed repository. Local records always carry the
 * payload the device generated; an API never embeds it in the record resource (ADR-009).
 */
export const localQrPayload = (record: RecoveryRecord): QrPayload => {
  if (!record.qr_payload) throw new Error("A local record always carries its QR payload.");
  return record.qr_payload;
};

export interface ApplyTransitionInput {
  readonly repository: ScrapTraceRepository;
  readonly record: RecoveryRecord;
  readonly event: LifecycleEventType;
  readonly actorRole: TransitionActorRole;
  readonly actor?: ActorContext;
  readonly reason?: string;
  readonly isOffline?: boolean;
  /** Fields merged into the record alongside the new state. */
  readonly patch?: Partial<RecoveryRecord>;
}

/**
 * Applies one lifecycle event through the contract state machine, appends the audit event and
 * stores the new record revision with a refreshed integrity digest.
 *
 * The transition rules decide; this function never bypasses them, so an invalid event or an
 * actor role that may not perform it is rejected here rather than in a screen.
 */
export const applyTransition = async (
  input: ApplyTransitionInput,
): Promise<{ readonly record: RecoveryRecord; readonly event: RecoveryRecordEvent }> => {
  const { repository, record } = input;
  const result = transitionRecoveryRecord({
    current_state: record.business_state,
    event: input.event,
    actor_role: input.actorRole,
    available_evidence: availableEvidenceTypes(repository, record.record_id),
    is_offline: input.isOffline ?? false,
    has_unresolved_flags:
      record.review.flag_codes.length > 0 && record.review.review_state === "open",
  });
  if (!result.ok) {
    throw invalidTransition(result.error.message, `errors.transition.${result.error.code}`);
  }

  const occurredAt = nowUtc();
  const previousDigest = record.integrity_digest;
  const candidate: RecoveryRecord = RecoveryRecordSchema.parse({
    ...record,
    ...input.patch,
    business_state: result.next_state,
    revision: record.revision + 1,
    sync: {
      ...record.sync,
      sync_state: "synchronized",
      local_revision: record.sync.local_revision + 1,
      server_revision: record.revision + 1,
      last_attempt_at: occurredAt,
    },
    updated_at: occurredAt,
    ...(previousDigest ? { previous_integrity_digest: previousDigest } : {}),
  });
  const digest = await computeRecoveryRecordDigest(candidate);
  const stored = repository.putRecord({ ...candidate, integrity_digest: digest });
  const event = repository.appendEvent(
    RecoveryRecordEventSchema.parse({
      event_schema_version: EVENT_SCHEMA_VERSION,
      event_id: newEventId(),
      recovery_record_id: record.record_id,
      event_type: input.event,
      ...(input.actor ? { actor: toActorReference(input.actor) } : {}),
      actor_role: input.actorRole,
      occurred_at: occurredAt,
      previous_state: result.previous_state,
      resulting_state: result.next_state,
      ...(input.reason ? { reason: input.reason } : {}),
    }),
  );
  return { record: stored, event };
};

/** Re-stamps the integrity digest after a non-transitional field update. */
export const storeWithDigest = async (
  repository: ScrapTraceRepository,
  record: RecoveryRecord,
): Promise<RecoveryRecord> => {
  const digest = await computeRecoveryRecordDigest(record);
  return repository.putRecord({ ...record, integrity_digest: digest });
};

export const timestamp = (value?: string): string => (value ? toUtcTimestamp(value) : nowUtc());
