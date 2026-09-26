import {
  CONTRACT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  EWASTE_CATEGORIES,
  EventIdSchema,
  RecoveryRecordSchema,
  RecoveryRecordStateSchema,
  ReviewStateSchema,
  type EwasteCategory,
  type ItemCondition,
  type PriceEstimate,
  type RecoveryRecord,
  type RecoveryRecordEvent,
  type UserRole,
} from "@scraptrace/contracts";

import type { CaptureDraftInput } from "@/services/ports/service-ports";

import {
  newEvidenceId,
  newHumanReference,
  newLookupToken,
  newRecordId,
  newUuid,
  nowTimestamp,
} from "./ids";
import type { ProgrammeState } from "./state";

/**
 * Pure transitions over the programme state. They exist separately from the service layer so
 * the lifecycle rules can be read — and tested — without any storage or React involved.
 */

const state = RecoveryRecordStateSchema.enum;
const review = ReviewStateSchema.enum;

export const recordEvent = (
  current: ProgrammeState,
  record: RecoveryRecord,
  eventType: RecoveryRecordEvent["event_type"],
  actorRole: UserRole | "system",
  previous: RecoveryRecord["business_state"],
  resulting: RecoveryRecord["business_state"],
  reason?: string,
): RecoveryRecordEvent => ({
  event_schema_version: EVENT_SCHEMA_VERSION,
  event_id: EventIdSchema.parse(newUuid()),
  recovery_record_id: record.record_id,
  event_type: eventType,
  actor_role: actorRole,
  occurred_at: nowTimestamp(),
  previous_state: previous,
  resulting_state: resulting,
  ...(reason ? { reason } : {}),
});

export const replaceRecord = (
  current: ProgrammeState,
  next: RecoveryRecord,
  events: readonly RecoveryRecordEvent[] = [],
): ProgrammeState => ({
  ...current,
  records: current.records.map((candidate) =>
    candidate.record_id === next.record_id ? next : candidate,
  ),
  events: [...events, ...current.events],
});

/** Builds a contract-valid draft from what the capture screen collected. */
export const buildDraft = (
  input: CaptureDraftInput,
  actorId: string,
  deviceInstanceId: string,
  online: boolean,
): RecoveryRecord => {
  const id = newRecordId();
  const capturedAt = nowTimestamp();
  const isBatch = input.category === "mixed_scrap";
  return RecoveryRecordSchema.parse({
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    record_id: id,
    human_reference: newHumanReference(),
    qr_payload: {
      contract_version: CONTRACT_SCHEMA_VERSION,
      record_id: id,
      lookup_token: newLookupToken(),
    },
    revision: 0,
    record_kind: isBatch ? "batch" : "item",
    category: input.category,
    item_count: input.itemCount,
    ...(input.approximateWeightKg
      ? { approximate_weight: { value: input.approximateWeightKg, unit: "kg" } }
      : {}),
    condition: input.condition,
    original_image_evidence_id: input.evidenceId,
    collector: { actor_id: actorId },
    captured_at: capturedAt,
    ...(input.coordinates
      ? {
          capture_location: {
            latitude: input.coordinates.latitude,
            longitude: input.coordinates.longitude,
            ...(input.coordinates.accuracyMetres
              ? { accuracy_metres: input.coordinates.accuracyMetres }
              : {}),
            source: "device",
          },
        }
      : {}),
    approximate_area: { label: input.areaLabel, country_code: input.countryCode },
    ...(input.vision ? { vision_result: input.vision } : {}),
    category_confirmation: {
      confirmed_category: input.category,
      confirmed_by: { actor_id: actorId },
      confirmed_at: capturedAt,
      source: input.confirmationSource,
      ...(input.correctionReason ? { correction_reason: input.correctionReason } : {}),
    },
    ...(input.estimate ? { estimated_price: input.estimate } : {}),
    ...(input.safetyGuide ? { safety_guide: input.safetyGuide } : {}),
    ...(input.destinationLocationId
      ? {
          destination: {
            location_id: input.destinationLocationId,
            facility_type: "collection_centre",
            verification_status: "programme_verified",
            selected_at: capturedAt,
          },
        }
      : {}),
    review: { review_state: review.not_required, flag_codes: [], evidence_considered: [] },
    business_state: state.draft,
    handoff_state: "not_started",
    processing_state: "not_started",
    sync: {
      sync_state: online ? "synchronized" : "offline",
      device_instance_id: deviceInstanceId,
      local_revision: 0,
      ...(online ? { server_revision: 0 } : {}),
    },
    created_at: capturedAt,
    updated_at: capturedAt,
  });
};

/** Draft to submitted to awaiting handoff, the two transitions a collector makes at once. */
export const submitRecord = (record: RecoveryRecord, online: boolean): RecoveryRecord =>
  RecoveryRecordSchema.parse({
    ...record,
    revision: record.revision + 1,
    business_state: state.awaiting_handoff,
    handoff_state: "awaiting",
    sync: {
      ...record.sync,
      sync_state: online ? "synchronized" : "pending_synchronization",
      local_revision: record.sync.local_revision + 1,
      ...(online ? { server_revision: record.sync.local_revision + 1 } : {}),
    },
    updated_at: nowTimestamp(),
  });

/** A demonstration classifier: deterministic from the evidence id, never a trained model. */
export const demonstrationPrediction = (
  evidenceId: string,
): {
  category: EwasteCategory;
  scores: { category: EwasteCategory; score: number }[];
  confidence: number;
} => {
  const seed = [...evidenceId].reduce((total, character) => total + character.charCodeAt(0), 0);
  const suggestedIndex = seed % EWASTE_CATEGORIES.length;
  const suggested = EWASTE_CATEGORIES[suggestedIndex] as EwasteCategory;
  const confidence = Math.round((0.48 + ((seed % 47) / 47) * 0.5) * 100) / 100;
  const remainder = Math.round(((1 - confidence) / (EWASTE_CATEGORIES.length - 1)) * 100) / 100;
  return {
    category: suggested,
    confidence,
    scores: EWASTE_CATEGORIES.map((category) => ({
      category: category as EwasteCategory,
      score: category === suggested ? confidence : remainder,
    })),
  };
};

const PRICE_BASIS: Record<EwasteCategory, { perKg: number; assumedKg: number }> = {
  refrigerators: { perKg: 0.42, assumedKg: 55 },
  laptops_and_desktop_computers: { perKg: 1.1, assumedKg: 4 },
  televisions: { perKg: 0.28, assumedKg: 12 },
  microwaves: { perKg: 0.4, assumedKg: 14 },
  air_conditioners: { perKg: 0.55, assumedKg: 30 },
  compressors: { perKg: 0.62, assumedKg: 18 },
  mixed_scrap: { perKg: 0.35, assumedKg: 25 },
};

const CONDITION_FACTOR: Record<ItemCondition, number> = {
  working: 1.3,
  repairable: 1.1,
  damaged: 0.85,
  unknown: 0.8,
};

/**
 * An indicative range, never an offer. The band is deliberately wide and the disclaimer travels
 * with the number, so the estimate cannot be read as a promised payment (SRS, ADR-003).
 */
export const estimatePrice = (input: {
  category: EwasteCategory;
  condition: ItemCondition;
  itemCount?: number;
  approximateWeightKg?: number;
  effectiveDate: string;
}): PriceEstimate => {
  const basis = PRICE_BASIS[input.category];
  const weight = input.approximateWeightKg ?? basis.assumedKg * (input.itemCount ?? 1);
  const centre = weight * basis.perKg * CONDITION_FACTOR[input.condition];
  return {
    category: input.category,
    condition: input.condition,
    ...(input.itemCount ? { count: input.itemCount } : {}),
    ...(input.approximateWeightKg
      ? { approximate_weight: { value: input.approximateWeightKg, unit: "kg" as const } }
      : input.category === "mixed_scrap"
        ? { approximate_weight: { value: weight, unit: "kg" as const } }
        : {}),
    minimum_amount: Math.round(centre * 0.7 * 100) / 100,
    maximum_amount: Math.round(centre * 1.3 * 100) / 100,
    currency: "USD",
    basis: "Reference rate per kilogram, adjusted for reported condition.",
    source: "ScrapTrace demonstration reference rates",
    effective_date: input.effectiveDate,
    disclaimer:
      "Indicative range for planning only. It is not an offer and the receiving facility sets the final price.",
  };
};

/** A measured weight far from the reported weight is a flag for a person, never a rejection. */
export const weightFlags = (record: RecoveryRecord, measuredKg: number): readonly string[] => {
  const reported = record.approximate_weight?.value;
  if (!reported) return [];
  const difference = Math.abs(measuredKg - reported) / reported;
  return difference > 0.25 ? ["WEIGHT_DISCREPANCY"] : [];
};

export const newEvidenceIdentifier = newEvidenceId;
