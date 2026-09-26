import {
  CONTRACT_SCHEMA_VERSION,
  HandoffRequestSchema,
  HandoffResponseSchema,
  LocationSearchRequestSchema,
  LocationSearchResponseSchema,
  ProcessingRequestSchema,
  ProcessingResponseSchema,
  ProgrammeReviewRequestSchema,
  ProgrammeReviewResponseSchema,
  RecoveryRecordSchema,
  ReportingFiltersSchema,
  ReportingSummarySchema,
  SafetyGuidanceRequestSchema,
  SafetyGuidanceResponseSchema,
  SyncBatchRequestSchema,
  SyncBatchResponseSchema,
  UserRoleSchema,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
  type UserRole,
} from "@scraptrace/contracts";

import type { FrontendServices } from "@/services/ports/service-ports";

import {
  createRecoveryRecordFixture,
  FIXTURE_IDS,
  FIXTURE_TIMESTAMP,
} from "./deterministic-fixtures";

export type MockFailure =
  | "none"
  | "authentication"
  | "recovery-records"
  | "vision"
  | "safety"
  | "locations"
  | "handoff"
  | "processing"
  | "review"
  | "reporting"
  | "synchronization";

interface MockServiceOptions {
  failure?: MockFailure;
  role?: UserRole;
  delayMilliseconds?: number;
}

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const scores = [
  { category: "refrigerators", score: 0.03 },
  { category: "laptops_and_desktop_computers", score: 0.04 },
  { category: "televisions", score: 0.8 },
  { category: "microwaves", score: 0.03 },
  { category: "air_conditioners", score: 0.04 },
  { category: "compressors", score: 0.03 },
  { category: "mixed_scrap", score: 0.03 },
];

export const createMockServices = ({
  failure = "none",
  role = UserRoleSchema.enum.collector,
  delayMilliseconds = 20,
}: MockServiceOptions = {}): FrontendServices => {
  const wait = () => pause(delayMilliseconds);
  const fail = (service: MockFailure): never => {
    throw new Error(`Mock ${service} failure`);
  };

  return {
    authentication: {
      async getSession() {
        await wait();
        if (failure === "authentication") return null;
        return {
          actorId: FIXTURE_IDS.actor,
          role,
          preferredLanguage: "en",
          displayLabel: "Development user",
          developmentOnly: true,
        };
      },
      async signIn(signedInRole) {
        await wait();
        return {
          actorId: FIXTURE_IDS.actor,
          role: signedInRole,
          preferredLanguage: "en",
          displayLabel: "Development user",
          developmentOnly: true,
        };
      },
      async signOut() {
        await wait();
      },
    },
    recoveryRecords: {
      async list() {
        await wait();
        if (failure === "recovery-records") fail(failure);
        return [createRecoveryRecordFixture()];
      },
      async lookup(code) {
        await wait();
        const record = createRecoveryRecordFixture();
        return record.human_reference === code ? record : null;
      },
      async create() {
        await wait();
        if (failure === "recovery-records") fail(failure);
        return createRecoveryRecordFixture();
      },
      async submit() {
        await wait();
        if (failure === "recovery-records") fail(failure);
        return createRecoveryRecordFixture();
      },
      async events() {
        await wait();
        return [];
      },
      async listOwn() {
        await wait();
        if (failure === "recovery-records") fail(failure);
        return [createRecoveryRecordFixture()];
      },
      async getById(recordId) {
        await wait();
        if (failure === "recovery-records") fail(failure);
        const record = createRecoveryRecordFixture();
        return record.record_id === recordId ? record : null;
      },
      async saveDraft(record) {
        await wait();
        if (failure === "recovery-records") fail(failure);
        return RecoveryRecordSchema.parse(record);
      },
    },
    evidence: {
      async store() {
        await wait();
        return FIXTURE_IDS.evidence;
      },
      async read() {
        await wait();
        return null;
      },
    },
    prices: {
      async estimate(input) {
        await wait();
        return {
          category: input.category,
          condition: input.condition,
          minimum_amount: 1,
          maximum_amount: 2,
          currency: "USD",
          basis: "Demonstration reference rate.",
          source: "ScrapTrace demonstration reference rates",
          effective_date: FIXTURE_TIMESTAMP.slice(0, 10),
          disclaimer: "Indicative range for planning only. It is not an offer.",
          ...(input.category === "mixed_scrap"
            ? { approximate_weight: { value: input.approximateWeightKg ?? 1, unit: "kg" as const } }
            : {}),
        };
      },
    },
    safetyContent: {
      async listCards() {
        await wait();
        return [];
      },
      async createCard(input) {
        await wait();
        return {
          id: FIXTURE_IDS.card,
          title: input.title,
          category: input.category,
          version: "0.1.0",
          status: "inReview",
          author: input.author,
          languages: {},
        };
      },
      async approve(cardId, approver) {
        await wait();
        return {
          id: cardId,
          category: "televisions",
          version: "1.0.0",
          status: "approved",
          author: "SC-01",
          approvedBy: approver,
          languages: {},
        };
      },
      async requestChanges(cardId) {
        await wait();
        return {
          id: cardId,
          category: "televisions",
          version: "1.0.0",
          status: "draft",
          author: "SC-01",
          languages: {},
        };
      },
      async requestTranslationReview(cardId, requestedLanguage) {
        await wait();
        return {
          id: cardId,
          category: "televisions",
          version: "1.0.0",
          status: "approved",
          author: "SC-01",
          languages: { [requestedLanguage]: "inReview" },
        };
      },
    },
    modelLabels: {
      async list() {
        await wait();
        return [];
      },
      async commit(input) {
        await wait();
        return {
          id: FIXTURE_IDS.evidence,
          category: input.category,
          reviewer: input.reviewer,
          approvedOn: FIXTURE_TIMESTAMP.slice(0, 10),
          corrected: input.corrected,
        };
      },
    },
    dataExports: {
      async list() {
        await wait();
        return [];
      },
      async request(scopeKey) {
        await wait();
        return {
          id: "EX-0001",
          scopeKey,
          status: "ready",
          requestedOn: FIXTURE_TIMESTAMP.slice(0, 10),
          rows: 0,
        };
      },
      async build() {
        await wait();
        return "";
      },
    },
    settings: {
      async getProgramme() {
        await wait();
        return {
          defaultLanguage: "en",
          retentionDays: 30,
          weightUnit: "kg",
          reviewAlerts: true,
          weeklyDigest: false,
        };
      },
      async saveProgramme(values) {
        await wait();
        return values;
      },
      async getFacility() {
        await wait();
        return { intakeAlerts: false, weeklySummary: false };
      },
      async saveFacility(values) {
        await wait();
        return values;
      },
    },
    consent: {
      async get() {
        await wait();
        return { trainingReuse: false };
      },
      async set(trainingReuse) {
        await wait();
        return { trainingReuse, decidedAt: FIXTURE_TIMESTAMP };
      },
    },
    device: {
      async summary() {
        await wait();
        return {
          recordCount: 1,
          draftCount: 1,
          queuedMutationCount: 0,
          photographCount: 0,
          storedBytes: 0,
        };
      },
      async clearLocalData() {
        await wait();
        return {
          recordCount: 0,
          draftCount: 0,
          queuedMutationCount: 0,
          photographCount: 0,
          storedBytes: 0,
        };
      },
    },
    outbox: {
      async pending() {
        await wait();
        return [];
      },
      async flush() {
        await wait();
        return { accepted: 0, remaining: 0 };
      },
    },
    vision: {
      async appraise(request) {
        await wait();
        VisionAppraisalRequestSchema.parse(request);
        return VisionAppraisalResponseSchema.parse(
          failure === "vision"
            ? {
                outcome: "unable_to_classify",
                reason: "service_unavailable",
                model_name: "scraptrace-demo-classifier",
                model_version: "1.0.0",
                inferred_at: FIXTURE_TIMESTAMP,
              }
            : {
                outcome: "classified",
                category: "televisions",
                scores,
                confidence: 0.8,
                model_name: "scraptrace-demo-classifier",
                model_version: "1.0.0",
                inferred_at: FIXTURE_TIMESTAMP,
              },
        );
      },
    },
    safetyGuidance: {
      async getGuidance(request) {
        await wait();
        const parsedRequest = SafetyGuidanceRequestSchema.parse(request);
        return SafetyGuidanceResponseSchema.parse(
          failure === "safety"
            ? {
                outcome: "safe_fallback",
                category: parsedRequest.category,
                language: {
                  language: parsedRequest.requested_language,
                  direction: parsedRequest.requested_language === "ar" ? "rtl" : "ltr",
                  reviewed: true,
                },
                reason: "provider_unavailable",
                message: "Approved guidance is temporarily unavailable.",
                referral: "Contact a programme-verified receiving location or trained technician.",
                llm_called: false,
              }
            : {
                outcome: "approved_guidance",
                category: parsedRequest.category,
                language: {
                  language: parsedRequest.requested_language,
                  direction: parsedRequest.requested_language === "ar" ? "rtl" : "ltr",
                  reviewed: true,
                },
                safety_card_id: FIXTURE_IDS.card,
                safety_card_version: "1.0.0",
                source_references: ["Reviewed demonstration safety source"],
                approval_date: "2026-09-01",
                review_date: "2027-03-01",
                answers: {
                  what_is_it: "A demonstration television category item.",
                  possible_dangers: "Damaged parts may contain hazardous material.",
                  prohibited_actions: "Do not burn, break or dismantle the item.",
                  safe_actions_now: "Keep the item dry and away from children.",
                  suitable_destination: "Use a programme-verified receiving location.",
                },
                transformation_mode: parsedRequest.transformation_mode,
                grounding_references: ["card:demo:1.0.0"],
                offline_available: true,
                ai_assisted: false,
              },
        );
      },
    },
    locations: {
      async search(request) {
        await wait();
        LocationSearchRequestSchema.parse(request);
        return LocationSearchResponseSchema.parse(
          failure === "locations"
            ? {
                outcome: "no_results",
                safe_holding_message:
                  "Keep the item intact and dry until a suitable location is available.",
              }
            : {
                outcome: "results",
                locations: [
                  {
                    location_id: FIXTURE_IDS.location,
                    name: "Demonstration receiving centre",
                    facility_type: "collection_centre",
                    accepted_categories: ["televisions"],
                    verification_status: "programme_verified",
                    verification_date: "2026-09-01",
                    coordinates: { latitude: 5.6037, longitude: -0.187, source: "imported" },
                    distance_km: 2.4,
                    last_reviewed_at: FIXTURE_TIMESTAMP,
                    data_source: "cached_directory",
                  },
                ],
                data_as_of: FIXTURE_TIMESTAMP,
              },
        );
      },
    },
    handoffs: {
      async record(request) {
        await wait();
        const parsedRequest = HandoffRequestSchema.parse(request);
        return HandoffResponseSchema.parse(
          failure === "handoff"
            ? {
                outcome: "rejected",
                reason_code: "DEMO_REJECTED",
                message: "The demonstration handoff was rejected.",
                replayed: false,
              }
            : {
                outcome: "accepted",
                recovery_record_id: parsedRequest.recovery_record_id,
                received_at: FIXTURE_TIMESTAMP,
                replayed: false,
              },
        );
      },
    },
    processing: {
      async record(request) {
        await wait();
        const parsedRequest = ProcessingRequestSchema.parse(request);
        return ProcessingResponseSchema.parse(
          failure === "processing"
            ? {
                outcome: "review_required",
                recovery_record_id: parsedRequest.recovery_record_id,
                flag_codes: ["DEMO_REVIEW"],
                replayed: false,
              }
            : {
                outcome: "processing_recorded",
                recovery_record_id: parsedRequest.recovery_record_id,
                server_revision: 1,
                replayed: false,
              },
        );
      },
    },
    reviews: {
      async decide(request) {
        await wait();
        const parsedRequest = ProgrammeReviewRequestSchema.parse(request);
        if (failure === "review") fail(failure);
        return ProgrammeReviewResponseSchema.parse({
          recovery_record_id: parsedRequest.recovery_record_id,
          previous_review_state: parsedRequest.previous_review_state,
          resulting_review_state:
            parsedRequest.decision === "approve"
              ? "approved"
              : parsedRequest.decision === "reject"
                ? "rejected"
                : "awaiting_information",
          previous_record_state: parsedRequest.previous_record_state,
          resulting_record_state:
            parsedRequest.decision === "approve"
              ? "approved_and_completed"
              : parsedRequest.decision === "reject"
                ? "rejected"
                : "under_review",
          decision_timestamp: parsedRequest.decision_timestamp,
          replayed: false,
        });
      },
    },
    reporting: {
      async summarize(filters) {
        await wait();
        const parsedFilters = ReportingFiltersSchema.parse(filters);
        if (failure === "reporting") fail(failure);
        return ReportingSummarySchema.parse({
          record_counts_by_state: {
            draft: 1,
            submitted: 0,
            awaiting_handoff: 0,
            received: 0,
            processing_recorded: 0,
            completed: 0,
            under_review: 0,
            approved_and_completed: 0,
            rejected: 0,
          },
          verified_weight: { value: 0, unit: "kg", eligible_state: "approved_and_completed" },
          applied_filters: {
            ...(parsedFilters.date_from ? { date_from: parsedFilters.date_from } : {}),
            ...(parsedFilters.date_to ? { date_to: parsedFilters.date_to } : {}),
            ...(parsedFilters.categories ? { categories: parsedFilters.categories } : {}),
            ...(parsedFilters.coarse_area ? { coarse_area: parsedFilters.coarse_area } : {}),
            ...(parsedFilters.receiving_location_id
              ? { receiving_location_id: parsedFilters.receiving_location_id }
              : {}),
            ...(parsedFilters.states ? { states: parsedFilters.states } : {}),
          },
          data_freshness_at: FIXTURE_TIMESTAMP,
          pagination: { next_cursor: null, has_more: false },
        });
      },
    },
    synchronization: {
      async synchronize(request) {
        await wait();
        const parsedRequest = SyncBatchRequestSchema.parse(request);
        return SyncBatchResponseSchema.parse({
          contract_version: CONTRACT_SCHEMA_VERSION,
          results: parsedRequest.mutations.map((mutation) =>
            failure === "synchronization"
              ? {
                  outcome: "retryable",
                  client_mutation_id: mutation.client_mutation_id,
                  error_code: "DEPENDENCY_UNAVAILABLE",
                  message: "The demonstration dependency is unavailable.",
                  retryable: true,
                  retry_after_seconds: 2,
                }
              : {
                  outcome: "accepted",
                  client_mutation_id: mutation.client_mutation_id,
                  record_id: mutation.record_id,
                  server_revision: 1,
                  server_timestamp: FIXTURE_TIMESTAMP,
                  replay_status: "created",
                },
          ),
          server_timestamp: FIXTURE_TIMESTAMP,
        });
      },
    },
  };
};
