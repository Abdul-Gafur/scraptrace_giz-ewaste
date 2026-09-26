import { z } from "zod";

import { CursorPaginationMetaSchema, CursorPaginationRequestSchema } from "../common/pagination.js";
import { UuidV7Schema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { EwasteCategorySchema } from "../recovery-record/recovery-record.schema.js";
import { RecoveryRecordStateSchema } from "../recovery-record/recovery-record.states.js";

export const ReportingFiltersSchema = z.strictObject({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categories: z.array(EwasteCategorySchema).max(7).optional(),
  coarse_area: z.string().min(1).max(160).optional(),
  receiving_location_id: UuidV7Schema.optional(),
  states: z.array(RecoveryRecordStateSchema).max(9).optional(),
  pagination: CursorPaginationRequestSchema,
});

export const ReportingSummarySchema = z.strictObject({
  record_counts_by_state: z.record(RecoveryRecordStateSchema, z.number().int().nonnegative()),
  verified_weight: z.strictObject({ value: z.number().nonnegative(), unit: z.enum(["kg", "g"]), eligible_state: z.literal("approved_and_completed") }),
  applied_filters: ReportingFiltersSchema.omit({ pagination: true }),
  data_freshness_at: UtcTimestampSchema,
  pagination: CursorPaginationMetaSchema,
});
