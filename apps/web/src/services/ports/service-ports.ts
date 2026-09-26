import type {
  EwasteCategory,
  ItemCondition,
  Permission,
  PriceEstimate,
  QueuedMutation,
  RecoveryRecord,
  RecoveryRecordEvent,
  SupportedLanguage,
  UserRole,
} from "@scraptrace/contracts";
import {
  HandoffRequestSchema,
  HandoffResponseSchema,
  LocationSearchRequestSchema,
  LocationSearchResponseSchema,
  ProcessingRequestSchema,
  ProcessingResponseSchema,
  ProgrammeReviewRequestSchema,
  ProgrammeReviewResponseSchema,
  ReportingFiltersSchema,
  ReportingSummarySchema,
  SafetyGuidanceRequestSchema,
  SafetyGuidanceResponseSchema,
  SyncBatchRequestSchema,
  SyncBatchResponseSchema,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
} from "@scraptrace/contracts";
import type { z } from "zod";

export interface Session {
  readonly actorId: string;
  readonly role: UserRole;
  readonly preferredLanguage: SupportedLanguage;
  readonly displayLabel: string;
  readonly developmentOnly: boolean;
}

export interface AuthenticationService {
  getSession(): Promise<Session | null>;
  /** Development sign-in: chooses the role whose workspace to open. It grants no access. */
  signIn(role: UserRole, preferredLanguage: SupportedLanguage): Promise<Session>;
  signOut(): Promise<void>;
}

/** What a collector supplies when a capture becomes a record. */
export interface CaptureDraftInput {
  readonly category: EwasteCategory;
  readonly condition: ItemCondition;
  readonly itemCount: number;
  readonly approximateWeightKg?: number;
  readonly evidenceId: string;
  readonly areaLabel: string;
  readonly countryCode: string;
  readonly coordinates?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracyMetres?: number;
  };
  readonly destinationLocationId?: string;
  readonly vision?: RecoveryRecord["vision_result"];
  readonly confirmationSource: RecoveryRecord["category_confirmation"]["source"];
  readonly correctionReason?: string;
  readonly estimate?: PriceEstimate;
  readonly safetyGuide?: RecoveryRecord["safety_guide"];
}

export interface RecoveryRecordService {
  listOwn(): Promise<readonly RecoveryRecord[]>;
  /** Every record the calling role may see. Backend authorization decides the real scope. */
  list(): Promise<readonly RecoveryRecord[]>;
  getById(recordId: string): Promise<RecoveryRecord | null>;
  saveDraft(record: unknown): Promise<RecoveryRecord>;
  /** Creates a local draft from a capture. Offline-safe: it never needs the network. */
  create(input: CaptureDraftInput): Promise<RecoveryRecord>;
  /** Draft to submitted, then published for handoff so a receiving facility can accept it. */
  submit(recordId: string): Promise<RecoveryRecord>;
  /** Resolves a human reference or an opaque QR lookup token to a record. */
  lookup(code: string): Promise<RecoveryRecord | null>;
  /** Recorded state transitions, newest first. */
  events(): Promise<readonly RecoveryRecordEvent[]>;
}

export interface EvidenceService {
  /** Stores a captured photograph on the device and returns its evidence id. */
  store(file: File): Promise<string>;
  read(evidenceId: string): Promise<string | null>;
}

export interface PriceService {
  /** Indicative only. Never an offer, and never shown to a collector as a payment. */
  estimate(input: {
    category: EwasteCategory;
    condition: ItemCondition;
    itemCount?: number;
    approximateWeightKg?: number;
  }): Promise<PriceEstimate>;
}

export type SafetyCardStatus = "draft" | "inReview" | "approved";

export interface SafetyCardSummary {
  readonly id: string;
  readonly titleKey?: string;
  readonly title?: string;
  readonly category: EwasteCategory;
  readonly version: string;
  readonly status: SafetyCardStatus;
  readonly author: string;
  readonly protectiveGear?: string;
  readonly submittedOn?: string;
  readonly approvedBy?: string;
  readonly publishedOn?: string;
  readonly reviewOn?: string;
  readonly languages: Partial<Record<SupportedLanguage, SafetyCardStatus>>;
}

export interface SafetyContentService {
  listCards(): Promise<readonly SafetyCardSummary[]>;
  /** Creates a card and submits it for a second administrator to approve. */
  createCard(input: {
    title: string;
    protectiveGear: string;
    category: EwasteCategory;
    author: string;
  }): Promise<SafetyCardSummary>;
  /** Approval is refused when the approver authored the card (separation of duties). */
  approve(cardId: string, approver: string): Promise<SafetyCardSummary>;
  requestChanges(cardId: string, approver: string): Promise<SafetyCardSummary>;
  requestTranslationReview(cardId: string, language: SupportedLanguage): Promise<SafetyCardSummary>;
}

export interface ApprovedLabelSummary {
  readonly id: string;
  readonly category: "pcbHigh" | "pcbLow" | "batteries" | "glass";
  readonly reviewer: string;
  readonly approvedOn: string;
  readonly corrected: boolean;
}

export interface ModelLabelService {
  list(): Promise<readonly ApprovedLabelSummary[]>;
  /** A committed label joins the reviewed dataset. It never retrains a model by itself. */
  commit(input: {
    category: ApprovedLabelSummary["category"];
    reviewer: string;
    corrected: boolean;
  }): Promise<ApprovedLabelSummary>;
}

export interface ExportJobSummary {
  readonly id: string;
  readonly scopeKey: "approvedLabels" | "verifiedOutcomes" | "modelMetrics";
  readonly status: "ready" | "running" | "failed";
  readonly requestedOn: string;
  readonly rows: number;
}

export interface DataExportService {
  list(): Promise<readonly ExportJobSummary[]>;
  request(scopeKey: ExportJobSummary["scopeKey"]): Promise<ExportJobSummary>;
  /** Comma-separated rows for a ready export, built from records the role may see. */
  build(scopeKey: ExportJobSummary["scopeKey"]): Promise<string>;
}

export interface ProgrammeSettingsValues {
  readonly defaultLanguage: SupportedLanguage;
  readonly retentionDays: number;
  readonly weightUnit: "kg" | "g";
  readonly reviewAlerts: boolean;
  readonly weeklyDigest: boolean;
}

export interface FacilitySettingsValues {
  readonly intakeAlerts: boolean;
  readonly weeklySummary: boolean;
}

export interface SettingsService {
  getProgramme(): Promise<ProgrammeSettingsValues>;
  saveProgramme(values: ProgrammeSettingsValues): Promise<ProgrammeSettingsValues>;
  getFacility(): Promise<FacilitySettingsValues>;
  saveFacility(values: FacilitySettingsValues): Promise<FacilitySettingsValues>;
}

export interface ConsentService {
  get(): Promise<{ trainingReuse: boolean; decidedAt?: string }>;
  set(trainingReuse: boolean): Promise<{ trainingReuse: boolean; decidedAt?: string }>;
}

export interface LocalDataSummary {
  readonly recordCount: number;
  readonly draftCount: number;
  readonly queuedMutationCount: number;
  readonly photographCount: number;
  readonly storedBytes: number;
}

export interface DeviceService {
  summary(): Promise<LocalDataSummary>;
  /** Removes local records, queued work and photographs from this device only. */
  clearLocalData(): Promise<LocalDataSummary>;
}

export interface OutboxService {
  pending(): Promise<readonly QueuedMutation[]>;
  /** Sends everything queued. Returns how many were accepted and how many still wait. */
  flush(): Promise<{ accepted: number; remaining: number }>;
}

export interface VisionService {
  appraise(
    request: z.infer<typeof VisionAppraisalRequestSchema>,
  ): Promise<z.infer<typeof VisionAppraisalResponseSchema>>;
}

export interface SafetyGuidanceService {
  getGuidance(
    request: z.infer<typeof SafetyGuidanceRequestSchema>,
  ): Promise<z.infer<typeof SafetyGuidanceResponseSchema>>;
}

export interface LocationService {
  search(
    request: z.infer<typeof LocationSearchRequestSchema>,
  ): Promise<z.infer<typeof LocationSearchResponseSchema>>;
}

export interface HandoffService {
  record(
    request: z.infer<typeof HandoffRequestSchema>,
  ): Promise<z.infer<typeof HandoffResponseSchema>>;
}

export interface ProcessingService {
  record(
    request: z.infer<typeof ProcessingRequestSchema>,
  ): Promise<z.infer<typeof ProcessingResponseSchema>>;
}

export interface ReviewService {
  decide(
    request: z.infer<typeof ProgrammeReviewRequestSchema>,
  ): Promise<z.infer<typeof ProgrammeReviewResponseSchema>>;
}

export interface ReportingService {
  summarize(
    filters: z.infer<typeof ReportingFiltersSchema>,
  ): Promise<z.infer<typeof ReportingSummarySchema>>;
}

export interface SynchronizationService {
  synchronize(
    request: z.infer<typeof SyncBatchRequestSchema>,
  ): Promise<z.infer<typeof SyncBatchResponseSchema>>;
}

export interface FrontendServices {
  readonly authentication: AuthenticationService;
  readonly recoveryRecords: RecoveryRecordService;
  readonly evidence: EvidenceService;
  readonly prices: PriceService;
  readonly safetyContent: SafetyContentService;
  readonly modelLabels: ModelLabelService;
  readonly dataExports: DataExportService;
  readonly settings: SettingsService;
  readonly consent: ConsentService;
  readonly device: DeviceService;
  readonly outbox: OutboxService;
  readonly vision: VisionService;
  readonly safetyGuidance: SafetyGuidanceService;
  readonly locations: LocationService;
  readonly handoffs: HandoffService;
  readonly processing: ProcessingService;
  readonly reviews: ReviewService;
  readonly reporting: ReportingService;
  readonly synchronization: SynchronizationService;
}

export interface RouteAuthorizationRequirement {
  readonly roles: readonly UserRole[];
  readonly permission?: Permission;
}
