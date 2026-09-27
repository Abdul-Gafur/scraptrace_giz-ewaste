import {
  SupportedLanguageSchema,
  type EwasteCategory,
  type SupportedLanguage,
} from "@scraptrace/contracts";

import {
  DEMO_ACTORS,
  DEMO_LOCATION_IDS,
  DEMO_PROGRAMME_ID,
  type ActorContext,
} from "@/auth/actors";
import { newEvidenceId, newUuid } from "@/services/domain/identifiers";
import { ModelConfigurationSchema } from "@/services/domain/model-administration";
import { ProgrammeSettingsSchema } from "@/services/domain/programme-settings";
import { SafetyCardSchema } from "@/services/domain/safety-content";
import { addDays, toCalendarDate, toUtcTimestamp } from "@/services/domain/time";
import { createHandoffService } from "./handoff-service";
import { createProcessingService } from "./processing-service";
import { createRecordService } from "./record-service";
import type { ScrapTraceRepository } from "./repository";
import { createReviewService } from "./review-service";
import { SAFETY_SOURCES, SEED_SAFETY_CONTENT } from "./safety-seed-content";
import { createVisionService } from "./vision-service";

/**
 * Initial demonstrable data.
 *
 * Seed records are produced by replaying the real journeys through the real services: a collector
 * creates and submits, a recycler confirms receipt and records processing, and a reviewer decides.
 * Nothing is inserted straight into a lifecycle state, so every seeded record has the evidence,
 * the audit events, the flags and the integrity digest that the same action by a user produces.
 */

const SEED_BASE_DATE = "2026-09-20T08:00:00.000Z";

/** Deterministic, distinct image content, so evidence digests are stable and non-colliding. */
const seedImage = (label: string): Blob =>
  new Blob([`scraptrace-demonstration-evidence:${label}`], { type: "image/jpeg" });

const dayOffset = (days: number, hours = 0): string =>
  toUtcTimestamp(addDays(SEED_BASE_DATE, days).getTime() + hours * 3_600_000);

const PUBLISHED_LANGUAGES: Readonly<Record<SupportedLanguage, readonly EwasteCategory[]>> = {
  en: [
    "refrigerators",
    "laptops_and_desktop_computers",
    "televisions",
    "microwaves",
    "air_conditioners",
    "compressors",
    "mixed_scrap",
  ],
  fr: ["refrigerators", "televisions", "laptops_and_desktop_computers", "air_conditioners"],
  ar: ["refrigerators", "televisions"],
  pt: ["refrigerators", "laptops_and_desktop_computers"],
};

/** French microwave guidance stays a draft, and French compressor guidance stays approved but
 * unpublished, so "draft", "approved" and "published" are visibly different states. */
const DRAFT_ONLY: readonly { language: SupportedLanguage; category: EwasteCategory }[] = [
  { language: "fr", category: "microwaves" },
];
const APPROVED_NOT_PUBLISHED: readonly { language: SupportedLanguage; category: EwasteCategory }[] =
  [{ language: "fr", category: "compressors" }];

const seedConfiguration = (repository: ScrapTraceRepository): void => {
  if (!repository.getProgrammeSettings()) {
    repository.putProgrammeSettings(
      ProgrammeSettingsSchema.parse({
        programme_name: "ScrapTrace Demonstration Programme",
        currency: "GHS",
        country_code: "GH",
        weight_discrepancy_threshold_percentage: 15,
        supported_languages: SupportedLanguageSchema.options,
        show_unverified_facilities: true,
        default_report_period_days: 30,
        default_report_states: [],
        updated_at: SEED_BASE_DATE,
      }),
    );
  }
  if (!repository.getModelConfiguration()) {
    repository.putModelConfiguration(
      ModelConfigurationSchema.parse({
        active_model_version: "0.1.0",
        confidence_threshold: 0.4,
        low_confidence_routing: "manual_confirmation_and_feedback",
        manual_review_categories: ["mixed_scrap"],
        updated_at: SEED_BASE_DATE,
      }),
    );
  }
};

const seedSafetyCards = (repository: ScrapTraceRepository): void => {
  if (repository.listSafetyCards().length > 0) return;
  const approvalDate = toCalendarDate(SEED_BASE_DATE);
  const reviewDate = toCalendarDate(addDays(SEED_BASE_DATE, 365));
  const isListed = (
    list: readonly { language: SupportedLanguage; category: EwasteCategory }[],
    language: SupportedLanguage,
    category: EwasteCategory,
  ): boolean => list.some((item) => item.language === language && item.category === category);

  for (const language of SupportedLanguageSchema.options) {
    const content = SEED_SAFETY_CONTENT[language];
    for (const [category, answers] of Object.entries(content) as [
      EwasteCategory,
      (typeof content)[EwasteCategory],
    ][]) {
      if (!answers) continue;
      const draftOnly = isListed(DRAFT_ONLY, language, category);
      const approvedOnly = isListed(APPROVED_NOT_PUBLISHED, language, category);
      const published = PUBLISHED_LANGUAGES[language].includes(category);
      if (!published && !draftOnly && !approvedOnly) continue;
      const status = draftOnly ? "draft" : approvedOnly ? "approved" : "published";
      repository.putSafetyCard(
        SafetyCardSchema.parse({
          card_id: newUuid(),
          version: "1.0.0",
          category,
          language,
          status,
          answers,
          sources: SAFETY_SOURCES.map((source) => ({ ...source })),
          ...(status === "draft"
            ? {}
            : {
                approved_by: "Programme safety review panel",
                approval_date: approvalDate,
                review_date: reviewDate,
              }),
          ...(language === "en" ? {} : { translated_from: "en" as const }),
          ai_assisted: false,
          programme_id: DEMO_PROGRAMME_ID,
          created_at: SEED_BASE_DATE,
          updated_at: SEED_BASE_DATE,
        }),
      );
    }
  }
};

const servicesFor = (repository: ScrapTraceRepository, actor: ActorContext) => {
  const context = { repository, actor, delayMilliseconds: 0 };
  return {
    records: createRecordService(context),
    vision: createVisionService(context),
    handoffs: createHandoffService(context),
    processing: createProcessingService(context),
    reviews: createReviewService(context),
  };
};

interface SeedRecordPlan {
  readonly label: string;
  readonly category: EwasteCategory;
  readonly condition: "working" | "repairable" | "damaged" | "unknown";
  readonly itemCount?: number;
  readonly declaredWeightKg?: number;
  readonly dayOffset: number;
  readonly destination: string;
  /** How far the record travels through the journey. */
  readonly stage: "draft" | "awaiting_handoff" | "received" | "processed" | "decided";
  readonly measuredWeightKg?: number;
  readonly confirmedCategory?: EwasteCategory;
  readonly materials?: readonly { material: string; kg: number }[];
  readonly decision?: "approve" | "reject" | "request_correction";
  readonly reasonCode?: string;
  readonly reviewerNote?: string;
}

const PLANS: readonly SeedRecordPlan[] = [
  {
    label: "draft-television",
    category: "televisions",
    condition: "damaged",
    itemCount: 1,
    declaredWeightKg: 14,
    dayOffset: 6,
    destination: DEMO_LOCATION_IDS.collectionCentre,
    stage: "draft",
  },
  {
    label: "awaiting-laptops",
    category: "laptops_and_desktop_computers",
    condition: "repairable",
    itemCount: 3,
    declaredWeightKg: 9.5,
    dayOffset: 5,
    destination: DEMO_LOCATION_IDS.collectionCentre,
    stage: "awaiting_handoff",
  },
  {
    label: "awaiting-mixed",
    category: "mixed_scrap",
    condition: "unknown",
    declaredWeightKg: 42,
    dayOffset: 5,
    destination: DEMO_LOCATION_IDS.scrapyard,
    stage: "awaiting_handoff",
  },
  {
    label: "received-refrigerator",
    category: "refrigerators",
    condition: "damaged",
    itemCount: 1,
    declaredWeightKg: 58,
    dayOffset: 4,
    destination: DEMO_LOCATION_IDS.recycler,
    stage: "received",
    measuredWeightKg: 60.4,
  },
  {
    label: "review-microwave-weight",
    category: "microwaves",
    condition: "damaged",
    itemCount: 2,
    declaredWeightKg: 18,
    dayOffset: 3,
    destination: DEMO_LOCATION_IDS.recycler,
    stage: "processed",
    measuredWeightKg: 31,
    materials: [
      { material: "Steel casing", kg: 14.2 },
      { material: "Transformer copper", kg: 2.6 },
    ],
  },
  {
    label: "review-category-disagreement",
    category: "televisions",
    condition: "unknown",
    itemCount: 1,
    declaredWeightKg: 11,
    dayOffset: 3,
    destination: DEMO_LOCATION_IDS.recycler,
    stage: "processed",
    measuredWeightKg: 11.4,
    confirmedCategory: "laptops_and_desktop_computers",
    materials: [{ material: "Circuit boards", kg: 1.1 }],
  },
  {
    label: "approved-air-conditioner",
    category: "air_conditioners",
    condition: "repairable",
    itemCount: 1,
    declaredWeightKg: 34,
    dayOffset: 2,
    destination: DEMO_LOCATION_IDS.recycler,
    // Received noticeably heavier than declared, which flags the record for review; the reviewer
    // then approves it, which is the discrepancy-and-approval journey end to end.
    stage: "decided",
    measuredWeightKg: 41,
    materials: [
      { material: "Aluminium fins", kg: 6.4 },
      { material: "Copper tubing", kg: 3.8 },
    ],
    decision: "approve",
    reasonCode: "EVIDENCE_SUFFICIENT",
    reviewerNote:
      "Scale photograph is legible and matches the recorded weight. Refrigerant recovery certificate on file.",
  },
  {
    label: "completed-compressor",
    category: "compressors",
    condition: "damaged",
    itemCount: 4,
    declaredWeightKg: 26,
    dayOffset: 2,
    destination: DEMO_LOCATION_IDS.recycler,
    stage: "processed",
    measuredWeightKg: 26.8,
    materials: [{ material: "Cast steel", kg: 19.5 }],
  },
  {
    label: "rejected-television",
    category: "televisions",
    condition: "damaged",
    itemCount: 1,
    declaredWeightKg: 22,
    dayOffset: 1,
    destination: DEMO_LOCATION_IDS.recycler,
    stage: "decided",
    measuredWeightKg: 41,
    materials: [{ material: "Lead glass", kg: 12.5 }],
    decision: "reject",
    reasonCode: "WEIGHT_UNEXPLAINED",
    reviewerNote:
      "Received weight is nearly double the declared weight and the scale photograph shows a different item. Returned as not verifiable.",
  },
];

const runPlan = async (repository: ScrapTraceRepository, plan: SeedRecordPlan): Promise<void> => {
  const collector = servicesFor(repository, DEMO_ACTORS.collector);
  const recycler = servicesFor(repository, DEMO_ACTORS.recycler);
  const reviewer = servicesFor(repository, DEMO_ACTORS.programme_reviewer);

  const image = seedImage(plan.label);
  const capturedAt = dayOffset(plan.dayOffset, 9);
  const appraisal = await collector.vision.appraise({
    evidence_id: newEvidenceId(),
    image,
    price_estimation_inputs: {
      condition: plan.condition,
      ...(plan.itemCount !== undefined ? { item_count: plan.itemCount } : {}),
      ...(plan.declaredWeightKg !== undefined
        ? { approximate_weight_kg: plan.declaredWeightKg }
        : {}),
    },
  });
  const suggested = appraisal.outcome === "classified" ? appraisal.category : undefined;

  const draft = await collector.records.createDraft({
    category: plan.category,
    language: "en",
    condition: plan.condition,
    ...(plan.itemCount !== undefined ? { itemCount: plan.itemCount } : {}),
    ...(plan.declaredWeightKg !== undefined
      ? { approximateWeight: { value: plan.declaredWeightKg, unit: "kg" as const } }
      : {}),
    areaLabel: "Greater Accra",
    administrativeArea: "Greater Accra",
    confirmationSource:
      suggested === undefined
        ? "manual_selection"
        : suggested === plan.category
          ? "accepted_prediction"
          : "human_correction",
    ...(suggested !== undefined && suggested !== plan.category
      ? { correctionReason: "The photographed item does not match the suggested category." }
      : {}),
    image,
    offline: false,
    destinationLocationId: plan.destination,
    capturedAt,
    ...(appraisal.outcome === "classified"
      ? {
          visionResult: {
            prediction_id: newUuid(),
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

  if (plan.stage === "draft") return;
  await collector.records.submit(draft.record_id);
  if (plan.stage === "awaiting_handoff") return;

  await recycler.handoffs.confirmReceipt({
    recordId: draft.record_id,
    confirmedCategory: plan.confirmedCategory ?? plan.category,
    confirmedCondition: plan.condition,
    measuredWeight: { value: plan.measuredWeightKg ?? plan.declaredWeightKg ?? 1, unit: "kg" },
    finalPriceAmount: Math.round((plan.measuredWeightKg ?? 1) * 4.5 * 100) / 100,
    receivingLocationId: plan.destination,
    evidence: {
      handoffPhoto: seedImage(`${plan.label}-handoff`),
      weightPhoto: seedImage(`${plan.label}-weight`),
      scannedPayload: `SCRAPTRACE:1.0.0:${draft.record_id}:${draft.qr_payload.lookup_token}`,
      notes: "Received at the programme intake bay.",
    },
    offline: false,
  });
  if (plan.stage === "received") return;

  await recycler.processing.submitProcessing({
    recordId: draft.record_id,
    method: "material_recovery",
    materialEntries: (plan.materials ?? []).map((entry) => ({
      material: entry.material,
      weight: { value: entry.kg, unit: "kg" as const },
    })),
    processedAt: dayOffset(plan.dayOffset, 14),
    notes: "Material recovery recorded with weighbridge evidence.",
    completionEvidence: seedImage(`${plan.label}-processing`),
    offline: false,
  });
  if (plan.stage === "processed" || !plan.decision) return;

  await reviewer.reviews.submitDecision({
    recordId: draft.record_id,
    decision: plan.decision,
    reasonCode: plan.reasonCode ?? "EVIDENCE_SUFFICIENT",
    reviewerNote: plan.reviewerNote ?? "Decision recorded.",
  });
};

/**
 * One in-flight seeding run per repository. The guard is keyed by the repository rather than being
 * a module-level flag, so a second repository (another tab's store, or a test's own store) is seeded
 * on its own terms instead of silently inheriting the first one's result.
 */
const seeding = new WeakMap<ScrapTraceRepository, Promise<void>>();

/**
 * Seeds the repository once. Safe to call repeatedly: a repository that already holds records is
 * left untouched, so a page refresh never duplicates the demonstration data.
 */
export const ensureSeeded = (repository: ScrapTraceRepository): Promise<void> => {
  const existing = seeding.get(repository);
  if (existing) return existing;
  const run = (async () => {
    seedConfiguration(repository);
    seedSafetyCards(repository);
    if (repository.listRecords().length === 0) {
      for (const plan of PLANS) {
        await runPlan(repository, plan);
      }
    }
  })();
  seeding.set(repository, run);
  return run;
};

/** Synchronous part of seeding: configuration and approved content, which need no digests. */
export const seedRepository = (repository: ScrapTraceRepository): void => {
  seedConfiguration(repository);
  seedSafetyCards(repository);
};
