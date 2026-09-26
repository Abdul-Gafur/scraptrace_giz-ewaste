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
  RecoveryRecordStateSchema,
  ReportingFiltersSchema,
  ReportingSummarySchema,
  ReviewStateSchema,
  SafetyGuidanceRequestSchema,
  SafetyGuidanceResponseSchema,
  SyncBatchRequestSchema,
  SyncBatchResponseSchema,
  QueuedMutationSchema,
  UserRoleSchema,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
  getLanguageDirection,
  type RecoveryRecord,
  type SupportedLanguage,
} from "@scraptrace/contracts";

import type { FrontendServices, SafetyCardSummary, Session } from "@/services/ports/service-ports";

import {
  clearEvidence,
  countEvidence,
  getEvidence,
  putEvidence,
  toStoredImage,
} from "./evidence-store";
import {
  newEvidenceIdentifier,
  buildDraft,
  demonstrationPrediction,
  estimatePrice,
  recordEvent,
  replaceRecord,
  submitRecord,
  weightFlags,
} from "./record-operations";
import {
  getProgrammeState,
  getStoredStateSize,
  resetProgrammeState,
  updateProgrammeState,
} from "./programme-store";
import { ACTOR_IDS } from "./seed";
import { newUuid, nowTimestamp } from "./ids";
import type { ProgrammeState, SafetyCardEntry } from "./state";

/**
 * The programme services this build runs on: a complete implementation of every port, over the
 * in-browser store. It is the shape a backend has to provide, exercised end to end, and it
 * never claims to be one — nothing here leaves the device.
 */

const state = RecoveryRecordStateSchema.enum;
const review = ReviewStateSchema.enum;
const MODEL_NAME = "scraptrace-demonstration-classifier";
const MODEL_VERSION = "1.3.0";

const isOnline = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine);
const today = (): string => nowTimestamp().slice(0, 10);

const requireSession = (current: ProgrammeState): Session => {
  if (!current.session) throw new Error("No development session is active.");
  return current.session;
};

const toSummary = (entry: SafetyCardEntry): SafetyCardSummary => ({
  id: entry.id,
  ...(entry.titleKey ? { titleKey: entry.titleKey } : {}),
  ...(entry.title ? { title: entry.title } : {}),
  category: entry.category,
  version: entry.version,
  status: entry.status,
  author: entry.author,
  ...(entry.protectiveGear ? { protectiveGear: entry.protectiveGear } : {}),
  ...(entry.submittedOn ? { submittedOn: entry.submittedOn } : {}),
  ...(entry.approvedBy ? { approvedBy: entry.approvedBy } : {}),
  ...(entry.publishedOn ? { publishedOn: entry.publishedOn } : {}),
  ...(entry.reviewOn ? { reviewOn: entry.reviewOn } : {}),
  languages: entry.languages,
});

const updateCard = (
  cardId: string,
  change: (entry: SafetyCardEntry) => SafetyCardEntry,
): SafetyCardSummary => {
  const next = updateProgrammeState((current) => ({
    ...current,
    safetyCards: current.safetyCards.map((entry) => (entry.id === cardId ? change(entry) : entry)),
  }));
  const entry = next.safetyCards.find((candidate) => candidate.id === cardId);
  if (!entry) throw new Error("The safety card no longer exists.");
  return toSummary(entry);
};

const findRecord = (recordId: string): RecoveryRecord => {
  const record = getProgrammeState().records.find((candidate) => candidate.record_id === recordId);
  if (!record) throw new Error("The record no longer exists on this device.");
  return record;
};

export const createLocalServices = (): FrontendServices => ({
  authentication: {
    async getSession() {
      return getProgrammeState().session;
    },
    async signIn(role, preferredLanguage) {
      const validatedRole = UserRoleSchema.parse(role);
      const session = {
        actorId: ACTOR_IDS[validatedRole] ?? newUuid(),
        role: validatedRole,
        preferredLanguage,
        displayLabel: validatedRole,
        developmentOnly: true as const,
        signedInAt: nowTimestamp(),
      };
      updateProgrammeState((current) => ({ ...current, session }));
      return session;
    },
    async signOut() {
      updateProgrammeState((current) => ({ ...current, session: null }));
    },
  },

  recoveryRecords: {
    async list() {
      return getProgrammeState().records;
    },
    async listOwn() {
      const current = getProgrammeState();
      const actorId = current.session?.actorId;
      return current.records.filter((record) => !actorId || record.collector.actor_id === actorId);
    },
    async getById(recordId) {
      return getProgrammeState().records.find((record) => record.record_id === recordId) ?? null;
    },
    async lookup(code) {
      const wanted = code.trim().toUpperCase();
      const lower = code.trim();
      return (
        getProgrammeState().records.find(
          (record) =>
            record.human_reference.toUpperCase() === wanted ||
            record.qr_payload.lookup_token === lower,
        ) ?? null
      );
    },
    async saveDraft(record) {
      const parsed = RecoveryRecordSchema.parse(record);
      updateProgrammeState((current) => replaceRecord(current, parsed));
      return parsed;
    },
    async create(input) {
      const current = getProgrammeState();
      const session = requireSession(current);
      const online = isOnline();
      const draft = buildDraft(input, session.actorId, current.deviceInstanceId, online);
      updateProgrammeState((latest) => ({ ...latest, records: [draft, ...latest.records] }));
      return draft;
    },
    async submit(recordId) {
      const record = findRecord(recordId);
      const online = isOnline();
      const next = submitRecord(record, online);
      updateProgrammeState((current) => {
        // Newest first, so the two transitions one submit makes are stored in reverse order.
        const events = [
          recordEvent(
            current,
            next,
            "publish_for_handoff",
            UserRoleSchema.enum.collector,
            state.submitted,
            state.awaiting_handoff,
          ),
          recordEvent(
            current,
            next,
            "submit_record",
            UserRoleSchema.enum.collector,
            state.draft,
            state.submitted,
          ),
        ];
        const withRecord = replaceRecord(current, next, events);
        if (online) return withRecord;
        return {
          ...withRecord,
          queue: [
            ...withRecord.queue,
            QueuedMutationSchema.parse({
              contract_version: CONTRACT_SCHEMA_VERSION,
              client_mutation_id: newUuid(),
              record_id: next.record_id,
              device_instance_id: current.deviceInstanceId,
              local_sequence: withRecord.queue.length,
              base_server_revision: null,
              mutation_type: "submit_record",
              mutation_payload: { human_reference: next.human_reference },
              created_at: nowTimestamp(),
              idempotency: {
                idempotency_key: `submit-record-${next.record_id}`,
                request_digest: `sha256:${"0".repeat(64)}`,
                scope: {
                  actor_id: next.collector.actor_id,
                  operation: "submit_record",
                  resource_id: next.record_id,
                },
              },
              sync_state: "pending_synchronization",
              attempt: { attempt_count: 0 },
            }),
          ],
        };
      });
      return next;
    },
    async events() {
      return getProgrammeState().events;
    },
  },

  evidence: {
    async store(file) {
      const evidenceId = newEvidenceIdentifier();
      await putEvidence(evidenceId, await toStoredImage(file));
      return evidenceId;
    },
    async read(evidenceId) {
      return getEvidence(evidenceId);
    },
  },

  vision: {
    async appraise(request) {
      const parsed = VisionAppraisalRequestSchema.parse(request);
      const prediction = demonstrationPrediction(parsed.evidence_id);
      const lowConfidence = prediction.confidence < 0.6;
      return VisionAppraisalResponseSchema.parse(
        lowConfidence
          ? {
              outcome: "unable_to_classify",
              reason: "low_confidence",
              scores: prediction.scores,
              model_name: MODEL_NAME,
              model_version: MODEL_VERSION,
              inferred_at: nowTimestamp(),
            }
          : {
              outcome: "classified",
              category: prediction.category,
              scores: prediction.scores,
              confidence: prediction.confidence,
              model_name: MODEL_NAME,
              model_version: MODEL_VERSION,
              inferred_at: nowTimestamp(),
            },
      );
    },
  },

  prices: {
    async estimate(input) {
      return estimatePrice({ ...input, effectiveDate: today() });
    },
  },

  safetyGuidance: {
    async getGuidance(request) {
      const parsed = SafetyGuidanceRequestSchema.parse(request);
      const language: SupportedLanguage = parsed.requested_language;
      const languageMetadata = {
        language,
        direction: getLanguageDirection(language),
        reviewed: true,
      };
      const card = getProgrammeState().safetyCards.find(
        (candidate) =>
          candidate.category === parsed.category &&
          candidate.status === "approved" &&
          candidate.languages[language] === "approved" &&
          candidate.answers[language] !== undefined,
      );
      if (!card) {
        return SafetyGuidanceResponseSchema.parse({
          outcome: "safe_fallback",
          category: parsed.category,
          language: languageMetadata,
          reason: "no_approved_card",
          message:
            "No approved safety card covers this category in this language yet. Keep the item intact, dry and away from people until it is handed over.",
          referral: "Contact a programme-verified receiving location or trained technician.",
          llm_called: false,
        });
      }
      return SafetyGuidanceResponseSchema.parse({
        outcome: "approved_guidance",
        category: parsed.category,
        language: languageMetadata,
        safety_card_id: card.id,
        safety_card_version: card.version,
        source_references: [
          "Programme-approved safety card, reviewed by the content administrator",
        ],
        approval_date: card.publishedOn ?? today(),
        review_date: card.reviewOn ?? today(),
        answers: card.answers[language],
        transformation_mode: parsed.transformation_mode,
        grounding_references: [`card:${card.id}:${card.version}`],
        offline_available: true,
        ai_assisted: false,
      });
    },
  },

  locations: {
    async search(request) {
      const parsed = LocationSearchRequestSchema.parse(request);
      const matches = getProgrammeState()
        .directory.map((entry) => entry.location)
        .filter(
          (location) =>
            location.distance_km <= parsed.radius_km &&
            parsed.categories.some((category) => location.accepted_categories.includes(category)) &&
            (!parsed.facility_types || parsed.facility_types.includes(location.facility_type)),
        );
      if (matches.length === 0) {
        return LocationSearchResponseSchema.parse({
          outcome: "no_results",
          safe_holding_message:
            "Keep the item sealed, dry and ventilated until a suitable location accepts this category.",
          programme_contact: "Contact the programme office before transporting hazardous items.",
        });
      }
      return LocationSearchResponseSchema.parse({
        outcome: "results",
        locations: matches,
        data_as_of: nowTimestamp(),
        ...(parsed.offline
          ? {
              offline_limitations:
                "Shown from the directory stored on this device. Opening hours may have changed.",
            }
          : {}),
      });
    },
  },

  handoffs: {
    async record(request) {
      const parsed = HandoffRequestSchema.parse(request);
      const record = findRecord(parsed.recovery_record_id);
      if (record.qr_payload.lookup_token !== parsed.lookup_token) {
        return HandoffResponseSchema.parse({
          outcome: "rejected",
          reason_code: "LOOKUP_TOKEN_MISMATCH",
          message: "The scanned code does not belong to this record.",
          replayed: false,
        });
      }
      if (record.handoff) {
        return HandoffResponseSchema.parse({
          outcome: "duplicate_scan",
          original_received_at: record.handoff.server_received_at,
          original_logical_result: "accepted",
        });
      }
      const receivedAt = nowTimestamp();
      const flags = weightFlags(record, parsed.measured_weight.value);
      const next = RecoveryRecordSchema.parse({
        ...record,
        revision: record.revision + 1,
        business_state: state.received,
        handoff_state: "received",
        handoff: {
          recycler: parsed.recycler_reference,
          receiving_location_id: parsed.receiving_location_id,
          confirmed_category: parsed.confirmed_category,
          confirmed_condition: parsed.confirmed_condition,
          measured_weight: parsed.measured_weight,
          final_price: parsed.final_price,
          handed_off_at: parsed.handoff_time,
          server_received_at: receivedAt,
          evidence_ids: parsed.evidence_ids,
        },
        review:
          flags.length > 0
            ? {
                ...record.review,
                review_state: review.open,
                flag_codes: [...record.review.flag_codes, ...flags],
              }
            : record.review,
        sync: {
          ...record.sync,
          sync_state: "synchronized",
          local_revision: record.sync.local_revision + 1,
        },
        updated_at: receivedAt,
      });
      updateProgrammeState((current) =>
        replaceRecord(current, next, [
          recordEvent(
            current,
            next,
            "record_handoff",
            UserRoleSchema.enum.recycler,
            record.business_state,
            state.received,
          ),
          ...(flags.length > 0
            ? [
                recordEvent(
                  current,
                  next,
                  "flag_for_review",
                  "system",
                  state.received,
                  state.received,
                  flags.join(", "),
                ),
              ]
            : []),
        ]),
      );
      return HandoffResponseSchema.parse(
        flags.length > 0
          ? { outcome: "discrepancy", flag_codes: flags, received_at: receivedAt, replayed: false }
          : {
              outcome: "accepted",
              recovery_record_id: parsed.recovery_record_id,
              received_at: receivedAt,
              replayed: false,
            },
      );
    },
  },

  processing: {
    async record(request) {
      const parsed = ProcessingRequestSchema.parse(request);
      const record = findRecord(parsed.recovery_record_id);
      const processedAt = nowTimestamp();
      const flagged = record.review.flag_codes.length > 0;
      const resulting = flagged ? state.under_review : state.completed;
      const next = RecoveryRecordSchema.parse({
        ...record,
        revision: record.revision + 1,
        business_state: resulting,
        processing_state: "completed",
        processing: {
          recycler: parsed.recycler_reference,
          method: parsed.processing_method,
          result: parsed.notes ?? "Processing outcome recorded at the receiving facility.",
          material_entries: parsed.material_entries,
          processed_at: parsed.processing_timestamp,
          evidence_ids: parsed.completion_evidence_ids,
        },
        review: flagged ? record.review : { ...record.review, review_state: review.open },
        sync: {
          ...record.sync,
          sync_state: "synchronized",
          local_revision: record.sync.local_revision + 1,
        },
        updated_at: processedAt,
      });
      updateProgrammeState((current) =>
        replaceRecord(current, next, [
          recordEvent(
            current,
            next,
            "mark_processing_complete",
            UserRoleSchema.enum.recycler,
            state.processing_recorded,
            resulting,
          ),
          recordEvent(
            current,
            next,
            "record_processing",
            UserRoleSchema.enum.recycler,
            record.business_state,
            state.processing_recorded,
          ),
        ]),
      );
      return ProcessingResponseSchema.parse(
        flagged
          ? {
              outcome: "review_required",
              recovery_record_id: parsed.recovery_record_id,
              flag_codes: record.review.flag_codes,
              replayed: false,
            }
          : {
              outcome: "processing_recorded",
              recovery_record_id: parsed.recovery_record_id,
              server_revision: next.sync.local_revision,
              replayed: false,
            },
      );
    },
  },

  reviews: {
    async decide(request) {
      const parsed = ProgrammeReviewRequestSchema.parse(request);
      const record = findRecord(parsed.recovery_record_id);
      const resultingReview =
        parsed.decision === "approve"
          ? review.approved
          : parsed.decision === "reject"
            ? review.rejected
            : review.awaiting_information;
      const resultingRecord =
        parsed.decision === "approve"
          ? state.approved_and_completed
          : parsed.decision === "reject"
            ? state.rejected
            : state.under_review;
      const next = RecoveryRecordSchema.parse({
        ...record,
        revision: record.revision + 1,
        business_state: resultingRecord,
        review: {
          review_state: resultingReview,
          flag_codes: record.review.flag_codes,
          assigned_reviewer: parsed.assigned_reviewer,
          evidence_considered: parsed.evidence_considered,
          decision: parsed.decision,
          reason_code: parsed.reason_code,
          reviewer_note: parsed.reviewer_note,
          ...(parsed.requested_correction
            ? { requested_correction: parsed.requested_correction }
            : {}),
          decided_at: parsed.decision_timestamp,
        },
        sync: {
          ...record.sync,
          sync_state: "synchronized",
          local_revision: record.sync.local_revision + 1,
        },
        updated_at: parsed.decision_timestamp,
      });
      updateProgrammeState((current) =>
        replaceRecord(current, next, [
          recordEvent(
            current,
            next,
            parsed.decision === "approve"
              ? "approve_review"
              : parsed.decision === "reject"
                ? "reject_review"
                : "request_correction",
            UserRoleSchema.enum.programme_reviewer,
            record.business_state,
            resultingRecord,
            parsed.reason_code,
          ),
        ]),
      );
      return ProgrammeReviewResponseSchema.parse({
        recovery_record_id: parsed.recovery_record_id,
        previous_review_state: parsed.previous_review_state,
        resulting_review_state: resultingReview,
        previous_record_state: parsed.previous_record_state,
        resulting_record_state: resultingRecord,
        decision_timestamp: parsed.decision_timestamp,
        replayed: false,
      });
    },
  },

  reporting: {
    async summarize(filters) {
      const parsed = ReportingFiltersSchema.parse(filters);
      const records = getProgrammeState().records.filter(
        (record) =>
          (!parsed.categories?.length || parsed.categories.includes(record.category)) &&
          (!parsed.states?.length || parsed.states.includes(record.business_state)) &&
          (!parsed.coarse_area || record.approximate_area.label === parsed.coarse_area) &&
          (!parsed.date_from || record.captured_at.slice(0, 10) >= parsed.date_from) &&
          (!parsed.date_to || record.captured_at.slice(0, 10) <= parsed.date_to),
      );
      const counts = Object.fromEntries(
        RecoveryRecordStateSchema.options.map((option) => [
          option,
          records.filter((record) => record.business_state === option).length,
        ]),
      );
      // Verified weight counts approved and completed records only: nothing pending, flagged,
      // rejected or unsynchronized may contribute to a verified total.
      const verified = records
        .filter((record) => record.business_state === state.approved_and_completed)
        .reduce((total, record) => total + (record.handoff?.measured_weight.value ?? 0), 0);
      return ReportingSummarySchema.parse({
        record_counts_by_state: counts,
        verified_weight: {
          value: Math.round(verified * 100) / 100,
          unit: "kg",
          eligible_state: state.approved_and_completed,
        },
        applied_filters: {
          ...(parsed.date_from ? { date_from: parsed.date_from } : {}),
          ...(parsed.date_to ? { date_to: parsed.date_to } : {}),
          ...(parsed.categories ? { categories: parsed.categories } : {}),
          ...(parsed.coarse_area ? { coarse_area: parsed.coarse_area } : {}),
          ...(parsed.receiving_location_id
            ? { receiving_location_id: parsed.receiving_location_id }
            : {}),
          ...(parsed.states ? { states: parsed.states } : {}),
        },
        data_freshness_at: nowTimestamp(),
        pagination: { next_cursor: null, has_more: false },
      });
    },
  },

  synchronization: {
    async synchronize(request) {
      const parsed = SyncBatchRequestSchema.parse(request);
      const serverTimestamp = nowTimestamp();
      const offline = !isOnline();
      return SyncBatchResponseSchema.parse({
        contract_version: CONTRACT_SCHEMA_VERSION,
        results: parsed.mutations.map((mutation) =>
          offline
            ? {
                outcome: "retryable",
                client_mutation_id: mutation.client_mutation_id,
                error_code: "DEPENDENCY_UNAVAILABLE",
                message: "The device is offline. The mutation stays queued.",
                retryable: true,
                retry_after_seconds: 5,
              }
            : {
                outcome: "accepted",
                client_mutation_id: mutation.client_mutation_id,
                record_id: mutation.record_id,
                server_revision: mutation.local_sequence + 1,
                server_timestamp: serverTimestamp,
                replay_status: "created",
              },
        ),
        server_timestamp: serverTimestamp,
      });
    },
  },

  outbox: {
    async pending() {
      return getProgrammeState().queue;
    },
    async flush() {
      const current = getProgrammeState();
      if (current.queue.length === 0) return { accepted: 0, remaining: 0 };
      if (!isOnline()) return { accepted: 0, remaining: current.queue.length };
      const accepted = current.queue.length;
      updateProgrammeState((latest) => ({
        ...latest,
        queue: [],
        records: latest.records.map((record) =>
          record.sync.sync_state === "synchronized"
            ? record
            : RecoveryRecordSchema.parse({
                ...record,
                sync: {
                  ...record.sync,
                  sync_state: "synchronized",
                  server_revision: record.sync.local_revision,
                  last_attempt_at: nowTimestamp(),
                },
              }),
        ),
      }));
      return { accepted, remaining: 0 };
    },
  },

  safetyContent: {
    async listCards() {
      return getProgrammeState().safetyCards.map(toSummary);
    },
    async createCard(input) {
      const entry: SafetyCardEntry = {
        id: newUuid(),
        title: input.title,
        protectiveGear: input.protectiveGear,
        category: input.category,
        version: "0.1.0",
        status: "inReview",
        author: input.author,
        submittedOn: today(),
        languages: { en: "inReview" },
        answers: {},
      };
      updateProgrammeState((current) => ({
        ...current,
        safetyCards: [entry, ...current.safetyCards],
      }));
      return toSummary(entry);
    },
    async approve(cardId, approver) {
      const card = getProgrammeState().safetyCards.find((entry) => entry.id === cardId);
      if (!card) throw new Error("The safety card no longer exists.");
      // Separation of duties: the administrator who wrote a card cannot approve it.
      if (card.author === approver) throw new Error("SAFETY_APPROVER_IS_AUTHOR");
      const publishedOn = today();
      const reviewOn = `${Number(publishedOn.slice(0, 4)) + 1}${publishedOn.slice(4)}`;
      return updateCard(cardId, (entry) => ({
        ...entry,
        status: "approved",
        approvedBy: approver,
        publishedOn,
        reviewOn,
        languages: { ...entry.languages, en: "approved" },
      }));
    },
    async requestChanges(cardId) {
      return updateCard(cardId, (entry) => ({
        ...entry,
        status: "draft",
        languages: { ...entry.languages, en: "draft" },
      }));
    },
    async requestTranslationReview(cardId, language) {
      return updateCard(cardId, (entry) => ({
        ...entry,
        languages: { ...entry.languages, [language]: "inReview" },
      }));
    },
  },

  modelLabels: {
    async list() {
      return getProgrammeState().labels;
    },
    async commit(input) {
      const label = {
        id: newEvidenceIdentifier(),
        category: input.category,
        reviewer: input.reviewer,
        approvedOn: today(),
        corrected: input.corrected,
      };
      updateProgrammeState((current) => ({ ...current, labels: [label, ...current.labels] }));
      return label;
    },
  },

  dataExports: {
    async list() {
      return getProgrammeState().exports;
    },
    async request(scopeKey) {
      const current = getProgrammeState();
      const rows =
        scopeKey === "approvedLabels"
          ? current.labels.length
          : scopeKey === "verifiedOutcomes"
            ? current.records.filter(
                (record) => record.business_state === state.approved_and_completed,
              ).length
            : current.records.length;
      const job = {
        id: `EX-${String(current.exports.length + 43).padStart(4, "0")}`,
        scopeKey,
        status: "ready" as const,
        requestedOn: today(),
        rows,
      };
      updateProgrammeState((latest) => ({ ...latest, exports: [job, ...latest.exports] }));
      return job;
    },
    async build(scopeKey) {
      const current = getProgrammeState();
      const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
      const toCsv = (header: readonly string[], rows: readonly (readonly (string | number)[])[]) =>
        [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
      if (scopeKey === "approvedLabels") {
        return toCsv(
          ["evidence_id", "category", "reviewer", "approved_on", "human_correction"],
          current.labels.map((label) => [
            label.id,
            label.category,
            label.reviewer,
            label.approvedOn,
            label.corrected ? "yes" : "no",
          ]),
        );
      }
      if (scopeKey === "verifiedOutcomes") {
        return toCsv(
          ["human_reference", "category", "coarse_area", "measured_weight_kg", "decided_at"],
          current.records
            .filter((record) => record.business_state === state.approved_and_completed)
            .map((record) => [
              record.human_reference,
              record.category,
              record.approximate_area.label,
              record.handoff?.measured_weight.value ?? 0,
              record.review.decided_at ?? "",
            ]),
        );
      }
      return toCsv(
        ["human_reference", "business_state", "review_state", "sync_state", "captured_at"],
        current.records.map((record) => [
          record.human_reference,
          record.business_state,
          record.review.review_state,
          record.sync.sync_state,
          record.captured_at,
        ]),
      );
    },
  },

  settings: {
    async getProgramme() {
      return getProgrammeState().settings;
    },
    async saveProgramme(values) {
      updateProgrammeState((current) => ({ ...current, settings: values }));
      return values;
    },
    async getFacility() {
      return getProgrammeState().facility;
    },
    async saveFacility(values) {
      updateProgrammeState((current) => ({ ...current, facility: values }));
      return values;
    },
  },

  consent: {
    async get() {
      return getProgrammeState().consent;
    },
    async set(trainingReuse) {
      const consent = { trainingReuse, decidedAt: nowTimestamp() };
      updateProgrammeState((current) => ({ ...current, consent }));
      return consent;
    },
  },

  device: {
    async summary() {
      const current = getProgrammeState();
      return {
        recordCount: current.records.length,
        draftCount: current.records.filter((record) => record.business_state === state.draft)
          .length,
        queuedMutationCount: current.queue.length,
        photographCount: await countEvidence(),
        storedBytes: getStoredStateSize(),
      };
    },
    async clearLocalData() {
      const session = getProgrammeState().session;
      await clearEvidence();
      resetProgrammeState();
      // Clearing local data must not sign the operator out mid-task.
      updateProgrammeState((current) => ({ ...current, session }));
      return {
        recordCount: getProgrammeState().records.length,
        draftCount: 0,
        queuedMutationCount: 0,
        photographCount: 0,
        storedBytes: getStoredStateSize(),
      };
    },
  },
});
