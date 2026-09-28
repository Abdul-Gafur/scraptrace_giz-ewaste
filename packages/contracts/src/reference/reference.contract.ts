import { z } from "zod";

import { UuidV7Schema } from "../common/identifiers.js";
import { EwasteCategorySchema } from "../recovery-record/recovery-record.schema.js";

/** Programme settings a client needs to build valid handoff requests. */
export const ProgrammeViewSchema = z.strictObject({
  programme_id: UuidV7Schema,
  name: z.string().min(1).max(160),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  country_code: z.string().length(2).regex(/^[A-Z]{2}$/),
  weight_discrepancy_threshold_percentage: z.number().min(0).max(100),
});

/**
 * A participating receiving location from the programme directory. This is reference data for
 * choosing a destination or a receiving location, not a proximity search: it carries no
 * coordinates or contact details.
 */
export const ReceivingLocationViewSchema = z.strictObject({
  location_id: UuidV7Schema,
  facility_id: UuidV7Schema,
  name: z.string().min(1).max(160),
  facility_type: z.enum(["scrapyard", "collection_centre", "recycler"]),
  verification_status: z.enum(["unverified", "programme_verified", "expired", "suspended"]),
  verification_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  accepted_categories: z.array(EwasteCategorySchema).max(7),
});

export const ReceivingLocationListSchema = z.array(ReceivingLocationViewSchema).max(500);

export type ProgrammeView = z.infer<typeof ProgrammeViewSchema>;
export type ReceivingLocationView = z.infer<typeof ReceivingLocationViewSchema>;
