import { z } from "zod";

import { ApproximateAreaSchema, GeoCoordinatesSchema, WeightSchema } from "../common/geography.js";
import { DeviceInstanceIdSchema, EvidenceIdSchema, RecoveryRecordIdSchema, UuidV7Schema } from "../common/identifiers.js";
import { CursorPaginationRequestSchema, pageSchema } from "../common/pagination.js";
import { IsoDateSchema, UtcTimestampSchema } from "../common/timestamps.js";
import { CaptureSourceSchema } from "../evidence/provenance.schema.js";
import { SemanticVersionSchema } from "../schema-version.js";
import {
  CategoryConfirmationSchema,
  EwasteCategorySchema,
  ItemConditionSchema,
  PriceEstimateSchema,
  RecordKindSchema,
  RecoveryRecordSchema,
  SafetyGuideReferenceSchema,
  VisionResultSchema,
} from "./recovery-record.schema.js";
import { RecoveryRecordStateSchema } from "./recovery-record.states.js";
import { ReviewFlagCodeSchema } from "./review-codes.js";

/**
 * Provenance of the original item photograph, sent in the same multipart request as the draft
 * (`record` JSON part plus `original_image` binary part). A client-generated `evidence_id`
 * lets an offline-created draft keep the identifier it already displayed.
 */
export const OriginalImageUploadSchema = z.strictObject({
  evidence_id: EvidenceIdSchema.optional(),
  captured_at: UtcTimestampSchema,
  capture_source: CaptureSourceSchema.extract(["in_app_camera", "approved_demo_fixture"]),
  connectivity: z.enum(["offline", "online"]),
  application_version: SemanticVersionSchema,
});

/**
 * Creates a draft. Server-owned fields (`human_reference`, revision, lifecycle states,
 * synchronization metadata, integrity digest, destination details) are never sent: the server
 * derives them. `record_kind` defaults to `batch` for mixed scrap and `item` otherwise.
 * `destination_location_id` names a participating receiving location; the server fills its
 * type and verification status from the programme directory.
 */
export const RecoveryRecordDraftCreateSchema = z.strictObject({
  record_id: RecoveryRecordIdSchema.optional(),
  device_instance_id: DeviceInstanceIdSchema,
  record_kind: RecordKindSchema.optional(),
  category: EwasteCategorySchema,
  condition: ItemConditionSchema,
  item_count: z.number().int().positive().optional(),
  approximate_weight: WeightSchema.optional(),
  captured_at: UtcTimestampSchema,
  capture_location: GeoCoordinatesSchema.optional(),
  approximate_area: ApproximateAreaSchema,
  vision_result: VisionResultSchema.optional(),
  category_confirmation: CategoryConfirmationSchema,
  estimated_price: PriceEstimateSchema.optional(),
  safety_guide: SafetyGuideReferenceSchema.optional(),
  destination_location_id: UuidV7Schema.optional(),
  original_image: OriginalImageUploadSchema,
});

/**
 * Partial update of the caller's own draft, sent with `If-Match: "<revision>"`. `null` clears
 * an optional field. An existing `vision_result` is never replaced: the original prediction is
 * kept as received.
 */
export const RecoveryRecordDraftUpdateSchema = z
  .strictObject({
    record_kind: RecordKindSchema.optional(),
    category: EwasteCategorySchema.optional(),
    condition: ItemConditionSchema.optional(),
    item_count: z.number().int().positive().nullable().optional(),
    approximate_weight: WeightSchema.nullable().optional(),
    captured_at: UtcTimestampSchema.optional(),
    capture_location: GeoCoordinatesSchema.nullable().optional(),
    approximate_area: ApproximateAreaSchema.optional(),
    vision_result: VisionResultSchema.optional(),
    category_confirmation: CategoryConfirmationSchema.optional(),
    estimated_price: PriceEstimateSchema.nullable().optional(),
    safety_guide: SafetyGuideReferenceSchema.nullable().optional(),
    destination_location_id: UuidV7Schema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one draft field is required.");

/**
 * Confirms or corrects the draft's category (FR-VIS-005, FR-VIS-006), sent with `If-Match`.
 * Identical to the contract `CategoryConfirmation`; the original prediction is never changed.
 */
export const CategoryConfirmationRequestSchema = CategoryConfirmationSchema;

export const RECORD_SORT_ORDERS = [
  "created_at",
  "-created_at",
  "updated_at",
  "-updated_at",
  "captured_at",
  "-captured_at",
] as const;

/**
 * Query parameters of the record list. The server scopes the result to the caller (own records
 * for collectors, operational scope for other roles); clients never pass a role or scope.
 * Repeat `state` and `category` to filter by several values. Dates are inclusive UTC days.
 */
export const RecoveryRecordListRequestSchema = CursorPaginationRequestSchema.extend({
  state: z.array(RecoveryRecordStateSchema).max(9).optional(),
  category: z.array(EwasteCategorySchema).max(7).optional(),
  captured_from: IsoDateSchema.optional(),
  captured_to: IsoDateSchema.optional(),
  sort: z.enum(RECORD_SORT_ORDERS).default("-created_at"),
});

export const RecoveryRecordPageSchema = pageSchema(RecoveryRecordSchema);

/**
 * Result of submitting a draft. Submission runs `submit_record` and `publish_for_handoff` in one
 * transaction. Exact reuse of another record's photograph opens a review case and returns
 * `duplicate_image` without blocking the journey. Re-submitting replays with `replayed: true`.
 */
export const RecordSubmissionResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("submitted"),
    record: RecoveryRecordSchema,
    replayed: z.boolean(),
    flag_codes: z.array(ReviewFlagCodeSchema).max(50),
  }),
  z.strictObject({
    outcome: z.literal("duplicate_image"),
    record: RecoveryRecordSchema,
    replayed: z.boolean(),
    flag_codes: z.array(ReviewFlagCodeSchema).min(1).max(50),
  }),
]);

export type RecoveryRecordDraftCreate = z.infer<typeof RecoveryRecordDraftCreateSchema>;
export type RecoveryRecordDraftUpdate = z.infer<typeof RecoveryRecordDraftUpdateSchema>;
export type RecoveryRecordListRequest = z.input<typeof RecoveryRecordListRequestSchema>;
export type RecoveryRecordPage = z.infer<typeof RecoveryRecordPageSchema>;
export type RecordSubmissionResponse = z.infer<typeof RecordSubmissionResponseSchema>;
