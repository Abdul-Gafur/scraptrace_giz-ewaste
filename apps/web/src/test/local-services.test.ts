import {
  EvidenceIdSchema,
  HandoffRequestSchema,
  ProgrammeReviewRequestSchema,
  UserRoleSchema,
  type RecoveryRecord,
} from "@scraptrace/contracts";

import { createLocalServices } from "@/services/local/local-services";
import { resetProgrammeState } from "@/services/local/programme-store";
import { SEED_IDS } from "@/services/local/seed";
import type { CaptureDraftInput } from "@/services/ports/service-ports";

/**
 * The record lifecycle, exercised through the ports rather than the store, so these tests keep
 * passing when the in-browser implementation is replaced by HTTP calls.
 */

const services = createLocalServices();

const draft = (overrides: Partial<CaptureDraftInput> = {}): CaptureDraftInput => ({
  category: "televisions",
  condition: "damaged",
  itemCount: 1,
  evidenceId: EvidenceIdSchema.parse("0199a104-0000-7000-8000-000000000999"),
  areaLabel: "Kumasi North",
  countryCode: "GH",
  confirmationSource: "manual_selection",
  ...overrides,
});

const idempotency = (record: RecoveryRecord, operation: string) => ({
  idempotency_key: `${operation}-${record.record_id}`,
  request_digest: `sha256:${"0".repeat(64)}`,
  scope: { actor_id: record.collector.actor_id, operation, resource_id: record.record_id },
});

beforeEach(async () => {
  resetProgrammeState();
  await services.authentication.signIn(UserRoleSchema.enum.collector, "en");
});

describe("recovery record lifecycle", () => {
  it("creates a draft and publishes it for handoff, recording both transitions", async () => {
    const created = await services.recoveryRecords.create(draft());
    expect(created.business_state).toBe("draft");
    expect(created.category_confirmation.confirmed_category).toBe("televisions");

    const published = await services.recoveryRecords.submit(created.record_id);
    expect(published.business_state).toBe("awaiting_handoff");
    expect(published.handoff_state).toBe("awaiting");

    const events = await services.recoveryRecords.events();
    const forRecord = events.filter((event) => event.recovery_record_id === created.record_id);
    expect(forRecord.map((event) => event.event_type)).toEqual([
      "publish_for_handoff",
      "submit_record",
    ]);
  });

  it("records a mixed batch as a batch, which the contract requires", async () => {
    const created = await services.recoveryRecords.create(
      draft({ category: "mixed_scrap", approximateWeightKg: 40 }),
    );
    expect(created.record_kind).toBe("batch");
  });

  it("finds a record by its human reference and by its opaque lookup token", async () => {
    const created = await services.recoveryRecords.create(draft());
    expect((await services.recoveryRecords.lookup(created.human_reference))?.record_id).toBe(
      created.record_id,
    );
    expect(
      (await services.recoveryRecords.lookup(created.qr_payload.lookup_token))?.record_id,
    ).toBe(created.record_id);
    expect(await services.recoveryRecords.lookup("ST-NOTHING")).toBeNull();
  });
});

describe("handoff", () => {
  // Parsed through the contract, so a fixture the backend would reject fails the test here.
  const handoffRequest = (record: RecoveryRecord, measuredKg: number) =>
    HandoffRequestSchema.parse({
      recovery_record_id: record.record_id,
      lookup_token: record.qr_payload.lookup_token,
      collector_reference: record.collector,
      recycler_reference: { actor_id: SEED_IDS.recycler },
      receiving_location_id: SEED_IDS.collector,
      handoff_time: new Date().toISOString(),
      confirmed_category: record.category,
      confirmed_condition: record.condition,
      measured_weight: { value: measuredKg, unit: "kg" as const },
      final_price: { amount: 4, currency: "USD" },
      evidence_ids: [
        "0199a104-0000-7000-8000-000000000991",
        "0199a104-0000-7000-8000-000000000992",
      ],
      idempotency: idempotency(record, "record_handoff"),
    });

  it("rejects a code that does not belong to the record", async () => {
    const record = await services.recoveryRecords.create(draft());
    const response = await services.handoffs.record(
      HandoffRequestSchema.parse({
        ...handoffRequest(record, 10),
        lookup_token: "someoneelseslookuptokenthatislongenough",
      }),
    );
    expect(response.outcome).toBe("rejected");
  });

  it("accepts a first scan and reports a second as a duplicate", async () => {
    const record = await services.recoveryRecords.create(draft());
    await services.recoveryRecords.submit(record.record_id);
    const first = await services.handoffs.record(handoffRequest(record, 10));
    expect(first.outcome).toBe("accepted");

    const stored = await services.recoveryRecords.getById(record.record_id);
    expect(stored?.business_state).toBe("received");

    const second = await services.handoffs.record(handoffRequest(record, 10));
    expect(second.outcome).toBe("duplicate_scan");
  });

  it("flags a measured weight far from the reported weight for a person to judge", async () => {
    const record = await services.recoveryRecords.create(
      draft({ category: "mixed_scrap", approximateWeightKg: 40 }),
    );
    await services.recoveryRecords.submit(record.record_id);
    const response = await services.handoffs.record(handoffRequest(record, 10));
    expect(response.outcome).toBe("discrepancy");

    const stored = await services.recoveryRecords.getById(record.record_id);
    expect(stored?.review.flag_codes).toContain("WEIGHT_DISCREPANCY");
    expect(stored?.review.review_state).toBe("open");
  });
});

describe("review decisions", () => {
  it("moves an approved record to approved_and_completed and records the decision", async () => {
    const record = await services.recoveryRecords.create(draft());
    const decided = await services.reviews.decide(
      ProgrammeReviewRequestSchema.parse({
        recovery_record_id: record.record_id,
        review_reason_codes: ["EVIDENCE_COMPLETE"],
        assigned_reviewer: { actor_id: SEED_IDS.reviewer },
        evidence_considered: [record.original_image_evidence_id],
        decision: "approve",
        reason_code: "EVIDENCE_COMPLETE",
        reviewer_note: "Evidence matches the record.",
        decision_timestamp: new Date().toISOString(),
        previous_review_state: "open",
        previous_record_state: record.business_state,
        idempotency: idempotency(record, "record_review_decision"),
      }),
    );
    expect(decided.resulting_record_state).toBe("approved_and_completed");

    const stored = await services.recoveryRecords.getById(record.record_id);
    expect(stored?.review.decision).toBe("approve");
  });
});

describe("reporting", () => {
  it("counts verified weight from approved and completed records only", async () => {
    const summary = await services.reporting.summarize({ pagination: { limit: 50 } });
    const approved = (await services.recoveryRecords.list()).filter(
      (record) => record.business_state === "approved_and_completed",
    );
    const expected = approved.reduce(
      (total, record) => total + (record.handoff?.measured_weight.value ?? 0),
      0,
    );
    expect(summary.verified_weight.value).toBeCloseTo(expected, 2);
    expect(summary.verified_weight.eligible_state).toBe("approved_and_completed");
  });
});

describe("safety guidance", () => {
  it("serves an approved card in a language it is approved for", async () => {
    const response = await services.safetyGuidance.getGuidance({
      category: "televisions",
      requested_language: "fr",
      transformation_mode: "none",
      offline: false,
    });
    expect(response.outcome).toBe("approved_guidance");
  });

  it("falls back safely when no approved card covers the language", async () => {
    const response = await services.safetyGuidance.getGuidance({
      category: "mixed_scrap",
      requested_language: "ar",
      transformation_mode: "none",
      offline: false,
    });
    expect(response.outcome).toBe("safe_fallback");
    if (response.outcome === "safe_fallback") {
      expect(response.reason).toBe("no_approved_card");
      expect(response.llm_called).toBe(false);
    }
  });

  it("falls back when the category has no card at all", async () => {
    const response = await services.safetyGuidance.getGuidance({
      category: "compressors",
      requested_language: "en",
      transformation_mode: "none",
      offline: false,
    });
    expect(response.outcome).toBe("safe_fallback");
  });
});

describe("local data", () => {
  it("clears records and queued work without signing the operator out", async () => {
    await services.recoveryRecords.create(draft());
    const before = await services.device.summary();
    expect(before.draftCount).toBeGreaterThan(0);

    await services.device.clearLocalData();
    const after = await services.device.summary();
    expect(after.draftCount).toBe(0);
    expect(after.queuedMutationCount).toBe(0);
    expect(await services.authentication.getSession()).not.toBeNull();
  });
});
