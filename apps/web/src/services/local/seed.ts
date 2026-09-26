import {
  CONTRACT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  EventIdSchema,
  FacilityTypeSchema,
  RecoveryRecordEventTypeSchema,
  RecoveryRecordSchema,
  RecoveryRecordStateSchema,
  ReviewStateSchema,
  SupportedLanguageSchema,
  UserRoleSchema,
  type RecoveryRecord,
  type RecoveryRecordEvent,
} from "@scraptrace/contracts";

import type { ProgrammeState } from "./state";

/**
 * Programme data the demonstration starts from: a controlled directory, approved safety cards,
 * a reviewed label set and six recovery records spread across the contract lifecycle, so every
 * dashboard has something truthful to show before anyone captures anything.
 *
 * Identifiers are deterministic. Nothing here is a real person, business or measurement.
 */

const state = RecoveryRecordStateSchema.enum;
const review = ReviewStateSchema.enum;
const facility = FacilityTypeSchema.enum;
const event = RecoveryRecordEventTypeSchema.enum;
const language = SupportedLanguageSchema.enum;

/** Deterministic UUIDv7-shaped seed identifier. */
const seedId = (group: number, index: number): string =>
  `0199a1${group.toString(16).padStart(2, "0")}-0000-7000-8000-${index.toString(16).padStart(12, "0")}`;

export const SEED_IDS = {
  device: seedId(0, 1),
  collector: seedId(1, 1),
  recycler: seedId(1, 2),
  reviewer: seedId(1, 3),
  manager: seedId(1, 4),
  safetyAdmin: seedId(1, 5),
  modelReviewer: seedId(1, 6),
} as const;

export const ACTOR_IDS: Record<string, string> = {
  [UserRoleSchema.enum.collector]: SEED_IDS.collector,
  [UserRoleSchema.enum.recycler]: SEED_IDS.recycler,
  [UserRoleSchema.enum.programme_reviewer]: SEED_IDS.reviewer,
  [UserRoleSchema.enum.programme_manager]: SEED_IDS.manager,
  [UserRoleSchema.enum.safety_content_administrator]: SEED_IDS.safetyAdmin,
  [UserRoleSchema.enum.data_ml_reviewer]: SEED_IDS.modelReviewer,
};

const locationId = (index: number) => seedId(2, index);
const recordId = (index: number) => seedId(3, index);
const evidenceId = (index: number) => seedId(4, index);
const cardId = (index: number) => seedId(5, index);
const eventId = (index: number) => seedId(6, index);

const at = (day: string) => `${day}T09:00:00.000Z`;

const AREAS = [
  { label: "Kumasi North", administrative_area: "Ashanti", country_code: "GH" },
  { label: "Accra East", administrative_area: "Greater Accra", country_code: "GH" },
  { label: "Tamale Central", administrative_area: "Northern", country_code: "GH" },
] as const;

interface SeedRecordInput {
  index: number;
  reference: string;
  category: RecoveryRecord["category"];
  kind?: RecoveryRecord["record_kind"];
  condition: RecoveryRecord["condition"];
  area: (typeof AREAS)[number];
  capturedOn: string;
  businessState: RecoveryRecord["business_state"];
  weightKg?: number;
  handoffWeightKg?: number;
  locationIndex?: number;
  reviewState?: RecoveryRecord["review"]["review_state"];
  decision?: "approve" | "reject" | "request_correction";
  flagCodes?: readonly string[];
}

const buildRecord = (input: SeedRecordInput): RecoveryRecord => {
  const id = recordId(input.index);
  const capturedAt = at(input.capturedOn);
  const handoffDone =
    input.businessState === state.received ||
    input.businessState === state.processing_recorded ||
    input.businessState === state.completed ||
    input.businessState === state.under_review ||
    input.businessState === state.approved_and_completed ||
    input.businessState === state.rejected;
  const processingDone =
    input.businessState === state.processing_recorded ||
    input.businessState === state.completed ||
    input.businessState === state.under_review ||
    input.businessState === state.approved_and_completed ||
    input.businessState === state.rejected;
  const decided = input.decision !== undefined;

  return RecoveryRecordSchema.parse({
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    record_id: id,
    human_reference: input.reference,
    qr_payload: {
      contract_version: CONTRACT_SCHEMA_VERSION,
      record_id: id,
      lookup_token: `seedlookuptoken${input.index.toString().padStart(4, "0")}xxxxxxxxxx`,
    },
    revision: handoffDone ? 2 : 1,
    record_kind: input.kind ?? "item",
    category: input.category,
    item_count: 1,
    ...(input.weightKg ? { approximate_weight: { value: input.weightKg, unit: "kg" } } : {}),
    condition: input.condition,
    original_image_evidence_id: evidenceId(input.index * 10),
    collector: { actor_id: SEED_IDS.collector },
    captured_at: capturedAt,
    approximate_area: input.area,
    category_confirmation: {
      confirmed_category: input.category,
      confirmed_by: { actor_id: SEED_IDS.collector },
      confirmed_at: capturedAt,
      source: "manual_selection",
    },
    ...(input.locationIndex === undefined
      ? {}
      : {
          destination: {
            location_id: locationId(input.locationIndex),
            facility_type:
              input.locationIndex === 1 ? facility.collection_centre : facility.recycler,
            verification_status: "programme_verified",
            selected_at: capturedAt,
          },
        }),
    ...(handoffDone && input.locationIndex !== undefined
      ? {
          handoff: {
            recycler: { actor_id: SEED_IDS.recycler },
            receiving_location_id: locationId(input.locationIndex),
            confirmed_category: input.category,
            confirmed_condition: input.condition,
            measured_weight: { value: input.handoffWeightKg ?? 5, unit: "kg" },
            final_price: {
              amount: Math.round((input.handoffWeightKg ?? 5) * 1.4 * 100) / 100,
              currency: "USD",
            },
            handed_off_at: capturedAt,
            server_received_at: capturedAt,
            evidence_ids: [evidenceId(input.index * 10 + 1), evidenceId(input.index * 10 + 2)],
          },
        }
      : {}),
    ...(processingDone
      ? {
          processing: {
            recycler: { actor_id: SEED_IDS.recycler },
            method: "material_recovery",
            result: "Separated into copper, steel and non-recoverable fractions.",
            material_entries: [
              { material: "copper", weight: { value: 1.2, unit: "kg" } },
              { material: "steel", weight: { value: 2.4, unit: "kg" } },
            ],
            processed_at: capturedAt,
            evidence_ids: [evidenceId(input.index * 10 + 3)],
          },
        }
      : {}),
    review: {
      review_state: input.reviewState ?? review.not_required,
      flag_codes: input.flagCodes ?? [],
      evidence_considered: decided ? [evidenceId(input.index * 10)] : [],
      ...(decided
        ? {
            assigned_reviewer: { actor_id: SEED_IDS.reviewer },
            decision: input.decision,
            reason_code: input.decision === "approve" ? "EVIDENCE_COMPLETE" : "EVIDENCE_INCOMPLETE",
            reviewer_note: "Recorded during programme seeding.",
            decided_at: capturedAt,
          }
        : {}),
    },
    business_state: input.businessState,
    handoff_state: handoffDone
      ? "received"
      : input.businessState === state.awaiting_handoff
        ? "awaiting"
        : "not_started",
    processing_state: processingDone ? "completed" : "not_started",
    sync: {
      sync_state: "synchronized",
      device_instance_id: SEED_IDS.device,
      local_revision: handoffDone ? 2 : 1,
      server_revision: handoffDone ? 2 : 1,
    },
    created_at: capturedAt,
    updated_at: capturedAt,
  });
};

const SEED_RECORDS: readonly RecoveryRecord[] = [
  buildRecord({
    index: 1,
    reference: "ST-0941TVGH",
    category: "televisions",
    condition: "damaged",
    area: AREAS[0],
    capturedOn: "2026-09-16",
    businessState: state.approved_and_completed,
    handoffWeightKg: 12.8,
    locationIndex: 1,
    reviewState: review.approved,
    decision: "approve",
  }),
  buildRecord({
    index: 2,
    reference: "ST-0832LPGH",
    category: "laptops_and_desktop_computers",
    condition: "repairable",
    area: AREAS[0],
    capturedOn: "2026-09-18",
    businessState: state.under_review,
    handoffWeightKg: 2.4,
    locationIndex: 3,
    reviewState: review.open,
    flagCodes: ["WEIGHT_DISCREPANCY"],
  }),
  buildRecord({
    index: 3,
    reference: "ST-0192MXGH",
    category: "mixed_scrap",
    kind: "batch",
    condition: "unknown",
    area: AREAS[1],
    capturedOn: "2026-09-20",
    businessState: state.awaiting_handoff,
    weightKg: 48.5,
    locationIndex: 2,
  }),
  buildRecord({
    index: 4,
    reference: "ST-0776CPGH",
    category: "compressors",
    condition: "working",
    area: AREAS[1],
    capturedOn: "2026-09-22",
    businessState: state.received,
    handoffWeightKg: 18.2,
    locationIndex: 2,
  }),
  buildRecord({
    index: 5,
    reference: "ST-0655MWGH",
    category: "microwaves",
    condition: "damaged",
    area: AREAS[2],
    capturedOn: "2026-09-12",
    businessState: state.rejected,
    handoffWeightKg: 9.1,
    locationIndex: 3,
    reviewState: review.rejected,
    decision: "reject",
  }),
  buildRecord({
    index: 6,
    reference: "ST-0612ACGH",
    category: "air_conditioners",
    condition: "damaged",
    area: AREAS[2],
    capturedOn: "2026-09-14",
    businessState: state.approved_and_completed,
    handoffWeightKg: 21.6,
    locationIndex: 1,
    reviewState: review.approved,
    decision: "approve",
  }),
];

const seedEvent = (
  index: number,
  record: RecoveryRecord,
  type: RecoveryRecordEvent["event_type"],
  actorRole: RecoveryRecordEvent["actor_role"],
  previous: RecoveryRecord["business_state"],
  resulting: RecoveryRecord["business_state"],
): RecoveryRecordEvent => ({
  event_schema_version: EVENT_SCHEMA_VERSION,
  event_id: EventIdSchema.parse(eventId(index)),
  recovery_record_id: record.record_id,
  event_type: type,
  actor_role: actorRole,
  occurred_at: record.captured_at,
  previous_state: previous,
  resulting_state: resulting,
});

/** One event per seeded transition, so the reviewer's history screen is not empty. */
const seedEvents = (): readonly RecoveryRecordEvent[] => {
  const collector = UserRoleSchema.enum.collector;
  const recycler = UserRoleSchema.enum.recycler;
  const reviewer = UserRoleSchema.enum.programme_reviewer;
  const events: RecoveryRecordEvent[] = [];
  let index = 1;
  for (const record of SEED_RECORDS) {
    events.push(
      seedEvent(index++, record, event.submit_record, collector, state.draft, state.submitted),
    );
    events.push(
      seedEvent(
        index++,
        record,
        event.publish_for_handoff,
        collector,
        state.submitted,
        state.awaiting_handoff,
      ),
    );
    if (record.handoff) {
      events.push(
        seedEvent(
          index++,
          record,
          event.record_handoff,
          recycler,
          state.awaiting_handoff,
          state.received,
        ),
      );
    }
    if (record.processing) {
      events.push(
        seedEvent(
          index++,
          record,
          event.record_processing,
          recycler,
          state.received,
          state.processing_recorded,
        ),
      );
    }
    if (record.review.decision === "approve") {
      events.push(
        seedEvent(
          index++,
          record,
          event.approve_review,
          reviewer,
          state.under_review,
          state.approved_and_completed,
        ),
      );
    }
    if (record.review.decision === "reject") {
      events.push(
        seedEvent(
          index++,
          record,
          event.reject_review,
          reviewer,
          state.under_review,
          state.rejected,
        ),
      );
    }
    if (record.business_state === state.under_review) {
      events.push(
        seedEvent(
          index++,
          record,
          event.flag_for_review,
          "system",
          state.processing_recorded,
          state.under_review,
        ),
      );
    }
  }
  return events.reverse();
};

const SEED_DIRECTORY: ProgrammeState["directory"] = [
  {
    key: "riverside",
    records: 184,
    location: {
      location_id: locationId(1),
      name: "Riverside Collection Centre",
      facility_type: facility.collection_centre,
      accepted_categories: ["laptops_and_desktop_computers", "televisions", "mixed_scrap"],
      verification_status: "programme_verified",
      verification_date: "2026-08-14",
      coordinates: { latitude: 5.6037, longitude: -0.187, source: "facility" },
      distance_km: 1.8,
      opening_information: "Monday to Saturday, 08:00–17:00",
      last_reviewed_at: at("2026-08-14"),
      data_source: "cached_directory",
    },
  },
  {
    key: "northYard",
    records: 31,
    location: {
      location_id: locationId(2),
      name: "North Industrial Scrapyard",
      facility_type: facility.scrapyard,
      accepted_categories: ["compressors", "refrigerators", "mixed_scrap"],
      verification_status: "unverified",
      coordinates: { latitude: 6.6885, longitude: -1.6244, source: "facility" },
      distance_km: 4.6,
      opening_information: "Monday to Friday, 07:00–16:00",
      last_reviewed_at: at("2026-05-02"),
      data_source: "cached_directory",
    },
  },
  {
    key: "metroWorks",
    records: 97,
    location: {
      location_id: locationId(3),
      name: "Metro Material Works",
      facility_type: facility.recycler,
      accepted_categories: ["laptops_and_desktop_computers", "air_conditioners", "microwaves"],
      verification_status: "programme_verified",
      verification_date: "2026-09-01",
      coordinates: { latitude: 5.5502, longitude: -0.2174, source: "facility" },
      distance_km: 7.2,
      opening_information: "Tuesday to Saturday, 09:00–18:00",
      last_reviewed_at: at("2026-09-01"),
      data_source: "cached_directory",
    },
  },
];

/**
 * Approved safety answers, per card and language. A language without answers here is not served
 * as approved guidance: the safety service returns its safe fallback instead, which is the
 * behaviour the contract requires and not a gap in this store.
 */
const MERCURY_ANSWERS = {
  en: {
    what_is_it: "A television or monitor whose backlight tubes can contain mercury vapour.",
    possible_dangers: "A broken tube releases mercury vapour and sharp coated glass.",
    prohibited_actions: "Do not break the screen, burn the unit, or sweep broken glass by hand.",
    safe_actions_now: "Ventilate the area, keep people away, and move the unit whole and upright.",
    suitable_destination: "Hand the unit over whole at a programme-verified receiving location.",
  },
  fr: {
    what_is_it:
      "Un téléviseur ou un écran dont les tubes de rétroéclairage peuvent contenir du mercure.",
    possible_dangers: "Un tube brisé libère des vapeurs de mercure et du verre coupant.",
    prohibited_actions:
      "Ne brisez pas l'écran, ne brûlez pas l'appareil et ne balayez pas le verre à la main.",
    safe_actions_now:
      "Aérez la zone, éloignez les personnes et déplacez l'appareil entier et debout.",
    suitable_destination:
      "Remettez l'appareil entier à un lieu de réception vérifié par le programme.",
  },
  pt: {
    what_is_it: "Um televisor ou monitor cujos tubos de retroiluminação podem conter mercúrio.",
    possible_dangers: "Um tubo partido liberta vapor de mercúrio e vidro cortante.",
    prohibited_actions: "Não parta o ecrã, não queime o aparelho e não varra o vidro com as mãos.",
    safe_actions_now:
      "Ventile o espaço, afaste as pessoas e mova o aparelho inteiro e na vertical.",
    suitable_destination:
      "Entregue o aparelho inteiro num local de receção verificado pelo programa.",
  },
  ar: {
    what_is_it: "تلفاز أو شاشة قد تحتوي أنابيب إضاءتها الخلفية على بخار الزئبق.",
    possible_dangers: "يُطلق الأنبوب المكسور بخار الزئبق وزجاجاً حاداً مطلياً.",
    prohibited_actions: "لا تكسر الشاشة ولا تحرق الجهاز ولا تكنس الزجاج المكسور باليد.",
    safe_actions_now: "هوّ المكان وأبعد الناس وانقل الجهاز كاملاً وقائماً.",
    suitable_destination: "سلّم الجهاز كاملاً إلى موقع استلام معتمد من البرنامج.",
  },
} as const;

const LITHIUM_ANSWERS = {
  en: {
    what_is_it: "A laptop or desktop computer, usually with a lithium battery inside.",
    possible_dangers: "A swollen or pierced battery can overheat and catch fire.",
    prohibited_actions: "Do not pierce, crush, charge or store a swollen battery indoors.",
    safe_actions_now:
      "Keep the device dry and cool, away from other waste, and do not stack weight on it.",
    suitable_destination: "Take it to a programme-verified recycler that accepts battery devices.",
  },
  fr: {
    what_is_it:
      "Un ordinateur portable ou de bureau, contenant généralement une batterie au lithium.",
    possible_dangers: "Une batterie gonflée ou percée peut surchauffer et prendre feu.",
    prohibited_actions:
      "Ne percez pas, n'écrasez pas, ne chargez pas et ne stockez pas une batterie gonflée à l'intérieur.",
    safe_actions_now:
      "Gardez l'appareil au sec et au frais, à l'écart des autres déchets, sans poids dessus.",
    suitable_destination:
      "Apportez-le à un recycleur vérifié qui accepte les appareils à batterie.",
  },
  pt: {
    what_is_it: "Um computador portátil ou de secretária, normalmente com bateria de lítio.",
    possible_dangers: "Uma bateria inchada ou perfurada pode sobreaquecer e incendiar-se.",
    prohibited_actions:
      "Não perfure, esmague, carregue nem guarde uma bateria inchada em espaços fechados.",
    safe_actions_now:
      "Mantenha o aparelho seco e fresco, longe de outros resíduos e sem peso por cima.",
    suitable_destination: "Leve-o a um reciclador verificado que aceite aparelhos com bateria.",
  },
  ar: {
    what_is_it: "حاسوب محمول أو مكتبي يحتوي عادةً على بطارية ليثيوم.",
    possible_dangers: "قد ترتفع حرارة البطارية المنتفخة أو المثقوبة وتشتعل.",
    prohibited_actions: "لا تثقب البطارية المنتفخة ولا تسحقها ولا تشحنها ولا تخزّنها في مكان مغلق.",
    safe_actions_now: "احفظ الجهاز جافاً وبارداً بعيداً عن بقية النفايات ولا تضع أثقالاً فوقه.",
    suitable_destination: "خذه إلى منشأة تدوير معتمدة تقبل الأجهزة ذات البطاريات.",
  },
} as const;

const MIXED_ANSWERS = {
  en: {
    what_is_it: "A mixed batch of scrap whose individual items have not been identified.",
    possible_dangers: "A batch can hide batteries, sharp metal and broken coated glass.",
    prohibited_actions: "Do not burn the batch, and do not sort it with bare hands.",
    safe_actions_now: "Wear gloves, keep the batch dry and separate any swollen battery you find.",
    suitable_destination: "Deliver the batch to a programme-verified scrapyard or recycler.",
  },
} as const;

const SEED_CARDS: ProgrammeState["safetyCards"] = [
  {
    id: cardId(1),
    titleKey: "mercury",
    category: "televisions",
    version: "2.0.0",
    status: "approved",
    author: "SC-07",
    approvedBy: "SC-02",
    publishedOn: "2026-07-12",
    reviewOn: "2027-07-12",
    languages: {
      [language.en]: "approved",
      [language.fr]: "approved",
      [language.pt]: "approved",
      [language.ar]: "approved",
    },
    answers: MERCURY_ANSWERS,
  },
  {
    id: cardId(2),
    titleKey: "lead",
    category: "laptops_and_desktop_computers",
    version: "1.4.0",
    status: "approved",
    author: "SC-04",
    approvedBy: "SC-02",
    publishedOn: "2026-06-04",
    reviewOn: "2027-06-04",
    languages: {
      [language.en]: "approved",
      [language.fr]: "approved",
      [language.pt]: "approved",
      [language.ar]: "approved",
    },
    answers: LITHIUM_ANSWERS,
  },
  {
    id: cardId(3),
    titleKey: "lithium",
    category: "laptops_and_desktop_computers",
    version: "0.3.0",
    status: "inReview",
    author: "SC-11",
    submittedOn: "2026-09-19",
    languages: { [language.en]: "inReview" },
    answers: {},
  },
  {
    id: cardId(4),
    titleKey: "mixed",
    category: "mixed_scrap",
    version: "1.0.0",
    status: "approved",
    author: "SC-04",
    approvedBy: "SC-02",
    publishedOn: "2026-05-20",
    reviewOn: "2027-05-20",
    languages: {
      [language.en]: "approved",
      [language.fr]: "draft",
      [language.pt]: "draft",
      [language.ar]: "draft",
    },
    answers: MIXED_ANSWERS,
  },
];

const SEED_LABELS: ProgrammeState["labels"] = [
  {
    id: evidenceId(91),
    category: "pcbHigh",
    reviewer: "ML-03",
    approvedOn: "2026-09-18",
    corrected: true,
  },
  {
    id: evidenceId(92),
    category: "batteries",
    reviewer: "ML-01",
    approvedOn: "2026-09-17",
    corrected: false,
  },
  {
    id: evidenceId(93),
    category: "glass",
    reviewer: "ML-03",
    approvedOn: "2026-09-15",
    corrected: true,
  },
  {
    id: evidenceId(94),
    category: "pcbLow",
    reviewer: "ML-02",
    approvedOn: "2026-09-12",
    corrected: false,
  },
];

export const createSeedState = (): ProgrammeState => ({
  schemaVersion: 1,
  deviceInstanceId: SEED_IDS.device,
  session: null,
  records: SEED_RECORDS,
  events: seedEvents(),
  queue: [],
  directory: SEED_DIRECTORY,
  safetyCards: SEED_CARDS,
  labels: SEED_LABELS,
  exports: [
    {
      id: "EX-0042",
      scopeKey: "approvedLabels",
      status: "ready",
      requestedOn: "2026-09-20",
      rows: 1284,
    },
    {
      id: "EX-0038",
      scopeKey: "modelMetrics",
      status: "failed",
      requestedOn: "2026-09-11",
      rows: 0,
    },
  ],
  prices: [
    { key: "copper", pricePerKg: 7.4, sourceKey: "nationalIndex", updatedOn: "2026-09-18" },
    { key: "aluminium", pricePerKg: 1.85, sourceKey: "nationalIndex", updatedOn: "2026-09-18" },
    { key: "leadGlass", pricePerKg: 0.12, sourceKey: "regionalSurvey", updatedOn: "2026-08-30" },
    { key: "goldBearing", pricePerKg: 21.6, sourceKey: "regionalSurvey", updatedOn: "2026-08-30" },
  ],
  settings: {
    defaultLanguage: language.en,
    retentionDays: 30,
    weightUnit: "kg",
    reviewAlerts: true,
    weeklyDigest: false,
  },
  facility: { intakeAlerts: false, weeklySummary: false },
  consent: { trainingReuse: false },
});
