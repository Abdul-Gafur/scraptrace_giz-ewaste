import type {
  Permission,
  RecoveryRecord,
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
  signOut(): Promise<void>;
}

export interface RecoveryRecordService {
  listOwn(): Promise<readonly RecoveryRecord[]>;
  getById(recordId: string): Promise<RecoveryRecord | null>;
  saveDraft(record: unknown): Promise<RecoveryRecord>;
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
