import {
  ReportingFiltersSchema,
  UserRoleSchema,
  type RecoveryRecordState,
  type UserRole,
} from "@scraptrace/contracts";

import { DEMO_ACTORS, DEMO_LOCATION_IDS, OTHER_FACILITY_ID } from "@/auth/actors";
import { todayCalendarDate, toCalendarDate, addDays } from "@/services/domain/time";
import { ScrapTraceServiceError } from "@/services/http/http-client";
import { createTestServices } from "@/services/local/local-services";
import { ensureSeeded, seedRepository } from "@/services/local/seed";
import type { FrontendServices } from "@/services/ports/service-ports";
import type { ScrapTraceRepository } from "@/services/local/repository";

/**
 * Scenario E: authorization.
 *
 * Every assertion calls a service directly, not a screen. Hiding a control is a usability aid; these
 * tests prove the call itself is refused, which is what the requirement asks for.
 */

const image = (label: string): Blob => new Blob([`authorization:${label}`], { type: "image/jpeg" });

let repository: ScrapTraceRepository;
const services = {} as Record<UserRole, FrontendServices>;

const expectDenied = async (call: () => Promise<unknown>) => {
  await expect(call()).rejects.toBeInstanceOf(ScrapTraceServiceError);
  try {
    await call();
    throw new Error("the call was not refused");
  } catch (error) {
    expect(error).toBeInstanceOf(ScrapTraceServiceError);
    expect((error as ScrapTraceServiceError).envelope.error.code).toBe("PERMISSION_DENIED");
    // A refusal must not leak record content.
    expect((error as ScrapTraceServiceError).envelope.error.message.length).toBeLessThan(200);
  }
};

beforeAll(async () => {
  const created = createTestServices({ role: "collector", seed: false });
  repository = created.repository;
  seedRepository(repository);
  await ensureSeeded(repository);
  for (const role of UserRoleSchema.options) {
    services[role] = createTestServices({ role, repository, seed: false }).services;
  }
});

const underReviewId = () =>
  repository.listRecords().find((record) => record.business_state === "under_review")?.record_id ??
  "";
const awaitingHandoffId = () =>
  repository.listRecords().find((record) => record.business_state === "awaiting_handoff")
    ?.record_id ?? "";
const receivedId = () =>
  repository.listRecords().find((record) => record.business_state === "received")?.record_id ?? "";

const handoffInput = (recordId: string) => ({
  recordId,
  confirmedCategory: "televisions" as const,
  confirmedCondition: "damaged" as const,
  measuredWeight: { value: 10, unit: "kg" as const },
  finalPriceAmount: 1,
  finalPriceCurrency: "GHS",
  receivingLocationId: DEMO_LOCATION_IDS.recycler,
  evidence: {
    handoffPhoto: image("handoff"),
    weightPhoto: image("weight"),
    scannedPayload: "scanned",
  },
  offline: false,
});

const processingInput = (recordId: string) => ({
  recordId,
  method: "material_recovery" as const,
  materialEntries: [{ material: "Steel", weight: { value: 1, unit: "kg" as const } }],
  processedAt: "2026-09-26T10:00:00.000Z",
  notes: "Recorded.",
  completionEvidence: image("processing"),
  offline: false,
});

const decisionInput = (recordId: string) => ({
  recordId,
  decision: "approve" as const,
  reasonCode: "EVIDENCE_SUFFICIENT",
  reviewerNote: "Looks fine to me.",
});

const captureInput = () => ({
  category: "televisions" as const,
  language: "en" as const,
  condition: "damaged" as const,
  itemCount: 1,
  areaLabel: "Greater Accra",
  confirmationSource: "manual_selection" as const,
  image: image("capture"),
  offline: false,
});

const settingsInput = () => ({
  programme_name: "Renamed by the wrong role",
  currency: "GHS",
  country_code: "GH",
  weight_discrepancy_threshold_percentage: 50,
  supported_languages: ["en"] as ("en" | "fr" | "ar" | "pt")[],
  show_unverified_facilities: false,
  default_report_period_days: 7,
  default_report_states: [] as RecoveryRecordState[],
});

const cardInput = () => ({
  category: "televisions" as const,
  language: "en" as const,
  answers: {
    what_is_it: "a",
    possible_dangers: "b",
    prohibited_actions: "c",
    safe_actions_now: "d",
    suitable_destination: "e",
  },
  sources: [{ label: "Source", reference: "Reference" }],
  aiAssisted: false,
});

describe("a collector is denied every other role's action", () => {
  it("cannot record a handoff, record processing, decide a review, report, export, manage content or change the model", async () => {
    const collector = services.collector;
    await expectDenied(() => collector.handoffs.confirmReceipt(handoffInput(awaitingHandoffId())));
    await expectDenied(() => collector.processing.submitProcessing(processingInput(receivedId())));
    await expectDenied(() => collector.reviews.submitDecision(decisionInput(underReviewId())));
    await expectDenied(() => collector.reviews.listQueue());
    await expectDenied(() =>
      collector.reporting.summarize(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() =>
      collector.dataExports.build(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() => collector.safetyContent.list());
    await expectDenied(() => collector.safetyContent.createDraft(cardInput()));
    await expectDenied(() => collector.modelAdministration.listFeedback());
    await expectDenied(() => collector.programmeSettings.save(settingsInput()));
  });

  it("cannot read a record it does not own", async () => {
    const other = repository.listRecords()[0];
    repository.putRecord({
      ...(other as NonNullable<typeof other>),
      collector: { actor_id: DEMO_ACTORS.recycler.actorId },
    });
    await expectDenied(() => services.collector.recoveryRecords.getById(other?.record_id ?? ""));
    // Put it back so the rest of the suite sees the seeded owner.
    repository.putRecord(other);
  });
});

describe("a recycler is denied the reviewer's, manager's and administrators' actions", () => {
  it("cannot decide a review, report, export, manage safety content or change the model", async () => {
    const recycler = services.recycler;
    await expectDenied(() => recycler.reviews.submitDecision(decisionInput(underReviewId())));
    await expectDenied(() => recycler.reviews.listQueue());
    await expectDenied(() =>
      recycler.reporting.summarize(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() =>
      recycler.dataExports.build(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() => recycler.safetyContent.list());
    await expectDenied(() =>
      recycler.modelAdministration.saveConfiguration({
        active_model_version: "0.1.0",
        confidence_threshold: 0.9,
        low_confidence_routing: "manual_confirmation",
        manual_review_categories: [],
      }),
    );
    await expectDenied(() => recycler.programmeSettings.save(settingsInput()));
  });

  it("cannot create a collector record", async () => {
    await expectDenied(() => services.recycler.recoveryRecords.createDraft(captureInput()));
  });

  it("cannot receive a record destined for a facility it is not assigned to", async () => {
    const record = repository
      .listRecords()
      .find((candidate) => candidate.business_state === "awaiting_handoff");
    expect(record).toBeDefined();
    await expectDenied(() =>
      services.recycler.handoffs.confirmReceipt({
        ...handoffInput(record?.record_id ?? ""),
        receivingLocationId: OTHER_FACILITY_ID,
      }),
    );
  });
});

describe("a reviewer is denied the recycler's, manager's and administrators' actions", () => {
  it("cannot record a handoff or processing, export, manage content or change the model", async () => {
    const reviewer = services.programme_reviewer;
    await expectDenied(() => reviewer.handoffs.confirmReceipt(handoffInput(awaitingHandoffId())));
    await expectDenied(() => reviewer.processing.submitProcessing(processingInput(receivedId())));
    await expectDenied(() =>
      reviewer.dataExports.build(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() => reviewer.safetyContent.createDraft(cardInput()));
    await expectDenied(() => reviewer.modelAdministration.listFeedback());
    await expectDenied(() => reviewer.programmeSettings.save(settingsInput()));
    await expectDenied(() => reviewer.recoveryRecords.createDraft(captureInput()));
  });
});

describe("a manager is denied the operational and administrative actions", () => {
  it("cannot record a handoff or processing, decide a review, manage content or change the model", async () => {
    const manager = services.programme_manager;
    await expectDenied(() => manager.handoffs.confirmReceipt(handoffInput(awaitingHandoffId())));
    await expectDenied(() => manager.processing.submitProcessing(processingInput(receivedId())));
    await expectDenied(() => manager.reviews.submitDecision(decisionInput(underReviewId())));
    await expectDenied(() => manager.reviews.listQueue());
    await expectDenied(() => manager.safetyContent.createDraft(cardInput()));
    await expectDenied(() => manager.modelAdministration.listFeedback());
    await expectDenied(() => manager.recoveryRecords.createDraft(captureInput()));
  });

  it("may report, export and change programme settings", async () => {
    const manager = services.programme_manager;
    const filters = ReportingFiltersSchema.parse({ pagination: { limit: 10 } });
    await expect(manager.reporting.summarize(filters)).resolves.toBeTruthy();
    await expect(manager.dataExports.build(filters)).resolves.toBeTruthy();
    const saved = await manager.programmeSettings.save({
      ...settingsInput(),
      programme_name: "ScrapTrace Demonstration Programme",
      weight_discrepancy_threshold_percentage: 15,
      supported_languages: ["en", "fr", "ar", "pt"],
      show_unverified_facilities: true,
      default_report_period_days: 30,
    });
    expect(saved.updated_by).toBe(DEMO_ACTORS.programme_manager.actorId);
  });
});

describe("a safety administrator is denied everything outside safety content", () => {
  it("cannot touch records, reviews, reports or the model", async () => {
    const safety = services.safety_content_administrator;
    await expectDenied(() => safety.recoveryRecords.listOperational());
    await expectDenied(() => safety.recoveryRecords.createDraft(captureInput()));
    await expectDenied(() => safety.handoffs.confirmReceipt(handoffInput(awaitingHandoffId())));
    await expectDenied(() => safety.reviews.submitDecision(decisionInput(underReviewId())));
    await expectDenied(() =>
      safety.reporting.summarize(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() => safety.modelAdministration.listFeedback());
    await expectDenied(() => safety.programmeSettings.save(settingsInput()));
  });

  it("may manage safety content", async () => {
    const safety = services.safety_content_administrator;
    await expect(safety.safetyContent.list()).resolves.toBeTruthy();
    const draft = await safety.safetyContent.createDraft({ ...cardInput(), language: "pt" });
    await expect(
      safety.safetyContent.approve({
        cardId: draft.card_id,
        approvedBy: "Panel",
        approvalDate: todayCalendarDate(),
        reviewDate: toCalendarDate(addDays(Date.now(), 90)),
      }),
    ).resolves.toBeTruthy();
  });
});

describe("a model reviewer is denied everything outside model administration", () => {
  it("cannot touch records, reviews, reports or safety content", async () => {
    const model = services.data_ml_reviewer;
    await expectDenied(() => model.recoveryRecords.listOperational());
    await expectDenied(() => model.recoveryRecords.createDraft(captureInput()));
    await expectDenied(() => model.handoffs.confirmReceipt(handoffInput(awaitingHandoffId())));
    await expectDenied(() => model.reviews.submitDecision(decisionInput(underReviewId())));
    await expectDenied(() =>
      model.reporting.summarize(ReportingFiltersSchema.parse({ pagination: { limit: 10 } })),
    );
    await expectDenied(() => model.safetyContent.createDraft(cardInput()));
    await expectDenied(() => model.programmeSettings.save(settingsInput()));
  });

  it("may read the registry and record a feedback decision", async () => {
    const model = services.data_ml_reviewer;
    await expect(model.modelAdministration.listRegistry()).resolves.toBeTruthy();
    const stored = (await model.modelAdministration.listFeedback()).find(
      (item) => item.feedback_state === "stored_for_review",
    );
    await expect(
      model.modelAdministration.decideFeedback(
        stored?.feedback_id ?? "",
        "approved_for_training_dataset",
      ),
    ).resolves.toBeTruthy();
  });
});

describe("a refused call changes nothing", () => {
  it("leaves the record and its history untouched", async () => {
    const before = repository
      .listRecords()
      .find((record) => record.business_state === "under_review");
    const eventsBefore = repository.listEvents(before?.record_id ?? "").length;
    await expectDenied(() =>
      services.recycler.reviews.submitDecision(decisionInput(before?.record_id ?? "")),
    );
    const after = repository.findRecord(before?.record_id ?? "");
    expect(after?.business_state).toBe("under_review");
    expect(after?.revision).toBe(before?.revision);
    expect(after?.review.decision).toBeUndefined();
    expect(repository.listEvents(before?.record_id ?? "")).toHaveLength(eventsBefore);
  });

  it("leaves the programme settings untouched", async () => {
    const before = await services.programme_manager.programmeSettings.get();
    await expectDenied(() => services.collector.programmeSettings.save(settingsInput()));
    expect(await services.programme_manager.programmeSettings.get()).toEqual(before);
  });
});
