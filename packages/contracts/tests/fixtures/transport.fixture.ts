import { IDS, validEvidence, validRecoveryRecord } from "./recovery-record.fixture.js";

const actor = { actor_id: IDS.actor } as const;
const recycler = { actor_id: IDS.recycler, programme_id: IDS.programme, facility_id: IDS.facility } as const;
const digest = `sha256:${"b".repeat(64)}`;

export const TRANSFER_CODE = "7K3Q-M9XD-2HVT";
export const LOOKUP_TOKEN = "opaque_demo_lookup_token_0001";

export const idempotency = (operation: string) => ({
  idempotency_key: `demo-key-${operation}-0001`,
  request_digest: digest,
  scope: { actor_id: IDS.recycler, operation, resource_id: IDS.record },
});

export const validHandoffRequest = {
  recovery_record_id: IDS.record,
  lookup_token: LOOKUP_TOKEN,
  collector_reference: actor,
  recycler_reference: recycler,
  receiving_location_id: IDS.location,
  handoff_time: "2026-09-21T09:00:00Z",
  confirmed_category: "televisions",
  confirmed_condition: "damaged",
  measured_weight: { value: 12.5, unit: "kg" },
  final_price: { amount: 40, currency: "GHS" },
  evidence_ids: [IDS.handoffPhoto, IDS.weightPhoto],
  idempotency: idempotency("record_handoff"),
} as const;

export const validHandoffPreview = {
  record_id: IDS.record,
  human_reference: "ST-DEMO0001",
  record_kind: "item",
  category: "televisions",
  item_count: 1,
  condition: "damaged",
  approximate_area: { label: "Demonstration area", country_code: "GH" },
  captured_at: "2026-09-20T08:00:00Z",
  collector: actor,
  original_image_evidence_id: IDS.evidence,
  business_state: "awaiting_handoff",
  handoff_state: "awaiting",
} as const;

export const validQrCredentials = {
  record_id: IDS.record,
  status: "active",
  qr_payload: { contract_version: "1.0.0", record_id: IDS.record, lookup_token: LOOKUP_TOKEN },
  manual_transfer_code: TRANSFER_CODE,
  issued_at: "2026-09-20T08:00:00Z",
  activated_at: "2026-09-20T08:10:00Z",
  expires_at: "2026-10-20T08:10:00Z",
} as const;

export const validProcessingRequest = {
  recovery_record_id: IDS.record,
  recycler_reference: recycler,
  processing_method: "material_recovery",
  material_entries: [{ material: "Copper", weight: { value: 2, unit: "kg" } }],
  processing_timestamp: "2026-09-22T10:00:00Z",
  completion_evidence_ids: [IDS.completion],
  notes: "Dismantled and separated.",
  idempotency: idempotency("record_processing"),
} as const;

export const validReviewRequest = {
  recovery_record_id: IDS.record,
  review_reason_codes: ["WEIGHT_DISCREPANCY"],
  assigned_reviewer: { actor_id: IDS.reviewer, programme_id: IDS.programme },
  evidence_considered: [IDS.handoffPhoto],
  decision: "approve",
  reason_code: "WEIGHT_EXPLAINED",
  reviewer_note: "The scale photograph explains the difference.",
  decision_timestamp: "2026-09-23T10:00:00Z",
  previous_review_state: "open",
  previous_record_state: "under_review",
  idempotency: idempotency("record_review_decision"),
} as const;

export const validCaseSummary = {
  case_id: IDS.reviewCase,
  record_id: IDS.record,
  human_reference: "ST-DEMO0001",
  category: "televisions",
  status: "open",
  flag_codes: ["WEIGHT_DISCREPANCY"],
  opened_at: "2026-09-21T09:00:00Z",
  facility_id: IDS.facility,
  record_business_state: "under_review",
  decision_eligible: true,
} as const;

export const validDraftCreate = {
  device_instance_id: IDS.device,
  category: "televisions",
  condition: "damaged",
  item_count: 1,
  captured_at: "2026-09-20T08:00:00Z",
  approximate_area: { label: "Demonstration area", country_code: "GH" },
  vision_result: validRecoveryRecord.vision_result,
  category_confirmation: validRecoveryRecord.category_confirmation,
  destination_location_id: IDS.location,
  original_image: {
    captured_at: "2026-09-20T08:00:00Z",
    capture_source: "in_app_camera",
    connectivity: "online",
    application_version: "0.1.0",
  },
} as const;

const { storage_reference: _storage, ...evidenceMetadata } = validEvidence;
export const validEvidenceMetadata = { ...evidenceMetadata, storage_transform: "reencoded_without_metadata" } as const;

export const serverRecord = (() => {
  const { qr_payload: _credential, ...record } = validRecoveryRecord;
  return {
    ...record,
    business_state: "awaiting_handoff",
    handoff_state: "awaiting",
    sync: { sync_state: "synchronized", device_instance_id: IDS.device, local_revision: 2, server_revision: 2 },
    revision: 2,
  } as const;
})();
