import type {
  EwasteCategory,
  ParticipatingLocation,
  QueuedMutation,
  RecoveryRecord,
  RecoveryRecordEvent,
  SafetyQuestionAnswers,
  SupportedLanguage,
  UserRole,
} from "@scraptrace/contracts";

/**
 * Shape of the in-browser programme state. It stands in for the services a backend will own,
 * so everything it holds is either a contract object or a piece of local device state that the
 * frontend is responsible for on its own (settings, consent, the outbound mutation queue).
 */

export interface StoredSession {
  readonly actorId: string;
  readonly role: UserRole;
  readonly preferredLanguage: SupportedLanguage;
  readonly displayLabel: string;
  readonly developmentOnly: true;
  readonly signedInAt: string;
}

export interface DirectoryEntry {
  /** Key under `samples.locations` when the entry is seeded programme data. */
  readonly key: string;
  readonly location: ParticipatingLocation;
  /** Records this location has received, used by the manager directory. */
  readonly records: number;
}

export type WorkflowStatus = "approved" | "inReview" | "draft";

export interface SafetyCardEntry {
  readonly id: string;
  /** Key under `samples.safetyCards` for seeded cards; authored cards carry `title` instead. */
  readonly titleKey?: string;
  readonly title?: string;
  readonly category: EwasteCategory;
  readonly version: string;
  readonly status: WorkflowStatus;
  readonly author: string;
  readonly protectiveGear?: string;
  readonly submittedOn?: string;
  readonly approvedBy?: string;
  readonly publishedOn?: string;
  readonly reviewOn?: string;
  /** Per-language translation progress. The source language is always approved with the card. */
  readonly languages: Partial<Record<SupportedLanguage, WorkflowStatus>>;
  /** Approved answers per language. A language without answers is never served as guidance. */
  readonly answers: Partial<Record<SupportedLanguage, SafetyQuestionAnswers>>;
}

export type LabelCategoryKey = "pcbHigh" | "pcbLow" | "batteries" | "glass";

export interface ApprovedLabel {
  readonly id: string;
  readonly category: LabelCategoryKey;
  readonly reviewer: string;
  readonly approvedOn: string;
  /** True when a person changed the model's suggestion rather than confirming it. */
  readonly corrected: boolean;
}

export type ExportScopeKey = "approvedLabels" | "verifiedOutcomes" | "modelMetrics";

export interface ExportJob {
  readonly id: string;
  readonly scopeKey: ExportScopeKey;
  readonly status: "ready" | "running" | "failed";
  readonly requestedOn: string;
  readonly rows: number;
}

export interface PriceReference {
  readonly key: "copper" | "aluminium" | "leadGlass" | "goldBearing";
  readonly pricePerKg: number;
  readonly sourceKey: "nationalIndex" | "regionalSurvey";
  readonly updatedOn: string;
}

export interface ProgrammeSettings {
  readonly defaultLanguage: SupportedLanguage;
  readonly retentionDays: number;
  readonly weightUnit: "kg" | "g";
  readonly reviewAlerts: boolean;
  readonly weeklyDigest: boolean;
}

export interface FacilitySettings {
  readonly intakeAlerts: boolean;
  readonly weeklySummary: boolean;
}

export interface ConsentState {
  /** The optional training-reuse choice from the privacy step. */
  readonly trainingReuse: boolean;
  readonly decidedAt?: string;
}

export interface ProgrammeState {
  readonly schemaVersion: number;
  readonly deviceInstanceId: string;
  readonly session: StoredSession | null;
  readonly records: readonly RecoveryRecord[];
  readonly events: readonly RecoveryRecordEvent[];
  readonly queue: readonly QueuedMutation[];
  readonly directory: readonly DirectoryEntry[];
  readonly safetyCards: readonly SafetyCardEntry[];
  readonly labels: readonly ApprovedLabel[];
  readonly exports: readonly ExportJob[];
  readonly prices: readonly PriceReference[];
  readonly settings: ProgrammeSettings;
  readonly facility: FacilitySettings;
  readonly consent: ConsentState;
}
