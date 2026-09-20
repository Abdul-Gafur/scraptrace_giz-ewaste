import type { z } from "zod";

import { ErrorEnvelopeSchema } from "./common/errors.js";
import { QrPayloadSchema } from "./common/identifiers.js";
import { EvidenceSchema } from "./evidence/evidence.schema.js";
import { RecoveryRecordEventSchema } from "./recovery-record/recovery-record.events.js";
import { RecoveryRecordSchema } from "./recovery-record/recovery-record.schema.js";
import { HandoffRequestSchema, HandoffResponseSchema } from "./services/handoff.contract.js";
import { LocationSearchRequestSchema, LocationSearchResponseSchema } from "./services/locations.contract.js";
import { ProcessingRequestSchema, ProcessingResponseSchema } from "./services/processing.contract.js";
import { ProgrammeReviewRequestSchema, ProgrammeReviewResponseSchema } from "./services/review.contract.js";
import { ReportingFiltersSchema, ReportingSummarySchema } from "./services/reporting.contract.js";
import { SafetyGuidanceRequestSchema, SafetyGuidanceResponseSchema } from "./services/safety.contract.js";
import { VisionAppraisalRequestSchema, VisionAppraisalResponseSchema } from "./services/vision.contract.js";
import { SyncBatchRequestSchema, SyncBatchResponseSchema } from "./sync/sync.schema.js";

export const PUBLIC_SCHEMA_REGISTRY = {
  error_envelope: ErrorEnvelopeSchema,
  evidence: EvidenceSchema,
  handoff_request: HandoffRequestSchema,
  handoff_response: HandoffResponseSchema,
  location_search_request: LocationSearchRequestSchema,
  location_search_response: LocationSearchResponseSchema,
  processing_request: ProcessingRequestSchema,
  processing_response: ProcessingResponseSchema,
  programme_review_request: ProgrammeReviewRequestSchema,
  programme_review_response: ProgrammeReviewResponseSchema,
  qr_payload: QrPayloadSchema,
  recovery_record: RecoveryRecordSchema,
  recovery_record_event: RecoveryRecordEventSchema,
  reporting_filters: ReportingFiltersSchema,
  reporting_summary: ReportingSummarySchema,
  safety_guidance_request: SafetyGuidanceRequestSchema,
  safety_guidance_response: SafetyGuidanceResponseSchema,
  sync_batch_request: SyncBatchRequestSchema,
  sync_batch_response: SyncBatchResponseSchema,
  vision_appraisal_request: VisionAppraisalRequestSchema,
  vision_appraisal_response: VisionAppraisalResponseSchema,
} as const satisfies Record<string, z.ZodType>;

