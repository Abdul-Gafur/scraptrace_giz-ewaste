import type {
  Evidence,
  EwasteCategory,
  GeoCoordinates,
  Permission,
  RecoveryRecord,
  RecoveryRecordEvent,
  SupportedLanguage,
  UserRole,
  VisionResult,
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

import type {
  ModelConfiguration,
  ModelRegistryEntry,
  PredictionFeedback,
} from "@/services/domain/model-administration";
import type { ProgrammeSettings } from "@/services/domain/programme-settings";
import type { SafetyCard, SafetyCardStatus } from "@/services/domain/safety-content";

/**
 * Typed application-facing service boundary.
 *
 * Every implementation is bound to one acting session, so a service enforces the contract
 * permission rules for its own actor. Screens never pass a role, and hiding a control is never
 * the only thing standing between a user and a restricted mutation.
 */

export interface Session {
  readonly actorId: string;
  readonly role: UserRole;
  readonly preferredLanguage: SupportedLanguage;
  readonly displayLabel: string;
  readonly developmentOnly: boolean;
}

export interface SignInInput {
  readonly email?: string;
  readonly password?: string;
  /** Available only from the explicitly selected non-production mock adapter. */
  readonly demoRole?: UserRole;
}

export interface AuthenticationService {
  getSession(): Promise<Session | null>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
}

/** Capture input for a new collector record, before any lifecycle transition. */
export interface CaptureInput {
  readonly category: EwasteCategory;
  /** The language the collector read the safety guide in, recorded on the record's reference. */
  readonly language: SupportedLanguage;
  readonly condition: "working" | "repairable" | "damaged" | "unknown";
  readonly itemCount?: number;
  readonly approximateWeight?: { readonly value: number; readonly unit: "kg" | "g" };
  readonly areaLabel: string;
  readonly administrativeArea?: string;
  readonly captureLocation?: GeoCoordinates;
  readonly visionResult?: VisionResult;
  readonly confirmationSource: "accepted_prediction" | "manual_selection" | "human_correction";
  readonly correctionReason?: string;
  /** The accepted photograph. Its digest becomes the original-item-photo evidence digest. */
  readonly image: Blob;
  readonly imagePreview?: string;
  readonly offline: boolean;
  readonly destinationLocationId?: string;
  /** Capture time, when the photograph was taken before the record was saved (FR-OFF-001). */
  readonly capturedAt?: string;
}

export type SubmitOutcome =
  | { readonly outcome: "submitted"; readonly record: RecoveryRecord; readonly replayed: boolean }
  | {
      readonly outcome: "duplicate_image";
      readonly record: RecoveryRecord;
      readonly flagCodes: readonly string[];
    };

/** Result of resolving a scanned QR payload or a typed transfer code. */
export type HandoffLookupResult =
  | { readonly outcome: "ready"; readonly record: RecoveryRecord }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "not_ready"; readonly record: RecoveryRecord }
  | {
      readonly outcome: "already_received";
      readonly record: RecoveryRecord;
      readonly receivedAt: string;
    }
  | { readonly outcome: "other_facility"; readonly record: RecoveryRecord }
  | { readonly outcome: "unsupported_contract_version" };

export interface RecoveryRecordService {
  /** Records owned by the acting collector. */
  listOwn(): Promise<readonly RecoveryRecord[]>;
  /** Records the acting role may see operationally, already scoped. */
  listOperational(): Promise<readonly RecoveryRecord[]>;
  getById(recordId: string): Promise<RecoveryRecord | null>;
  saveDraft(record: unknown): Promise<RecoveryRecord>;
  createDraft(input: CaptureInput): Promise<RecoveryRecord>;
  submit(recordId: string): Promise<SubmitOutcome>;
  lookupForHandoff(scannedTextOrCode: string): Promise<HandoffLookupResult>;
  listEvents(recordId: string): Promise<readonly RecoveryRecordEvent[]>;
  listEvidence(recordId: string): Promise<readonly Evidence[]>;
  getEvidenceImage(evidenceId: string): Promise<string | null>;
}

export type VisionAppraisalUpload = z.infer<typeof VisionAppraisalRequestSchema> & {
  readonly image: Blob;
};

export interface VisionService {
  appraise(request: VisionAppraisalUpload): Promise<z.infer<typeof VisionAppraisalResponseSchema>>;
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

/** Everything the recycler intake form collects beyond the contract request fields. */
export interface HandoffEvidenceInput {
  readonly handoffPhoto: Blob;
  readonly handoffPhotoPreview?: string;
  readonly weightPhoto: Blob;
  readonly weightPhotoPreview?: string;
  /** Text of the scanned QR symbol, kept as the scan evidence for the handoff. */
  readonly scannedPayload: string;
  readonly notes?: string;
}

export interface RecordHandoffInput {
  readonly recordId: string;
  readonly confirmedCategory: EwasteCategory;
  readonly confirmedCondition: "working" | "repairable" | "damaged" | "unknown";
  readonly measuredWeight: { readonly value: number; readonly unit: "kg" | "g" };
  readonly finalPriceAmount: number;
  readonly receivingLocationId: string;
  readonly evidence: HandoffEvidenceInput;
  readonly offline: boolean;
}

export interface HandoffService {
  /** The contract-shaped call. Used directly by tests and by the intake form's submit step. */
  record(
    request: z.infer<typeof HandoffRequestSchema>,
  ): Promise<z.infer<typeof HandoffResponseSchema>>;
  /** Prepares evidence, builds the contract request and calls `record`. */
  confirmReceipt(input: RecordHandoffInput): Promise<z.infer<typeof HandoffResponseSchema>>;
}

export interface MaterialEntryInput {
  readonly material: string;
  readonly weight: { readonly value: number; readonly unit: "kg" | "g" };
}

export interface RecordProcessingInput {
  readonly recordId: string;
  readonly method:
    | "reuse_referral"
    | "repair_referral"
    | "material_recovery"
    | "safe_storage"
    | "other_reviewed";
  readonly materialEntries: readonly MaterialEntryInput[];
  readonly processedAt: string;
  /**
   * The recorded processing result. The contract carries it as the request's `notes` and stores
   * it as `ProcessingInformationSchema.result`, so it is required rather than optional.
   */
  readonly notes: string;
  readonly completionEvidence: Blob;
  readonly completionEvidencePreview?: string;
  readonly offline: boolean;
}

export interface ProcessingService {
  record(
    request: z.infer<typeof ProcessingRequestSchema>,
  ): Promise<z.infer<typeof ProcessingResponseSchema>>;
  submitProcessing(input: RecordProcessingInput): Promise<z.infer<typeof ProcessingResponseSchema>>;
}

export interface ReviewDecisionInput {
  readonly recordId: string;
  readonly decision: "approve" | "reject" | "request_correction";
  readonly reasonCode: string;
  readonly reviewerNote: string;
  readonly requestedCorrection?: string;
}

export interface ReviewService {
  decide(
    request: z.infer<typeof ProgrammeReviewRequestSchema>,
  ): Promise<z.infer<typeof ProgrammeReviewResponseSchema>>;
  submitDecision(
    input: ReviewDecisionInput,
  ): Promise<z.infer<typeof ProgrammeReviewResponseSchema>>;
  /** Records eligible for review, already scoped to the acting reviewer. */
  listQueue(): Promise<readonly RecoveryRecord[]>;
}

export interface ReportingService {
  summarize(
    filters: z.infer<typeof ReportingFiltersSchema>,
  ): Promise<z.infer<typeof ReportingSummarySchema>>;
  /** Filtered records behind the summary, for the preview table and the export. */
  listForReport(
    filters: z.infer<typeof ReportingFiltersSchema>,
  ): Promise<{ readonly records: readonly RecoveryRecord[]; readonly total: number }>;
}

export interface DataExportResult {
  readonly filename: string;
  readonly mimeType: "text/csv";
  readonly content: string;
  readonly rowCount: number;
  readonly columnHeadings: readonly string[];
}

export interface DataExportService {
  build(filters: z.infer<typeof ReportingFiltersSchema>): Promise<DataExportResult>;
}

export interface SafetyCardDraftInput {
  readonly category: EwasteCategory;
  readonly language: SupportedLanguage;
  readonly answers: SafetyCard["answers"];
  readonly sources: SafetyCard["sources"];
  readonly translatedFrom?: SupportedLanguage;
  readonly aiAssisted: boolean;
}

export interface SafetyCardApprovalInput {
  readonly cardId: string;
  readonly approvedBy: string;
  readonly approvalDate: string;
  readonly reviewDate: string;
}

export interface SafetyContentService {
  list(): Promise<readonly SafetyCard[]>;
  getById(cardId: string): Promise<SafetyCard | null>;
  createDraft(input: SafetyCardDraftInput): Promise<SafetyCard>;
  updateDraft(cardId: string, input: Partial<SafetyCardDraftInput>): Promise<SafetyCard>;
  approve(input: SafetyCardApprovalInput): Promise<SafetyCard>;
  /** Publishes an approved card and archives the version it replaces. */
  changeStatus(cardId: string, status: SafetyCardStatus): Promise<SafetyCard>;
}

export interface ModelAdministrationService {
  listRegistry(): Promise<readonly ModelRegistryEntry[]>;
  getConfiguration(): Promise<ModelConfiguration>;
  saveConfiguration(
    configuration: Omit<ModelConfiguration, "updated_at" | "updated_by">,
  ): Promise<ModelConfiguration>;
  listFeedback(): Promise<readonly PredictionFeedback[]>;
  /**
   * Moves stored feedback to approved or rejected for a *future* dataset release. It never
   * retrains or redeploys a model.
   */
  decideFeedback(
    feedbackId: string,
    state: "approved_for_training_dataset" | "rejected_for_training",
  ): Promise<PredictionFeedback>;
}

export interface ProgrammeSettingsService {
  get(): Promise<ProgrammeSettings>;
  save(settings: Omit<ProgrammeSettings, "updated_at" | "updated_by">): Promise<ProgrammeSettings>;
}

export interface SynchronizationService {
  synchronize(
    request: z.infer<typeof SyncBatchRequestSchema>,
  ): Promise<z.infer<typeof SyncBatchResponseSchema>>;
}

export interface LocalDataService {
  /** Counts shown before a destructive clear, so the warning is truthful. */
  summary(): Promise<{
    readonly records: number;
    readonly drafts: number;
    readonly durable: boolean;
    readonly storageWarning: string | null;
  }>;
  clear(): Promise<void>;
}

export interface FrontendServices {
  readonly authentication: AuthenticationService;
  readonly recoveryRecords: RecoveryRecordService;
  readonly vision: VisionService;
  readonly safetyGuidance: SafetyGuidanceService;
  readonly locations: LocationService;
  readonly handoffs: HandoffService;
  readonly processing: ProcessingService;
  readonly reviews: ReviewService;
  readonly reporting: ReportingService;
  readonly dataExports: DataExportService;
  readonly safetyContent: SafetyContentService;
  readonly modelAdministration: ModelAdministrationService;
  readonly programmeSettings: ProgrammeSettingsService;
  readonly synchronization: SynchronizationService;
  readonly localData: LocalDataService;
}

export interface RouteAuthorizationRequirement {
  readonly roles: readonly UserRole[];
  readonly permission?: Permission;
}
