import { describe, expect, it } from "vitest";

import {
  EvidenceMetadataSchema,
  EvidenceUploadRequestSchema,
  HandoffLookupRequestSchema,
  HandoffLookupResponseSchema,
  HandoffRequestSchema,
  HandoffResponseSchema,
  IDEMPOTENT_OPERATIONS,
  ManualTransferCodeSchema,
  MaterialEntryUpdateSchema,
  ProcessingDetailSchema,
  ProcessingDraftUpdateSchema,
  ProcessingInformationSchema,
  ProcessingRequestSchema,
  ProgrammeReviewRequestSchema,
  PUBLIC_SCHEMA_REGISTRY,
  QrCredentialsSchema,
  REASON_CODES_BY_DECISION,
  REVIEW_FLAG_CODES,
  RecordSubmissionResponseSchema,
  RecoveryRecordDraftCreateSchema,
  RecoveryRecordDraftUpdateSchema,
  RecoveryRecordEventSchema,
  RecoveryRecordPageSchema,
  RecoveryRecordSchema,
  ReviewCaseSummarySchema,
  ReviewQueueFiltersSchema,
  SessionCreatedSchema,
  normalizeManualTransferCode,
} from "../src/index.js";
import { IDS, validRecoveryRecord } from "./fixtures/recovery-record.fixture.js";
import {
  LOOKUP_TOKEN,
  TRANSFER_CODE,
  serverRecord,
  validCaseSummary,
  validDraftCreate,
  validEvidenceMetadata,
  validHandoffPreview,
  validHandoffRequest,
  validProcessingRequest,
  validQrCredentials,
  validReviewRequest,
} from "./fixtures/transport.fixture.js";

describe("manual transfer codes", () => {
  it("accepts the canonical grouped form only", () => {
    expect(ManualTransferCodeSchema.safeParse(TRANSFER_CODE).success).toBe(true);
    expect(ManualTransferCodeSchema.safeParse("7K3QM9XD2HVT").success).toBe(false);
    expect(ManualTransferCodeSchema.safeParse("7K3Q-M9XD-2HVU").success).toBe(false);
    expect(ManualTransferCodeSchema.safeParse("ST-ABCDEFGHJK").success).toBe(false);
  });

  it("normalises typed input and applies the Crockford aliases", () => {
    expect(normalizeManualTransferCode(" 7k3q m9xd 2hvt ")).toBe(TRANSFER_CODE);
    expect(normalizeManualTransferCode("7k3qm9xd2hvt")).toBe(TRANSFER_CODE);
    expect(normalizeManualTransferCode("OOOO-IIII-LLLL")).toBe("0000-1111-1111");
    expect(normalizeManualTransferCode("7K3Q-M9XD")).toBeNull();
    expect(normalizeManualTransferCode("7K3Q-M9XD-2HVU")).toBeNull();
  });
});

describe("QR credentials and lookup", () => {
  it("returns both credentials only while they can be used", () => {
    expect(QrCredentialsSchema.safeParse(validQrCredentials).success).toBe(true);
    const { qr_payload: _qr, manual_transfer_code: _code, ...withoutCredentials } = validQrCredentials;
    expect(QrCredentialsSchema.safeParse({ ...withoutCredentials, status: "expired" }).success).toBe(true);
    expect(QrCredentialsSchema.safeParse({ ...validQrCredentials, status: "used" }).success).toBe(false);
    expect(QrCredentialsSchema.safeParse(withoutCredentials).success).toBe(false);
    const { activated_at: _activated, ...unactivated } = validQrCredentials;
    expect(QrCredentialsSchema.safeParse(unactivated).success).toBe(false);
    expect(QrCredentialsSchema.safeParse({ ...unactivated, status: "inactive" }).success).toBe(true);
  });

  it("accepts exactly one presented credential per lookup", () => {
    expect(HandoffLookupRequestSchema.safeParse({ manual_transfer_code: TRANSFER_CODE }).success).toBe(true);
    expect(HandoffLookupRequestSchema.safeParse({ qr_text: `SCRAPTRACE:1.0.0:${IDS.record}:${LOOKUP_TOKEN}` }).success).toBe(true);
    expect(
      HandoffLookupRequestSchema.safeParse({
        qr_payload: { contract_version: "9.0.0", record_id: IDS.record, lookup_token: LOOKUP_TOKEN },
      }).success,
    ).toBe(true);
    expect(HandoffLookupRequestSchema.safeParse({}).success).toBe(false);
    expect(HandoffLookupRequestSchema.safeParse({ qr_text: "x", manual_transfer_code: TRANSFER_CODE }).success).toBe(false);
    expect(HandoffLookupRequestSchema.safeParse({ lookup_token: LOOKUP_TOKEN }).success).toBe(false);
  });

  it("never carries a credential in a lookup result", () => {
    expect(HandoffLookupResponseSchema.safeParse({ outcome: "ready", record: validHandoffPreview }).success).toBe(true);
    expect(
      HandoffLookupResponseSchema.safeParse({ outcome: "ready", record: validHandoffPreview, lookup_token: LOOKUP_TOKEN }).success,
    ).toBe(false);
    expect(
      HandoffLookupResponseSchema.safeParse({ outcome: "ready", record: validHandoffPreview, manual_transfer_code: TRANSFER_CODE }).success,
    ).toBe(false);
    expect(HandoffLookupResponseSchema.safeParse({ outcome: "other_facility", record: validHandoffPreview }).success).toBe(false);
  });

  it("keeps coordinates and predictions out of the preview", () => {
    expect(
      HandoffLookupResponseSchema.safeParse({
        outcome: "ready",
        record: { ...validHandoffPreview, capture_location: { latitude: 5.6, longitude: -0.2, source: "device" } },
      }).success,
    ).toBe(false);
  });
});

describe("handoff", () => {
  it("requires exactly one credential in the request", () => {
    expect(HandoffRequestSchema.safeParse(validHandoffRequest).success).toBe(true);
    const { lookup_token: _token, ...withoutToken } = validHandoffRequest;
    expect(HandoffRequestSchema.safeParse({ ...withoutToken, manual_transfer_code: TRANSFER_CODE }).success).toBe(true);
    expect(HandoffRequestSchema.safeParse(withoutToken).success).toBe(false);
    expect(HandoffRequestSchema.safeParse({ ...validHandoffRequest, manual_transfer_code: TRANSFER_CODE }).success).toBe(false);
  });

  it("bounds handoff notes at 1,000 characters", () => {
    expect(HandoffRequestSchema.safeParse({ ...validHandoffRequest, notes: "n".repeat(1_000) }).success).toBe(true);
    expect(HandoffRequestSchema.safeParse({ ...validHandoffRequest, notes: "n".repeat(1_001) }).success).toBe(false);
  });

  it("names discrepancy flags and rejection reasons from the shared vocabulary", () => {
    expect(
      HandoffResponseSchema.safeParse({ outcome: "discrepancy", flag_codes: ["WEIGHT_DISCREPANCY"], received_at: "2026-09-21T09:00:00Z", replayed: false }).success,
    ).toBe(true);
    expect(
      HandoffResponseSchema.safeParse({ outcome: "discrepancy", flag_codes: ["LOOKS_SUSPICIOUS"], received_at: "2026-09-21T09:00:00Z", replayed: false }).success,
    ).toBe(false);
    expect(
      HandoffResponseSchema.safeParse({ outcome: "rejected", reason_code: "TOKEN_MISMATCH", message: "No.", replayed: false }).success,
    ).toBe(false);
    expect(
      HandoffResponseSchema.safeParse({ outcome: "duplicate_scan", original_received_at: "2026-09-21T09:00:00Z", original_logical_result: "discrepancy" }).success,
    ).toBe(true);
  });
});

describe("recovery-record transport", () => {
  it("creates a draft without server-owned fields", () => {
    expect(RecoveryRecordDraftCreateSchema.safeParse(validDraftCreate).success).toBe(true);
    expect(RecoveryRecordDraftCreateSchema.safeParse({ ...validDraftCreate, human_reference: "ST-DEMO0001" }).success).toBe(false);
    expect(RecoveryRecordDraftCreateSchema.safeParse({ ...validDraftCreate, business_state: "submitted" }).success).toBe(false);
    const { original_image: _image, ...withoutImage } = validDraftCreate;
    expect(RecoveryRecordDraftCreateSchema.safeParse(withoutImage).success).toBe(false);
    expect(
      RecoveryRecordDraftCreateSchema.safeParse({
        ...validDraftCreate,
        original_image: { ...validDraftCreate.original_image, capture_source: "system_generated" },
      }).success,
    ).toBe(false);
  });

  it("updates drafts partially and clears optional fields with null", () => {
    expect(RecoveryRecordDraftUpdateSchema.safeParse({ condition: "working" }).success).toBe(true);
    expect(RecoveryRecordDraftUpdateSchema.safeParse({ approximate_weight: null }).success).toBe(true);
    expect(RecoveryRecordDraftUpdateSchema.safeParse({}).success).toBe(false);
    expect(RecoveryRecordDraftUpdateSchema.safeParse({ revision: 3 }).success).toBe(false);
  });

  it("represents a server record without any QR credential", () => {
    expect(RecoveryRecordSchema.safeParse(serverRecord).success).toBe(true);
    expect(
      RecoveryRecordSchema.safeParse({
        ...validRecoveryRecord,
        qr_payload: { ...validRecoveryRecord.qr_payload, record_id: IDS.location },
      }).success,
    ).toBe(false);
  });

  it("pages records with a server cursor", () => {
    expect(
      RecoveryRecordPageSchema.safeParse({ items: [serverRecord], pagination: { next_cursor: "opaque", has_more: true } }).success,
    ).toBe(true);
    expect(RecoveryRecordPageSchema.safeParse([serverRecord]).success).toBe(false);
  });

  it("requires a flag for a duplicate-image submission", () => {
    expect(
      RecordSubmissionResponseSchema.safeParse({ outcome: "submitted", record: serverRecord, replayed: false, flag_codes: [] }).success,
    ).toBe(true);
    expect(
      RecordSubmissionResponseSchema.safeParse({ outcome: "duplicate_image", record: serverRecord, replayed: false, flag_codes: [] }).success,
    ).toBe(false);
  });
});

describe("evidence transport", () => {
  it("returns evidence metadata without the private storage reference", () => {
    expect(EvidenceMetadataSchema.safeParse(validEvidenceMetadata).success).toBe(true);
    expect(
      EvidenceMetadataSchema.safeParse({
        ...validEvidenceMetadata,
        storage_reference: { storage_provider: "local", object_key: "records/x/y" },
      }).success,
    ).toBe(false);
  });

  it("accepts only client-uploadable evidence types", () => {
    const upload = {
      evidence_type: "handoff_photo",
      captured_at: "2026-09-21T09:00:00Z",
      capture_source: "recycler_camera",
      device_instance_id: IDS.device,
      connectivity: "online",
      application_version: "0.1.0",
    };
    expect(EvidenceUploadRequestSchema.safeParse(upload).success).toBe(true);
    expect(EvidenceUploadRequestSchema.safeParse({ ...upload, evidence_type: "reviewer_decision" }).success).toBe(false);
    expect(EvidenceUploadRequestSchema.safeParse({ ...upload, capture_source: "system_generated" }).success).toBe(false);
  });
});

describe("timeline events", () => {
  const event = {
    event_schema_version: "1.0.0",
    event_id: IDS.event,
    recovery_record_id: IDS.record,
    event_type: "evidence_added",
    actor: { actor_id: IDS.recycler },
    actor_role: "recycler",
    occurred_at: "2026-09-21T09:00:00Z",
    previous_state: "awaiting_handoff",
    resulting_state: "awaiting_handoff",
    evidence_id: IDS.handoffPhoto,
  } as const;

  it("records facts without a state change", () => {
    expect(RecoveryRecordEventSchema.safeParse(event).success).toBe(true);
    expect(RecoveryRecordEventSchema.safeParse({ ...event, resulting_state: "received" }).success).toBe(false);
    expect(
      RecoveryRecordEventSchema.safeParse({ ...event, event_type: "record_handoff", resulting_state: "received" }).success,
    ).toBe(true);
  });

  it("names the actor of every user event and omits it for the system", () => {
    const { actor: _actor, ...withoutActor } = event;
    expect(RecoveryRecordEventSchema.safeParse(withoutActor).success).toBe(false);
    expect(RecoveryRecordEventSchema.safeParse({ ...withoutActor, actor_role: "system", event_type: "qr_issued" }).success).toBe(true);
    expect(RecoveryRecordEventSchema.safeParse({ ...event, actor: null }).success).toBe(false);
  });

  it("carries only shared flag codes", () => {
    const opened = { ...event, event_type: "review_opened", actor_role: "system", flag_codes: ["WEIGHT_DISCREPANCY"] };
    const { actor: _actor, evidence_id: _evidence, ...systemEvent } = opened;
    expect(RecoveryRecordEventSchema.safeParse(systemEvent).success).toBe(true);
    expect(RecoveryRecordEventSchema.safeParse({ ...systemEvent, flag_codes: ["OTHER"] }).success).toBe(false);
  });
});

describe("processing", () => {
  it("requires the processing result and aligns its length with the stored result", () => {
    expect(ProcessingRequestSchema.safeParse(validProcessingRequest).success).toBe(true);
    const { notes: _notes, ...withoutNotes } = validProcessingRequest;
    expect(ProcessingRequestSchema.safeParse(withoutNotes).success).toBe(false);
    expect(ProcessingRequestSchema.safeParse({ ...validProcessingRequest, notes: "n".repeat(1_000) }).success).toBe(true);
    expect(ProcessingRequestSchema.safeParse({ ...validProcessingRequest, notes: "n".repeat(1_001) }).success).toBe(false);
    expect(
      ProcessingInformationSchema.safeParse({
        recycler: { actor_id: IDS.recycler },
        method: "material_recovery",
        result: "n".repeat(1_000),
        material_entries: [],
        processed_at: "2026-09-22T10:00:00Z",
        evidence_ids: [IDS.completion],
      }).success,
    ).toBe(true);
  });

  it("persists editable drafts and material rows", () => {
    expect(ProcessingDraftUpdateSchema.safeParse({ processing_method: "safe_storage", notes: null }).success).toBe(true);
    expect(ProcessingDraftUpdateSchema.safeParse({}).success).toBe(false);
    expect(MaterialEntryUpdateSchema.safeParse({ weight: { value: 1, unit: "g" } }).success).toBe(true);
    expect(MaterialEntryUpdateSchema.safeParse({ weight: { value: 0, unit: "g" } }).success).toBe(false);
    expect(MaterialEntryUpdateSchema.safeParse({}).success).toBe(false);
    expect(
      ProcessingDetailSchema.safeParse({
        record_id: IDS.record,
        status: "draft",
        completion_evidence_ids: [],
        material_entries: [{ entry_id: IDS.event, material: "Copper", weight: { value: 2, unit: "kg" } }],
        total_recovered_weight_kg: 2,
        version: 1,
        updated_at: "2026-09-22T10:00:00Z",
      }).success,
    ).toBe(true);
  });
});

describe("review", () => {
  it("accepts each decision only with its own reason codes", () => {
    expect(ProgrammeReviewRequestSchema.safeParse(validReviewRequest).success).toBe(true);
    for (const [decision, reasons] of Object.entries(REASON_CODES_BY_DECISION)) {
      for (const reason_code of reasons) {
        const request = {
          ...validReviewRequest,
          decision,
          reason_code,
          ...(decision === "request_correction" ? { requested_correction: "Upload a clearer scale photograph." } : {}),
        };
        expect(ProgrammeReviewRequestSchema.safeParse(request).success).toBe(true);
      }
    }
    expect(ProgrammeReviewRequestSchema.safeParse({ ...validReviewRequest, reason_code: "EVIDENCE_INSUFFICIENT" }).success).toBe(false);
    expect(ProgrammeReviewRequestSchema.safeParse({ ...validReviewRequest, reason_code: "LOOKS_FINE" }).success).toBe(false);
  });

  it("cites case flags or a manual review as the reason for review", () => {
    expect(ProgrammeReviewRequestSchema.safeParse({ ...validReviewRequest, review_reason_codes: ["MANUAL_REVIEW"] }).success).toBe(true);
    expect(ProgrammeReviewRequestSchema.safeParse({ ...validReviewRequest, review_reason_codes: ["SUSPICIOUS"] }).success).toBe(false);
  });

  it("omits absent case fields instead of sending null", () => {
    expect(ReviewCaseSummarySchema.safeParse(validCaseSummary).success).toBe(true);
    expect(ReviewCaseSummarySchema.safeParse({ ...validCaseSummary, assigned_reviewer_id: null }).success).toBe(false);
    expect(ReviewCaseSummarySchema.safeParse({ ...validCaseSummary, flag_codes: ["UNKNOWN"] }).success).toBe(false);
  });

  it("filters the queue on the server with typed parameters", () => {
    expect(ReviewQueueFiltersSchema.parse({})).toMatchObject({ limit: 25, sort: "opened_at" });
    expect(ReviewQueueFiltersSchema.safeParse({ status: ["open"], flag_code: "WEIGHT_DISCREPANCY" }).success).toBe(true);
    expect(ReviewQueueFiltersSchema.safeParse({ status: ["not_required"] }).success).toBe(false);
    expect(ReviewQueueFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe("authentication", () => {
  it("keeps the session credential out of the sign-in body", () => {
    const user = {
      user_id: IDS.actor,
      username: "collector.demo",
      display_name: "Demonstration Collector",
      role: "collector",
      permissions: ["recovery_record:create"],
      programme_ids: [IDS.programme],
      facility_ids: [],
      receiving_location_ids: [],
      preferred_language: "en",
      actor_reference: { actor_id: IDS.actor, programme_id: IDS.programme },
    };
    expect(SessionCreatedSchema.safeParse({ expires_at: "2026-09-20T08:30:00Z", user }).success).toBe(true);
    expect(
      SessionCreatedSchema.safeParse({ expires_at: "2026-09-20T08:30:00Z", user, access_token: "secret", token_type: "Bearer" }).success,
    ).toBe(false);
  });
});

describe("shared vocabularies", () => {
  it("names one idempotency operation per command", () => {
    expect(Object.values(IDEMPOTENT_OPERATIONS)).toEqual([
      "create_record",
      "record_handoff",
      "record_processing",
      "record_review_decision",
    ]);
  });

  it("publishes every flag code", () => {
    expect(REVIEW_FLAG_CODES).toHaveLength(6);
  });

  it("registers a generated schema for every present-phase boundary", () => {
    for (const name of [
      "session_created",
      "current_user",
      "recovery_record_draft_create",
      "recovery_record_page",
      "evidence_metadata",
      "qr_credentials",
      "handoff_lookup_request",
      "handoff_lookup_response",
      "processing_detail",
      "review_case_page",
      "review_case_detail",
    ]) {
      expect(PUBLIC_SCHEMA_REGISTRY).toHaveProperty(name);
    }
  });
});
