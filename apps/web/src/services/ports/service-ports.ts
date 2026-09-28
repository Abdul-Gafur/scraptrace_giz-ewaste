import type {
  ActorReference,
  DemoAccount,
  EvidenceMetadata,
  EwasteCategory,
  GeoCoordinates,
  HandoffPreview,
  ManualTransferCode,
  Permission,
  ProcessingDetail,
  ProgrammeView,
  QrCredentials,
  ReceivingLocationView,
  RecoveryRecord,
  RecoveryRecordEvent,
  RecoveryRecordListRequest,
  RecoveryRecordPage,
  ReviewCaseDetail,
  ReviewCasePage,
  ReviewQueueFilters,
  ReviewReasonCode,
  ReviewState,
  RecoveryRecordState,
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
 * the only thing standing between a user and a restricted mutation. Request and response shapes
 * come from `@scraptrace/contracts`; the HTTP adapter validates every response against them.
 */

export interface Session {
  readonly actorId: string;
  readonly role: UserRole;
  readonly preferredLanguage: SupportedLanguage;
  readonly displayLabel: string;
  readonly developmentOnly: boolean;
  /** The reference to copy into contract requests; its scope fields are omitted when absent. */
  readonly actorReference: ActorReference;
  readonly programmeIds: readonly string[];
  readonly facilityIds: readonly string[];
  /** Locations where this user may record a handoff (recyclers only). */
  readonly receivingLocationIds: readonly string[];
}

export interface SignInInput {
  readonly username?: string;
  readonly password?: string;
  /** Available only from the explicitly selected non-production mock adapter. */
  readonly demoRole?: UserRole;
}

export interface AuthenticationService {
  getSession(): Promise<Session | null>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  /** Development-only demonstration usernames and roles; empty when discovery is disabled. */
  listDemoAccounts(): Promise<readonly DemoAccount[]>;
}

/** Programme reference data a form needs; the API remains authoritative for every value. */
export interface ReferenceDataService {
  getProgramme(): Promise<ProgrammeView>;
  /** The programme's participating receiving locations, for choosing a destination. */
  listDestinations(): Promise<readonly ReceivingLocationView[]>;
  /** Locations where the signed-in recycler may record a handoff. */
  listReceivingLocations(): Promise<readonly ReceivingLocationView[]>;
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
  readonly estimatedPrice?: RecoveryRecord["estimated_price"];
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

export type UpdateDraftInput = Omit<CaptureInput, "image"> & {
  /**
   * A further photograph for the draft. The original photograph and its prediction are never
   * replaced; an API stores this as additional item evidence.
   */
  readonly image?: Blob;
  /** The revision the edit was based on; a stale value is a `VERSION_CONFLICT`. */
  readonly baseRevision?: number;
};

export type SubmitOutcome =
  | {
      readonly outcome: "submitted";
      readonly record: RecoveryRecord;
      readonly replayed: boolean;
    }
  | {
      readonly outcome: "duplicate_image";
      readonly record: RecoveryRecord;
      readonly flagCodes: readonly string[];
    };

/**
 * The credential a recycler presented, relayed unchanged into the handoff request. The client
 * never generates or derives a credential (ADR-009).
 */
export type PresentedCredential =
  | { readonly kind: "qr_token"; readonly lookupToken: string }
  | { readonly kind: "manual_transfer_code"; readonly code: ManualTransferCode };

/** Result of resolving a scanned QR payload or a typed manual transfer code. */
export type HandoffLookupResult =
  | {
      readonly outcome: "ready";
      readonly record: HandoffPreview;
      readonly credential: PresentedCredential;
    }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "not_ready"; readonly record: HandoffPreview }
  | {
      readonly outcome: "already_received";
      readonly record: HandoffPreview;
      readonly receivedAt: string;
    }
  | { readonly outcome: "other_facility" }
  | { readonly outcome: "unsupported_contract_version" };

export interface AddEvidenceInput {
  readonly evidenceType:
    | "additional_item_photo"
    | "handoff_photo"
    | "weight_measurement"
    | "processing_completion";
  readonly image: Blob;
  readonly preview?: string;
  readonly offline: boolean;
}

export interface RecoveryRecordService {
  /** Every record the collector owns (bounded aggregation for dashboards). */
  listOwn(): Promise<readonly RecoveryRecord[]>;
  /** Every record the acting role may see operationally (bounded aggregation). */
  listOperational(): Promise<readonly RecoveryRecord[]>;
  /** One server-driven page of the caller's records, filtered by the server. */
  listPage(request: RecoveryRecordListRequest): Promise<RecoveryRecordPage>;
  getById(recordId: string): Promise<RecoveryRecord | null>;
  createDraft(input: CaptureInput): Promise<RecoveryRecord>;
  updateDraft(recordId: string, input: UpdateDraftInput): Promise<RecoveryRecord>;
  submit(recordId: string): Promise<SubmitOutcome>;
  /** The owning collector's QR payload and manual transfer code. */
  getQrCredentials(recordId: string): Promise<QrCredentials>;
  /** Revokes both credentials and issues new ones (lost, shared or expired QR). */
  reissueQrCredentials(recordId: string): Promise<QrCredentials>;
  lookupForHandoff(scannedTextOrCode: string): Promise<HandoffLookupResult>;
  listEvents(recordId: string): Promise<readonly RecoveryRecordEvent[]>;
  listEvidence(recordId: string): Promise<readonly EvidenceMetadata[]>;
  addEvidence(recordId: string, input: AddEvidenceInput): Promise<EvidenceMetadata>;
  /** Protected content as a component-local data URL; never a permanent or public URL. */
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
}

export interface RecordHandoffInput {
  readonly recordId: string;
  /** The collector reference from the lookup preview. */
  readonly collectorReference: ActorReference;
  /** The credential the recycler presented at lookup. */
  readonly credential: PresentedCredential;
  readonly confirmedCategory: EwasteCategory;
  readonly confirmedCondition: "working" | "repairable" | "damaged" | "unknown";
  readonly measuredWeight: { readonly value: number; readonly unit: "kg" | "g" };
  readonly finalPriceAmount: number;
  readonly finalPriceCurrency: string;
  readonly receivingLocationId: string;
  readonly evidence: HandoffEvidenceInput;
  readonly notes?: string;
  readonly offline: boolean;
}

export interface HandoffService {
  /** The contract-shaped call. Used directly by tests and by the intake form's submit step. */
  record(
    request: z.infer<typeof HandoffRequestSchema>,
  ): Promise<z.infer<typeof HandoffResponseSchema>>;
  /** Uploads the handoff evidence, builds the contract request and calls `record`. */
  confirmReceipt(input: RecordHandoffInput): Promise<z.infer<typeof HandoffResponseSchema>>;
}

export interface MaterialEntryInput {
  /** The server identifier of a persisted draft entry; absent for a new row. */
  readonly entryId?: string;
  readonly material: string;
  readonly weight: { readonly value: number; readonly unit: "kg" | "g" };
}

export type ProcessingMethod =
  | "reuse_referral"
  | "repair_referral"
  | "material_recovery"
  | "safe_storage"
  | "other_reviewed";

/** Editable processing information, persisted so it survives a refresh (FR-REV-001). */
export interface ProcessingDraftInput {
  readonly method: ProcessingMethod;
  readonly notes?: string;
  readonly processedAt?: string;
  readonly materialEntries: readonly MaterialEntryInput[];
  /** A newly chosen completion photograph; uploaded before the draft is saved. */
  readonly completionEvidence?: Blob;
  readonly completionEvidencePreview?: string;
  readonly offline: boolean;
}

export interface RecordProcessingInput {
  readonly recordId: string;
  readonly method: ProcessingMethod;
  readonly materialEntries: readonly MaterialEntryInput[];
  readonly processedAt: string;
  /**
   * The recorded processing result. The contract carries it as the request's `notes` and stores
   * it as `ProcessingInformationSchema.result`, so it is required rather than optional.
   */
  readonly notes: string;
  /** A new completion photograph, or `completionEvidenceIds` already attached to the draft. */
  readonly completionEvidence?: Blob;
  readonly completionEvidencePreview?: string;
  readonly completionEvidenceIds?: readonly string[];
  readonly offline: boolean;
}

export interface ProcessingService {
  record(
    request: z.infer<typeof ProcessingRequestSchema>,
  ): Promise<z.infer<typeof ProcessingResponseSchema>>;
  submitProcessing(input: RecordProcessingInput): Promise<z.infer<typeof ProcessingResponseSchema>>;
  /** Received records awaiting processing at the recycler's locations, oldest first. */
  listQueue(request: {
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<RecoveryRecordPage>;
  /** The persisted processing draft, or `null` when none has been started. */
  getDraft(recordId: string): Promise<ProcessingDetail | null>;
  saveDraft(recordId: string, input: ProcessingDraftInput): Promise<ProcessingDetail>;
}

export interface ReviewDecisionInput {
  readonly recordId: string;
  readonly decision: "approve" | "reject" | "request_correction";
  readonly reasonCode: ReviewReasonCode;
  readonly reviewerNote: string;
  readonly requestedCorrection?: string;
  /** The case flags the decision addresses, or `MANUAL_REVIEW`. */
  readonly reviewReasonCodes: readonly string[];
  /** Evidence the reviewer inspected; at least one item. */
  readonly evidenceConsidered: readonly string[];
  /** The states the reviewer read; a stale pair is a `VERSION_CONFLICT`. */
  readonly previousReviewState: ReviewState;
  readonly previousRecordState: RecoveryRecordState;
}

export interface ReviewService {
  decide(
    request: z.infer<typeof ProgrammeReviewRequestSchema>,
  ): Promise<z.infer<typeof ProgrammeReviewResponseSchema>>;
  submitDecision(
    input: ReviewDecisionInput,
  ): Promise<z.infer<typeof ProgrammeReviewResponseSchema>>;
  /** One server-filtered, server-paginated page of review cases in the reviewer's scope. */
  listCases(filters: ReviewQueueFilters): Promise<ReviewCasePage>;
  getCase(caseId: string): Promise<ReviewCaseDetail>;
  /** The review case of a record, or `null` when the record has none. */
  findCaseForRecord(recordId: string): Promise<ReviewCaseDetail | null>;
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
  readonly reference: ReferenceDataService;
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
