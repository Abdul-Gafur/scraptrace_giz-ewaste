import { ReportingFiltersSchema, type RecoveryRecord } from "@scraptrace/contracts";

import { DEMO_ACTORS, DEMO_LOCATION_IDS } from "@/auth/actors";
import { newEvidenceId } from "@/services/domain/identifiers";
import { VERIFIED_STATE, verifiedWeightKilograms } from "@/services/domain/records";
import { createTestServices } from "@/services/local/local-services";
import type { FrontendServices } from "@/services/ports/service-ports";
import type { ScrapTraceRepository } from "@/services/local/repository";
import { ScrapTraceServiceError } from "@/services/http/http-client";

/**
 * Cross-role workflow integration.
 *
 * One repository is shared by services bound to each role, exactly as the browser shares it between
 * workspaces, so these tests exercise the same path a user drives through the screens.
 */

const image = (label: string): Blob =>
  new Blob([`integration-evidence:${label}`], { type: "image/jpeg" });

interface Harness {
  readonly repository: ScrapTraceRepository;
  readonly collector: FrontendServices;
  readonly recycler: FrontendServices;
  readonly reviewer: FrontendServices;
  readonly manager: FrontendServices;
}

const harness = (): Harness => {
  const { repository } = createTestServices({ role: "collector", seed: false });
  const bind = (role: keyof typeof DEMO_ACTORS) =>
    createTestServices({ role: DEMO_ACTORS[role].role, repository, seed: false }).services;
  return {
    repository,
    collector: bind("collector"),
    recycler: bind("recycler"),
    reviewer: bind("programme_reviewer"),
    manager: bind("programme_manager"),
  };
};

const seedConfiguration = async (services: Harness) => {
  const { seedRepository } = await import("@/services/local/seed");
  seedRepository(services.repository);
};

interface CaptureOptions {
  readonly label: string;
  readonly category?: RecoveryRecord["category"];
  readonly declaredWeightKg?: number;
  readonly destination?: string;
}

const captureAndSubmit = async (
  services: Harness,
  options: CaptureOptions,
): Promise<RecoveryRecord> => {
  const photo = image(options.label);
  const appraisal = await services.collector.vision.appraise({
    evidence_id: newEvidenceId(),
    image: photo,
    price_estimation_inputs: { condition: "damaged", item_count: 1 },
  });
  const draft = await services.collector.recoveryRecords.createDraft({
    category: options.category ?? "televisions",
    language: "en",
    condition: "damaged",
    itemCount: 1,
    ...(options.declaredWeightKg === undefined
      ? {}
      : { approximateWeight: { value: options.declaredWeightKg, unit: "kg" as const } }),
    areaLabel: "Greater Accra",
    confirmationSource:
      appraisal.outcome === "classified" &&
      appraisal.category === (options.category ?? "televisions")
        ? "accepted_prediction"
        : "manual_selection",
    image: photo,
    offline: false,
    destinationLocationId: options.destination ?? DEMO_LOCATION_IDS.recycler,
    ...(appraisal.outcome === "classified"
      ? {
          visionResult: {
            prediction_id: newEvidenceId(),
            model_name: appraisal.model_name,
            model_version: appraisal.model_version,
            inferred_at: appraisal.inferred_at,
            scores: appraisal.scores,
            suggested_category: appraisal.category,
            confidence: appraisal.confidence,
            low_confidence: false,
          },
        }
      : {}),
  });
  const submitted = await services.collector.recoveryRecords.submit(draft.record_id);
  expect(submitted.outcome).toBe("submitted");
  return submitted.record;
};

const confirmReceipt = (services: Harness, recordId: string, measuredKg: number, label: string) =>
  services.recycler.handoffs.confirmReceipt({
    recordId,
    confirmedCategory: "televisions",
    confirmedCondition: "damaged",
    measuredWeight: { value: measuredKg, unit: "kg" },
    finalPriceAmount: 42,
    receivingLocationId: DEMO_LOCATION_IDS.recycler,
    evidence: {
      handoffPhoto: image(`${label}-handoff`),
      weightPhoto: image(`${label}-weight`),
      scannedPayload: "scanned",
      notes: "Received at the intake bay.",
    },
    offline: false,
  });

const recordProcessing = (services: Harness, recordId: string, label: string, kg = 5) =>
  services.recycler.processing.submitProcessing({
    recordId,
    method: "material_recovery",
    materialEntries: [{ material: "Steel", weight: { value: kg, unit: "kg" } }],
    processedAt: "2026-09-26T10:00:00.000Z",
    notes: "Material recovery recorded.",
    completionEvidence: image(`${label}-processing`),
    offline: false,
  });

const reportFilters = () => ReportingFiltersSchema.parse({ pagination: { limit: 100 } });

describe("scenario A: a successful recovery from capture to programme report", () => {
  it("moves one record through every role and into the verified totals", async () => {
    const services = harness();
    await seedConfiguration(services);

    const record = await captureAndSubmit(services, { label: "A", declaredWeightKg: 20 });
    expect(record.business_state).toBe("awaiting_handoff");
    expect(record.qr_payload.record_id).toBe(record.record_id);
    expect(record.human_reference).toMatch(/^ST-[A-Z0-9]{8,16}$/);

    // The recycler resolves the same record from the QR text the collector presents.
    const scanned = `SCRAPTRACE:1.0.0:${record.record_id}:${record.qr_payload.lookup_token}`;
    const lookup = await services.recycler.recoveryRecords.lookupForHandoff(scanned);
    expect(lookup.outcome).toBe("ready");
    if (lookup.outcome !== "ready") throw new Error("lookup did not succeed");
    expect(lookup.record.record_id).toBe(record.record_id);

    const handoff = await confirmReceipt(services, record.record_id, 21, "A");
    expect(handoff.outcome).toBe("accepted");

    const received = services.repository.findRecord(record.record_id);
    expect(received?.business_state).toBe("received");
    expect(received?.handoff?.measured_weight).toEqual({ value: 21, unit: "kg" });
    expect(received?.review.flag_codes).toEqual([]);

    const processing = await recordProcessing(services, record.record_id, "A");
    expect(processing.outcome).toBe("processing_recorded");

    const completed = services.repository.findRecord(record.record_id);
    expect(completed?.business_state).toBe(VERIFIED_STATE);
    expect(completed?.processing_state).toBe("completed");
    expect(completed?.integrity_digest).toMatch(/^sha256:[0-9a-f]{64}$/);

    // The identifier is the same one throughout; no role created a parallel record.
    expect(services.repository.listRecords().map((item) => item.record_id)).toEqual([
      record.record_id,
    ]);

    const events = services.repository
      .listEvents(record.record_id)
      .map((event) => event.event_type);
    expect(events).toEqual([
      "submit_record",
      "publish_for_handoff",
      "record_handoff",
      "record_processing",
      "mark_processing_complete",
      "approve_unflagged_completion",
    ]);

    const summary = await services.manager.reporting.summarize(reportFilters());
    expect(summary.record_counts_by_state.approved_and_completed).toBe(1);
    expect(summary.verified_weight.value).toBeCloseTo(21, 3);
    expect(summary.verified_weight.eligible_state).toBe("approved_and_completed");

    const exported = await services.manager.dataExports.build(reportFilters());
    expect(exported.rowCount).toBe(1);
    expect(exported.content).toContain(record.human_reference);
    expect(exported.content).toContain("approved_and_completed");
    expect(exported.filename).toMatch(/^scraptrace-.*-records-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe("scenario B: a weight discrepancy that a reviewer approves", () => {
  it("flags the record, sends it to review, and counts it once approved", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "B", declaredWeightKg: 20 });

    const handoff = await confirmReceipt(services, record.record_id, 40, "B");
    expect(handoff.outcome).toBe("discrepancy");
    if (handoff.outcome !== "discrepancy") throw new Error("expected a discrepancy");
    expect(handoff.flag_codes).toContain("WEIGHT_DISCREPANCY");

    const flagged = services.repository.findRecord(record.record_id);
    expect(flagged?.handoff_state).toBe("disputed");
    expect(flagged?.review.review_state).toBe("open");

    const processing = await recordProcessing(services, record.record_id, "B");
    expect(processing.outcome).toBe("review_required");

    const underReview = services.repository.findRecord(record.record_id);
    expect(underReview?.business_state).toBe("under_review");

    // A flagged record contributes nothing to verified recovery while it waits.
    const before = await services.manager.reporting.summarize(reportFilters());
    expect(before.verified_weight.value).toBe(0);

    const queue = await services.reviewer.reviews.listQueue();
    expect(queue.map((item) => item.record_id)).toContain(record.record_id);

    const evidence = await services.reviewer.recoveryRecords.listEvidence(record.record_id);
    expect(evidence.map((item) => item.evidence_type).sort()).toEqual([
      "handoff_photo",
      "handoff_qr_scan",
      "original_item_photo",
      "processing_completion",
      "recycler_receipt",
      "weight_measurement",
    ]);

    const decision = await services.reviewer.reviews.submitDecision({
      recordId: record.record_id,
      decision: "approve",
      reasonCode: "WEIGHT_EXPLAINED",
      reviewerNote: "The scale photograph matches the recorded weight; the declaration was low.",
    });
    expect(decision.resulting_record_state).toBe(VERIFIED_STATE);
    expect(decision.resulting_review_state).toBe("approved");

    const approved = services.repository.findRecord(record.record_id);
    expect(approved?.business_state).toBe(VERIFIED_STATE);
    expect(approved?.review.decision).toBe("approve");
    expect(approved?.review.reason_code).toBe("WEIGHT_EXPLAINED");

    const after = await services.manager.reporting.summarize(reportFilters());
    expect(after.verified_weight.value).toBeCloseTo(40, 3);

    // The decided record has left the queue.
    const remaining = await services.reviewer.reviews.listQueue();
    expect(remaining.map((item) => item.record_id)).not.toContain(record.record_id);
  });
});

describe("scenario C: a rejection and a correction request", () => {
  it("excludes a rejected record from verified totals and makes it read-only", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "C", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 45, "C");
    await recordProcessing(services, record.record_id, "C");

    const decision = await services.reviewer.reviews.submitDecision({
      recordId: record.record_id,
      decision: "reject",
      reasonCode: "WEIGHT_UNEXPLAINED",
      reviewerNote: "The scale photograph shows a different item.",
    });
    expect(decision.resulting_record_state).toBe("rejected");

    const summary = await services.manager.reporting.summarize(reportFilters());
    expect(summary.record_counts_by_state.rejected).toBe(1);
    expect(summary.verified_weight.value).toBe(0);

    // A decided record cannot be decided again or edited.
    await expect(
      services.reviewer.reviews.submitDecision({
        recordId: record.record_id,
        decision: "approve",
        reasonCode: "EVIDENCE_SUFFICIENT",
        reviewerNote: "Changing my mind.",
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);

    const stillRejected = services.repository.findRecord(record.record_id);
    expect(stillRejected?.business_state).toBe("rejected");
    expect(stillRejected?.review.decision).toBe("reject");
  });

  it("keeps a record under review after a correction request, then allows a later decision", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "C2", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 45, "C2");
    await recordProcessing(services, record.record_id, "C2");

    const requested = await services.reviewer.reviews.submitDecision({
      recordId: record.record_id,
      decision: "request_correction",
      reasonCode: "ADDITIONAL_EVIDENCE_REQUIRED",
      reviewerNote: "The scale reading is not legible.",
      requestedCorrection: "Supply a clear photograph of the scale display.",
    });
    expect(requested.resulting_record_state).toBe("under_review");
    expect(requested.resulting_review_state).toBe("awaiting_information");

    const awaiting = services.repository.findRecord(record.record_id);
    expect(awaiting?.review.requested_correction).toContain("scale display");
    // The flags that caused the review are kept, so the reason stays readable.
    expect(awaiting?.review.flag_codes).toContain("WEIGHT_DISCREPANCY");

    const summary = await services.manager.reporting.summarize(reportFilters());
    expect(summary.verified_weight.value).toBe(0);

    const approved = await services.reviewer.reviews.submitDecision({
      recordId: record.record_id,
      decision: "approve",
      reasonCode: "WEIGHT_EXPLAINED",
      reviewerNote: "A legible scale photograph was supplied out of band.",
    });
    expect(approved.resulting_record_state).toBe(VERIFIED_STATE);
  });

  it("requires a reviewer note, and a correction description for a correction request", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "C3", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 45, "C3");
    await recordProcessing(services, record.record_id, "C3");

    await expect(
      services.reviewer.reviews.submitDecision({
        recordId: record.record_id,
        decision: "approve",
        reasonCode: "EVIDENCE_SUFFICIENT",
        reviewerNote: "   ",
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);

    await expect(
      services.reviewer.reviews.submitDecision({
        recordId: record.record_id,
        decision: "request_correction",
        reasonCode: "ADDITIONAL_EVIDENCE_REQUIRED",
        reviewerNote: "Needs more.",
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });
});

describe("duplicate scans and repeated submissions", () => {
  it("returns the first receipt instead of recording a second handoff", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "D", declaredWeightKg: 20 });

    const first = await confirmReceipt(services, record.record_id, 21, "D");
    expect(first.outcome).toBe("accepted");
    const receivedAt = services.repository.findRecord(record.record_id)?.handoff
      ?.server_received_at;

    // The same confirmation sent again is one logical mutation: the first result is replayed.
    const second = await confirmReceipt(services, record.record_id, 21, "D");
    expect(second.outcome).toBe("accepted");
    if (second.outcome === "accepted") expect(second.replayed).toBe(true);

    // Exactly one handoff and one receipt event exist.
    const handoffEvents = services.repository
      .listEvents(record.record_id)
      .filter((event) => event.event_type === "record_handoff");
    expect(handoffEvents).toHaveLength(1);
    expect(services.repository.findRecord(record.record_id)?.handoff?.server_received_at).toBe(
      receivedAt,
    );
  });

  it("reports a duplicate scan with the original receipt time when the code is scanned again", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "D2", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 21, "D2");

    const scanned = `SCRAPTRACE:1.0.0:${record.record_id}:${record.qr_payload.lookup_token}`;
    const lookup = await services.recycler.recoveryRecords.lookupForHandoff(scanned);
    expect(lookup.outcome).toBe("already_received");
    if (lookup.outcome !== "already_received") throw new Error("expected already_received");
    expect(lookup.receivedAt).toBe(
      services.repository.findRecord(record.record_id)?.handoff?.server_received_at,
    );
  });

  it("treats a repeated submission of the same draft as one logical mutation", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "D3" });

    const again = await services.collector.recoveryRecords.submit(record.record_id);
    expect(again.outcome).toBe("submitted");
    if (again.outcome === "submitted") expect(again.replayed).toBe(true);
    expect(services.repository.listRecords()).toHaveLength(1);
    expect(
      services.repository
        .listEvents(record.record_id)
        .filter((event) => event.event_type === "submit_record"),
    ).toHaveLength(1);
  });

  it("flags reuse of identical photograph content across records rather than approving it", async () => {
    const services = harness();
    await seedConfiguration(services);
    await captureAndSubmit(services, { label: "same-image" });

    const photo = image("same-image");
    const draft = await services.collector.recoveryRecords.createDraft({
      category: "televisions",
      language: "en",
      condition: "damaged",
      itemCount: 1,
      areaLabel: "Greater Accra",
      confirmationSource: "manual_selection",
      image: photo,
      offline: false,
    });
    const submitted = await services.collector.recoveryRecords.submit(draft.record_id);
    expect(submitted.outcome).toBe("duplicate_image");
    if (submitted.outcome !== "duplicate_image") throw new Error("expected a duplicate flag");
    expect(submitted.flagCodes).toEqual(["DUPLICATE_EVIDENCE_DIGEST"]);
    // The record still published: a flag never silently blocks the journey.
    expect(submitted.record.business_state).toBe("awaiting_handoff");
  });
});

describe("lookup states", () => {
  it("reports a code that matches no record without revealing anything", async () => {
    const services = harness();
    await seedConfiguration(services);
    expect(await services.recycler.recoveryRecords.lookupForHandoff("ST-NOTHING1")).toEqual({
      outcome: "not_found",
    });
  });

  it("reports an unsupported contract version in the scanned payload", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "V" });
    const result = await services.recycler.recoveryRecords.lookupForHandoff(
      `SCRAPTRACE:9.9.9:${record.record_id}:${record.qr_payload.lookup_token}`,
    );
    expect(result).toEqual({ outcome: "unsupported_contract_version" });
  });

  it("reports a record that has not been published for handoff", async () => {
    const services = harness();
    await seedConfiguration(services);
    const draft = await services.collector.recoveryRecords.createDraft({
      category: "televisions",
      language: "en",
      condition: "damaged",
      itemCount: 1,
      areaLabel: "Greater Accra",
      confirmationSource: "manual_selection",
      image: image("draft-only"),
      offline: false,
    });
    const result = await services.recycler.recoveryRecords.lookupForHandoff(draft.human_reference);
    expect(result.outcome).toBe("not_ready");
  });

  it("resolves a typed transfer code case-insensitively", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "T" });
    const result = await services.recycler.recoveryRecords.lookupForHandoff(
      record.human_reference.toLowerCase(),
    );
    expect(result.outcome).toBe("ready");
  });

  it("refuses a record destined for a facility this account is not assigned to", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, {
      label: "F",
      destination: DEMO_LOCATION_IDS.collectionCentre,
    });
    // Rewrite the destination to a location outside the demonstration facility.
    services.repository.putRecord({
      ...record,
      destination: {
        location_id: "0199b099-0099-7099-8099-000000000099",
        facility_type: "recycler",
        verification_status: "programme_verified",
        selected_at: record.created_at,
      },
    });
    const result = await services.recycler.recoveryRecords.lookupForHandoff(record.human_reference);
    expect(result.outcome).toBe("other_facility");
  });
});

describe("processing validation and terminal records", () => {
  it("refuses processing before a handoff has been received", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "P" });
    const result = await recordProcessing(services, record.record_id, "P");
    expect(result.outcome).toBe("rejected");
    if (result.outcome === "rejected") expect(result.error_code).toBe("INVALID_STATE_TRANSITION");
  });

  it("rejects material rows with a missing name or a non-positive weight", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "P2", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 21, "P2");

    await expect(
      services.recycler.processing.submitProcessing({
        recordId: record.record_id,
        method: "material_recovery",
        materialEntries: [{ material: "  ", weight: { value: 1, unit: "kg" } }],
        processedAt: "2026-09-26T10:00:00.000Z",
        notes: "Recorded.",
        completionEvidence: image("P2-processing"),
        offline: false,
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);

    await expect(
      services.recycler.processing.submitProcessing({
        recordId: record.record_id,
        method: "material_recovery",
        materialEntries: [{ material: "Steel", weight: { value: 0, unit: "kg" } }],
        processedAt: "2026-09-26T10:00:00.000Z",
        notes: "Recorded.",
        completionEvidence: image("P2-processing"),
        offline: false,
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });

  it("flags recovered material heavier than the received item and sends it to review", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "P3", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 21, "P3");
    const result = await recordProcessing(services, record.record_id, "P3", 50);
    expect(result.outcome).toBe("review_required");
    if (result.outcome === "review_required") {
      expect(result.flag_codes).toContain("PROCESSED_WEIGHT_ABOVE_RECEIVED");
    }
  });

  it("refuses to edit a record that already holds a final decision", async () => {
    const services = harness();
    await seedConfiguration(services);
    const record = await captureAndSubmit(services, { label: "P4", declaredWeightKg: 20 });
    await confirmReceipt(services, record.record_id, 21, "P4");
    await recordProcessing(services, record.record_id, "P4");
    expect(services.repository.findRecord(record.record_id)?.business_state).toBe(VERIFIED_STATE);

    await expect(
      services.recycler.processing.submitProcessing({
        recordId: record.record_id,
        method: "safe_storage",
        materialEntries: [],
        processedAt: "2026-09-26T12:00:00.000Z",
        notes: "Trying to edit a decided record.",
        completionEvidence: image("P4-again"),
        offline: false,
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });
});

describe("manager reporting reflects what other roles did", () => {
  it("recomputes totals as records move, and filters change the export", async () => {
    const services = harness();
    await seedConfiguration(services);

    const approved = await captureAndSubmit(services, { label: "R1", declaredWeightKg: 10 });
    const rejected = await captureAndSubmit(services, {
      label: "R2",
      category: "microwaves",
      declaredWeightKg: 10,
    });

    await confirmReceipt(services, approved.record_id, 10.5, "R1");
    await recordProcessing(services, approved.record_id, "R1");

    await confirmReceipt(services, rejected.record_id, 30, "R2");
    await recordProcessing(services, rejected.record_id, "R2");
    await services.reviewer.reviews.submitDecision({
      recordId: rejected.record_id,
      decision: "reject",
      reasonCode: "WEIGHT_UNEXPLAINED",
      reviewerNote: "Unexplained.",
    });

    const summary = await services.manager.reporting.summarize(reportFilters());
    expect(summary.record_counts_by_state.approved_and_completed).toBe(1);
    expect(summary.record_counts_by_state.rejected).toBe(1);
    expect(summary.verified_weight.value).toBeCloseTo(10.5, 3);
    expect(verifiedWeightKilograms(services.repository.listRecords())).toBeCloseTo(10.5, 3);

    const televisionsOnly = ReportingFiltersSchema.parse({
      categories: ["televisions"],
      pagination: { limit: 100 },
    });
    const filtered = await services.manager.dataExports.build(televisionsOnly);
    expect(filtered.rowCount).toBe(1);
    expect(filtered.content).toContain(approved.human_reference);
    expect(filtered.content).not.toContain(rejected.human_reference);

    const everything = await services.manager.dataExports.build(reportFilters());
    expect(everything.rowCount).toBe(2);

    // The export carries no collector identifier.
    expect(everything.content).not.toContain(DEMO_ACTORS.collector.actorId);
    expect(everything.columnHeadings).toEqual([
      "record_reference",
      "lifecycle_state",
      "review_state",
      "category",
      "record_kind",
      "condition",
      "item_count",
      "captured_at_utc",
      "coarse_area",
      "country_code",
      "declared_weight_kg",
      "received_weight_kg",
      "receiving_location",
      "recovered_material_kg",
      "processing_method",
      "review_flags",
      "review_decision",
      "review_reason_code",
      "decided_at_utc",
      "counts_towards_verified_weight",
    ]);
  });

  it("paginates the report rows without losing the total", async () => {
    const services = harness();
    await seedConfiguration(services);
    for (const label of ["P-a", "P-b", "P-c"]) {
      await captureAndSubmit(services, { label });
    }
    const firstPage = await services.manager.reporting.listForReport(
      ReportingFiltersSchema.parse({ pagination: { limit: 2 } }),
    );
    expect(firstPage.records).toHaveLength(2);
    expect(firstPage.total).toBe(3);

    const secondPage = await services.manager.reporting.listForReport(
      ReportingFiltersSchema.parse({ pagination: { cursor: "2", limit: 2 } }),
    );
    expect(secondPage.records).toHaveLength(1);
    expect(secondPage.total).toBe(3);
  });
});
