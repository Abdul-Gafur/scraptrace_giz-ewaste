import { EvidenceSchema, RecoveryRecordSchema } from "../../src/index.js";

export const IDS = {
  record: "0199a111-1111-7111-8111-111111111111",
  evidence: "0199a222-2222-7222-8222-222222222222",
  actor: "0199a333-3333-7333-8333-333333333333",
  device: "0199a444-4444-7444-8444-444444444444",
  prediction: "0199a555-5555-7555-8555-555555555555",
  location: "0199a666-6666-7666-8666-666666666666",
  card: "0199a777-7777-7777-8777-777777777777",
  mutation: "0199a888-8888-7888-8888-888888888888",
} as const;

const actor = { actor_id: IDS.actor } as const;

export const validEvidence = EvidenceSchema.parse({
  evidence_schema_version: "1.0.0",
  evidence_id: IDS.evidence,
  recovery_record_id: IDS.record,
  evidence_type: "original_item_photo",
  storage_reference: { storage_provider: "private-object-store", object_key: "evidence/demo/original.jpg" },
  mime_type: "image/jpeg",
  file_size_bytes: 1024,
  content_digest: `sha256:${"a".repeat(64)}`,
  provenance: {
    capture_source: "approved_demo_fixture",
    captured_by: actor,
    device_instance_id: IDS.device,
    captured_at: "2026-09-20T08:00:00Z",
    application_version: "0.1.0",
    connectivity: "offline",
  },
  validation_status: "accepted",
});

export const validRecoveryRecord = RecoveryRecordSchema.parse({
  contract_schema_version: "1.0.0",
  record_id: IDS.record,
  human_reference: "ST-DEMO0001",
  qr_payload: {
    contract_version: "1.0.0",
    record_id: IDS.record,
    lookup_token: "opaque_demo_lookup_token_0001",
  },
  revision: 0,
  record_kind: "item",
  category: "televisions",
  item_count: 1,
  condition: "damaged",
  original_image_evidence_id: IDS.evidence,
  collector: actor,
  captured_at: "2026-09-20T08:00:00Z",
  approximate_area: { label: "Demonstration area", country_code: "GH" },
  vision_result: {
    prediction_id: IDS.prediction,
    model_name: "demo-classifier",
    model_version: "0.1.0",
    inferred_at: "2026-09-20T08:00:05Z",
    scores: [
      { category: "refrigerators", score: 0.02 },
      { category: "laptops_and_desktop_computers", score: 0.03 },
      { category: "televisions", score: 0.84 },
      { category: "microwaves", score: 0.02 },
      { category: "air_conditioners", score: 0.03 },
      { category: "compressors", score: 0.02 },
      { category: "mixed_scrap", score: 0.04 },
    ],
    suggested_category: "televisions",
    confidence: 0.84,
    low_confidence: false,
  },
  category_confirmation: {
    confirmed_category: "televisions",
    confirmed_by: actor,
    confirmed_at: "2026-09-20T08:00:10Z",
    source: "accepted_prediction",
  },
  review: { review_state: "not_required", flag_codes: [], evidence_considered: [] },
  business_state: "draft",
  handoff_state: "not_started",
  processing_state: "not_started",
  sync: {
    sync_state: "offline",
    device_instance_id: IDS.device,
    local_revision: 0,
  },
  created_at: "2026-09-20T08:00:00Z",
  updated_at: "2026-09-20T08:00:10Z",
});
