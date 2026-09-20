import {
  CONTRACT_SCHEMA_VERSION,
  RecoveryRecordSchema,
  type RecoveryRecord,
} from "@scraptrace/contracts";

export const FIXTURE_IDS = {
  record: "0199a111-1111-7111-8111-111111111111",
  evidence: "0199a222-2222-7222-8222-222222222222",
  actor: "0199a333-3333-7333-8333-333333333333",
  recycler: "0199a334-3333-7333-8333-333333333333",
  location: "0199a444-4444-7444-8444-444444444444",
  card: "0199a555-5555-7555-8555-555555555555",
  mutation: "0199a666-6666-7666-8666-666666666666",
  device: "0199a777-7777-7777-8777-777777777777",
} as const;

export const FIXTURE_TIMESTAMP = "2026-09-20T09:00:00.000Z";
export const FIXTURE_DIGEST = `sha256:${"a".repeat(64)}`;

export const createRecoveryRecordFixture = (): RecoveryRecord =>
  RecoveryRecordSchema.parse({
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    record_id: FIXTURE_IDS.record,
    human_reference: "ST-DEMO0001",
    qr_payload: {
      contract_version: CONTRACT_SCHEMA_VERSION,
      record_id: FIXTURE_IDS.record,
      lookup_token: "demo_opaque_lookup_token_0001",
    },
    revision: 0,
    record_kind: "item",
    category: "televisions",
    item_count: 1,
    condition: "damaged",
    original_image_evidence_id: FIXTURE_IDS.evidence,
    collector: { actor_id: FIXTURE_IDS.actor },
    captured_at: FIXTURE_TIMESTAMP,
    approximate_area: { label: "Demonstration area", country_code: "GH" },
    category_confirmation: {
      confirmed_category: "televisions",
      confirmed_by: { actor_id: FIXTURE_IDS.actor },
      confirmed_at: FIXTURE_TIMESTAMP,
      source: "manual_selection",
    },
    review: { review_state: "not_required", flag_codes: [], evidence_considered: [] },
    business_state: "draft",
    handoff_state: "not_started",
    processing_state: "not_started",
    sync: {
      sync_state: "offline",
      device_instance_id: FIXTURE_IDS.device,
      local_revision: 0,
    },
    created_at: FIXTURE_TIMESTAMP,
    updated_at: FIXTURE_TIMESTAMP,
  });
