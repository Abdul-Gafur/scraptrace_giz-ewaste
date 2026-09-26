import {
  FacilityTypeSchema,
  RecoveryRecordEventTypeSchema,
  RecoveryRecordStateSchema,
  type RecoveryRecordEventType,
  type RecoveryRecordState,
} from "@scraptrace/contracts";

/**
 * Fictional sample records taken from the approved Figma frames and, for the screens the
 * frames do not cover, written against the same contracts. Identifiers are opaque display
 * labels; all descriptive text lives in the `samples` message namespace.
 */

/** The contract does not export this inferred type; it is derived here rather than restated. */
export type FacilityType = (typeof FacilityTypeSchema.options)[number];

const state = RecoveryRecordStateSchema.enum;
const facility = FacilityTypeSchema.enum;
const event = RecoveryRecordEventTypeSchema.enum;

export const SAMPLE_RECORDS = [
  {
    key: "leadAcid",
    id: "ST-0941",
    status: "pending_synchronization",
    reviewStatus: "awaiting_handoff",
    gps: "verified_gps",
  },
  {
    key: "crt",
    id: "ST-0832",
    status: "action_required",
    reviewStatus: "action_required",
    gps: "unverified_gps",
  },
  {
    key: "telecom",
    id: "ST-0192",
    status: "synchronized",
    reviewStatus: "synchronized",
    gps: "verified_gps",
  },
] as const;

export type SampleRecord = (typeof SAMPLE_RECORDS)[number];

/** Message key under `samples.locations`, plus the facts a directory entry carries. */
export interface SampleLocation {
  readonly key: string;
  readonly type: FacilityType;
  readonly distanceKm: number;
  readonly verified: boolean;
  readonly reviewedOn: string;
}

export const SAMPLE_LOCATIONS: readonly SampleLocation[] = [
  {
    key: "riverside",
    type: facility.collection_centre,
    distanceKm: 1.8,
    verified: true,
    reviewedOn: "2026-08-14",
  },
  {
    key: "northYard",
    type: facility.scrapyard,
    distanceKm: 4.6,
    verified: false,
    reviewedOn: "2026-05-02",
  },
  {
    key: "metroWorks",
    type: facility.recycler,
    distanceKm: 7.2,
    verified: true,
    reviewedOn: "2026-09-01",
  },
];

/** Batches a receiving facility has taken in or is still expecting. */
export interface SampleHandoff {
  readonly id: string;
  readonly key: SampleRecord["key"];
  readonly node: string;
  readonly weightKg: number;
  readonly state: RecoveryRecordState;
  readonly receivedOn: string;
}

export const SAMPLE_HANDOFFS: readonly SampleHandoff[] = [
  {
    id: "ST-0941",
    key: "leadAcid",
    node: "ST-CN-88029",
    weightKg: 5,
    state: state.awaiting_handoff,
    receivedOn: "2026-09-24",
  },
  {
    id: "ST-0832",
    key: "crt",
    node: "ST-CN-88030",
    weightKg: 12.8,
    state: state.under_review,
    receivedOn: "2026-09-23",
  },
  {
    id: "ST-0192",
    key: "telecom",
    node: "ST-CN-88012",
    weightKg: 2.4,
    state: state.received,
    receivedOn: "2026-09-22",
  },
];

export type ProcessingMethodKey = "materialRecovery" | "safeStorage" | "reuseReferral";

export interface SampleProcessingBatch {
  readonly id: string;
  readonly key: SampleRecord["key"];
  readonly method: ProcessingMethodKey;
  readonly progress: number;
  readonly state: RecoveryRecordState;
  readonly operator: string;
}

export const SAMPLE_PROCESSING: readonly SampleProcessingBatch[] = [
  {
    id: "ST-0192",
    key: "telecom",
    method: "materialRecovery",
    progress: 65,
    state: state.processing_recorded,
    operator: "RY-9921-EM",
  },
  {
    id: "ST-0941",
    key: "leadAcid",
    method: "safeStorage",
    progress: 20,
    state: state.received,
    operator: "RY-9921-EM",
  },
];

export interface SampleAssignment {
  readonly id: string;
  readonly key: SampleRecord["key"];
  readonly priority: "high" | "normal";
  readonly dueOn: string;
  readonly state: RecoveryRecordState;
}

export const SAMPLE_ASSIGNMENTS: readonly SampleAssignment[] = [
  { id: "ST-0832", key: "crt", priority: "high", dueOn: "2026-09-27", state: state.under_review },
  {
    id: "ST-0941",
    key: "leadAcid",
    priority: "normal",
    dueOn: "2026-09-30",
    state: state.awaiting_handoff,
  },
  {
    id: "ST-0192",
    key: "telecom",
    priority: "normal",
    dueOn: "2026-10-02",
    state: state.processing_recorded,
  },
];

export type DecisionKey = "approve" | "reject" | "requestCorrection";

export interface SampleDecision {
  readonly id: string;
  readonly key: SampleRecord["key"];
  readonly decision: DecisionKey;
  readonly reviewer: string;
  readonly decidedOn: string;
}

export const SAMPLE_DECISIONS: readonly SampleDecision[] = [
  {
    id: "ST-0192",
    key: "telecom",
    decision: "approve",
    reviewer: "RV-04",
    decidedOn: "2026-09-21",
  },
  {
    id: "ST-0832",
    key: "crt",
    decision: "requestCorrection",
    reviewer: "RV-02",
    decidedOn: "2026-09-19",
  },
  {
    id: "ST-0655",
    key: "leadAcid",
    decision: "reject",
    reviewer: "RV-04",
    decidedOn: "2026-09-16",
  },
];

export interface SampleEvent {
  readonly id: string;
  readonly recordId: string;
  readonly type: RecoveryRecordEventType;
  readonly actorKey: "collectorNode" | "receivingFacility" | "reviewer" | "system";
  readonly occurredOn: string;
}

export const SAMPLE_EVENTS: readonly SampleEvent[] = [
  {
    id: "EV-0051",
    recordId: "ST-0192",
    type: event.approve_review,
    actorKey: "reviewer",
    occurredOn: "2026-09-21",
  },
  {
    id: "EV-0050",
    recordId: "ST-0192",
    type: event.mark_processing_complete,
    actorKey: "receivingFacility",
    occurredOn: "2026-09-20",
  },
  {
    id: "EV-0049",
    recordId: "ST-0832",
    type: event.flag_for_review,
    actorKey: "system",
    occurredOn: "2026-09-19",
  },
  {
    id: "EV-0048",
    recordId: "ST-0832",
    type: event.record_handoff,
    actorKey: "receivingFacility",
    occurredOn: "2026-09-18",
  },
  {
    id: "EV-0047",
    recordId: "ST-0941",
    type: event.submit_record,
    actorKey: "collectorNode",
    occurredOn: "2026-09-17",
  },
];

export interface SampleLedgerEntry {
  readonly id: string;
  readonly categoryKey: "batteries" | "screens" | "boards" | "appliances";
  readonly area: string;
  readonly weightKg: number;
  readonly state: RecoveryRecordState;
}

export const SAMPLE_LEDGER: readonly SampleLedgerEntry[] = [
  {
    id: "ST-0941",
    categoryKey: "batteries",
    area: "Kumasi North",
    weightKg: 5,
    state: state.awaiting_handoff,
  },
  {
    id: "ST-0832",
    categoryKey: "screens",
    area: "Kumasi North",
    weightKg: 12.8,
    state: state.under_review,
  },
  {
    id: "ST-0192",
    categoryKey: "boards",
    area: "Accra East",
    weightKg: 2.4,
    state: state.approved_and_completed,
  },
  {
    id: "ST-0776",
    categoryKey: "appliances",
    area: "Accra East",
    weightKg: 48.5,
    state: state.received,
  },
  {
    id: "ST-0655",
    categoryKey: "screens",
    area: "Tamale Central",
    weightKg: 9.1,
    state: state.rejected,
  },
  {
    id: "ST-0612",
    categoryKey: "boards",
    area: "Tamale Central",
    weightKg: 1.6,
    state: state.approved_and_completed,
  },
];

export interface SampleDirectoryEntry {
  readonly key: string;
  readonly type: FacilityType;
  readonly verified: boolean;
  readonly records: number;
  readonly reviewedOn: string;
}

export const SAMPLE_DIRECTORY: readonly SampleDirectoryEntry[] = [
  {
    key: "riverside",
    type: facility.collection_centre,
    verified: true,
    records: 184,
    reviewedOn: "2026-08-14",
  },
  {
    key: "metroWorks",
    type: facility.recycler,
    verified: true,
    records: 97,
    reviewedOn: "2026-09-01",
  },
  {
    key: "northYard",
    type: facility.scrapyard,
    verified: false,
    records: 31,
    reviewedOn: "2026-05-02",
  },
];

export interface SamplePriceReference {
  readonly key: "copper" | "aluminium" | "leadGlass" | "goldBearing";
  readonly pricePerKg: number;
  readonly sourceKey: "nationalIndex" | "regionalSurvey";
  readonly updatedOn: string;
}

export const SAMPLE_PRICES: readonly SamplePriceReference[] = [
  { key: "copper", pricePerKg: 7.4, sourceKey: "nationalIndex", updatedOn: "2026-09-18" },
  { key: "aluminium", pricePerKg: 1.85, sourceKey: "nationalIndex", updatedOn: "2026-09-18" },
  { key: "leadGlass", pricePerKg: 0.12, sourceKey: "regionalSurvey", updatedOn: "2026-08-30" },
  { key: "goldBearing", pricePerKg: 21.6, sourceKey: "regionalSurvey", updatedOn: "2026-08-30" },
];

export type SafetyCardKey = "mercury" | "lead" | "lithium";
export type WorkflowStatus = "approved" | "inReview" | "draft";

export interface SampleTranslation {
  readonly card: SafetyCardKey;
  readonly language: "en" | "fr" | "pt" | "ar";
  readonly status: WorkflowStatus;
  readonly updatedOn: string;
}

export const SAMPLE_TRANSLATIONS: readonly SampleTranslation[] = [
  { card: "mercury", language: "en", status: "approved", updatedOn: "2026-07-12" },
  { card: "mercury", language: "fr", status: "inReview", updatedOn: "2026-09-10" },
  { card: "mercury", language: "ar", status: "draft", updatedOn: "2026-09-15" },
  { card: "lead", language: "en", status: "approved", updatedOn: "2026-06-04" },
  { card: "lead", language: "pt", status: "approved", updatedOn: "2026-08-22" },
  { card: "lithium", language: "en", status: "inReview", updatedOn: "2026-09-19" },
];

export interface SampleApproval {
  readonly card: SafetyCardKey;
  readonly author: string;
  readonly submittedOn: string;
  readonly version: string;
}

export const SAMPLE_APPROVALS: readonly SampleApproval[] = [
  { card: "lithium", author: "SC-11", submittedOn: "2026-09-19", version: "0.3.0" },
  { card: "mercury", author: "SC-07", submittedOn: "2026-09-10", version: "2.1.0" },
];

export interface SamplePublishedCard {
  readonly card: SafetyCardKey;
  readonly version: string;
  readonly languages: number;
  readonly publishedOn: string;
  readonly reviewOn: string;
}

export const SAMPLE_PUBLISHED: readonly SamplePublishedCard[] = [
  {
    card: "mercury",
    version: "2.0.0",
    languages: 2,
    publishedOn: "2026-07-12",
    reviewOn: "2027-07-12",
  },
  {
    card: "lead",
    version: "1.4.0",
    languages: 3,
    publishedOn: "2026-06-04",
    reviewOn: "2027-06-04",
  },
];

export type LabelCategoryKey = "pcbHigh" | "pcbLow" | "batteries" | "glass";

export interface SampleLabel {
  readonly id: string;
  readonly category: LabelCategoryKey;
  readonly reviewer: string;
  readonly approvedOn: string;
  readonly corrected: boolean;
}

export const SAMPLE_LABELS: readonly SampleLabel[] = [
  {
    id: "EV-2291",
    category: "pcbHigh",
    reviewer: "ML-03",
    approvedOn: "2026-09-18",
    corrected: true,
  },
  {
    id: "EV-2288",
    category: "batteries",
    reviewer: "ML-01",
    approvedOn: "2026-09-17",
    corrected: false,
  },
  {
    id: "EV-2280",
    category: "glass",
    reviewer: "ML-03",
    approvedOn: "2026-09-15",
    corrected: true,
  },
  {
    id: "EV-2274",
    category: "pcbLow",
    reviewer: "ML-02",
    approvedOn: "2026-09-12",
    corrected: false,
  },
];

export const SAMPLE_MODEL = {
  version: "1.3.0",
  trainedOn: "2026-06-30",
  evaluatedOn: "2026-07-08",
  imageCount: 18_400,
  precisionByCategory: [
    { category: "pcbHigh", value: 96 },
    { category: "pcbLow", value: 91 },
    { category: "batteries", value: 94 },
    { category: "glass", value: 88 },
  ],
} as const satisfies {
  version: string;
  trainedOn: string;
  evaluatedOn: string;
  imageCount: number;
  precisionByCategory: readonly { category: LabelCategoryKey; value: number }[];
};

export interface SampleExport {
  readonly id: string;
  readonly scopeKey: "approvedLabels" | "verifiedOutcomes" | "modelMetrics";
  readonly status: "ready" | "running" | "failed";
  readonly requestedOn: string;
  readonly rows: number;
}

export const SAMPLE_EXPORTS: readonly SampleExport[] = [
  {
    id: "EX-0042",
    scopeKey: "approvedLabels",
    status: "ready",
    requestedOn: "2026-09-20",
    rows: 1_284,
  },
  {
    id: "EX-0041",
    scopeKey: "verifiedOutcomes",
    status: "running",
    requestedOn: "2026-09-24",
    rows: 0,
  },
  { id: "EX-0038", scopeKey: "modelMetrics", status: "failed", requestedOn: "2026-09-11", rows: 0 },
];
