import type { z } from "zod";

import { CurrentUserSchema, DemoAccountListSchema, SessionCreatedSchema, SignInRequestSchema } from "./auth/session.contract.js";
import { ErrorEnvelopeSchema } from "./common/errors.js";
import { QrPayloadSchema } from "./common/identifiers.js";
import { EvidenceMetadataSchema, EvidenceSchema } from "./evidence/evidence.schema.js";
import { EvidenceMetadataListSchema, EvidenceUploadRequestSchema } from "./evidence/evidence.transport.js";
import { ProgrammeViewSchema, ReceivingLocationListSchema } from "./reference/reference.contract.js";
import { RecoveryRecordEventListSchema, RecoveryRecordEventSchema } from "./recovery-record/recovery-record.events.js";
import { RecoveryRecordSchema } from "./recovery-record/recovery-record.schema.js";
import {
  CategoryConfirmationRequestSchema,
  RecordSubmissionResponseSchema,
  RecoveryRecordDraftCreateSchema,
  RecoveryRecordDraftUpdateSchema,
  RecoveryRecordListRequestSchema,
  RecoveryRecordPageSchema,
} from "./recovery-record/recovery-record.transport.js";
import { HandoffRequestSchema, HandoffResponseSchema } from "./services/handoff.contract.js";
import { LocationSearchRequestSchema, LocationSearchResponseSchema } from "./services/locations.contract.js";
import {
  MaterialEntrySchema,
  MaterialEntryUpdateSchema,
  ProcessingDetailSchema,
  ProcessingDraftUpdateSchema,
  ProcessingRequestSchema,
  ProcessingResponseSchema,
} from "./services/processing.contract.js";
import { HandoffLookupRequestSchema, HandoffLookupResponseSchema, QrCredentialsSchema } from "./services/qr.contract.js";
import {
  ProgrammeReviewRequestSchema,
  ProgrammeReviewResponseSchema,
  ReviewCaseDetailSchema,
  ReviewCasePageSchema,
  ReviewQueueFiltersSchema,
} from "./services/review.contract.js";
import { ReportingFiltersSchema, ReportingSummarySchema } from "./services/reporting.contract.js";
import { SafetyGuidanceRequestSchema, SafetyGuidanceResponseSchema } from "./services/safety.contract.js";
import { VisionAppraisalRequestSchema, VisionAppraisalResponseSchema } from "./services/vision.contract.js";
import { SyncBatchRequestSchema, SyncBatchResponseSchema } from "./sync/sync.schema.js";

/**
 * Every schema that crosses an application or service boundary. Each entry is generated to
 * `schemas/<name>.schema.json`, which the API loads to validate requests and responses and to
 * publish OpenAPI components.
 */
export const PUBLIC_SCHEMA_REGISTRY = {
  category_confirmation_request: CategoryConfirmationRequestSchema,
  current_user: CurrentUserSchema,
  demo_account_list: DemoAccountListSchema,
  error_envelope: ErrorEnvelopeSchema,
  evidence: EvidenceSchema,
  evidence_metadata: EvidenceMetadataSchema,
  evidence_metadata_list: EvidenceMetadataListSchema,
  evidence_upload_request: EvidenceUploadRequestSchema,
  handoff_lookup_request: HandoffLookupRequestSchema,
  handoff_lookup_response: HandoffLookupResponseSchema,
  handoff_request: HandoffRequestSchema,
  handoff_response: HandoffResponseSchema,
  location_search_request: LocationSearchRequestSchema,
  location_search_response: LocationSearchResponseSchema,
  material_entry: MaterialEntrySchema,
  material_entry_update: MaterialEntryUpdateSchema,
  processing_detail: ProcessingDetailSchema,
  processing_draft_update: ProcessingDraftUpdateSchema,
  processing_request: ProcessingRequestSchema,
  processing_response: ProcessingResponseSchema,
  programme_review_request: ProgrammeReviewRequestSchema,
  programme_review_response: ProgrammeReviewResponseSchema,
  programme_view: ProgrammeViewSchema,
  qr_credentials: QrCredentialsSchema,
  qr_payload: QrPayloadSchema,
  receiving_location_list: ReceivingLocationListSchema,
  record_submission_response: RecordSubmissionResponseSchema,
  recovery_record: RecoveryRecordSchema,
  recovery_record_draft_create: RecoveryRecordDraftCreateSchema,
  recovery_record_draft_update: RecoveryRecordDraftUpdateSchema,
  recovery_record_event: RecoveryRecordEventSchema,
  recovery_record_event_list: RecoveryRecordEventListSchema,
  recovery_record_list_request: RecoveryRecordListRequestSchema,
  recovery_record_page: RecoveryRecordPageSchema,
  reporting_filters: ReportingFiltersSchema,
  reporting_summary: ReportingSummarySchema,
  review_case_detail: ReviewCaseDetailSchema,
  review_case_page: ReviewCasePageSchema,
  review_queue_filters: ReviewQueueFiltersSchema,
  safety_guidance_request: SafetyGuidanceRequestSchema,
  safety_guidance_response: SafetyGuidanceResponseSchema,
  session_created: SessionCreatedSchema,
  sign_in_request: SignInRequestSchema,
  sync_batch_request: SyncBatchRequestSchema,
  sync_batch_response: SyncBatchResponseSchema,
  vision_appraisal_request: VisionAppraisalRequestSchema,
  vision_appraisal_response: VisionAppraisalResponseSchema,
} as const satisfies Record<string, z.ZodType>;
