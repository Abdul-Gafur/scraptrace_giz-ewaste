import { z } from "zod";

import { ApproximateAreaSchema, GeoCoordinatesSchema } from "../common/geography.js";
import { UuidV7Schema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { EwasteCategorySchema } from "../recovery-record/recovery-record.schema.js";

export const FacilityTypeSchema = z.enum(["scrapyard", "collection_centre", "recycler"]);
export const FacilityVerificationStatusSchema = z.enum(["unverified", "programme_verified", "expired", "suspended"]);

export const LocationSearchRequestSchema = z.strictObject({
  search_origin: z.union([
    z.strictObject({ type: z.literal("coordinates"), coordinates: GeoCoordinatesSchema }),
    z.strictObject({ type: z.literal("manual_area"), area: ApproximateAreaSchema }),
  ]),
  radius_km: z.number().positive().max(500),
  categories: z.array(EwasteCategorySchema).min(1).max(7),
  facility_types: z.array(FacilityTypeSchema).min(1).max(3).optional(),
  offline: z.boolean(),
});

export const ParticipatingLocationSchema = z.strictObject({
  location_id: UuidV7Schema,
  name: z.string().min(1).max(200),
  facility_type: FacilityTypeSchema,
  accepted_categories: z.array(EwasteCategorySchema).min(1),
  verification_status: FacilityVerificationStatusSchema,
  verification_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  coordinates: GeoCoordinatesSchema,
  distance_km: z.number().nonnegative(),
  opening_information: z.string().max(500).optional(),
  display_contact: z.string().max(240).optional(),
  last_reviewed_at: UtcTimestampSchema,
  data_source: z.enum(["live_directory", "cached_directory"]),
});

export const LocationSearchResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("results"), locations: z.array(ParticipatingLocationSchema), data_as_of: UtcTimestampSchema, offline_limitations: z.string().max(500).optional() }),
  z.strictObject({ outcome: z.literal("no_results"), safe_holding_message: z.string().min(1).max(1_000), programme_contact: z.string().min(1).max(240).optional() }),
  z.strictObject({ outcome: z.literal("location_permission_denied"), manual_area_supported: z.literal(true) }),
  z.strictObject({ outcome: z.literal("offline_data_unavailable"), message: z.string().min(1).max(500) }),
]);


export type FacilityType = z.infer<typeof FacilityTypeSchema>;
export type FacilityVerificationStatus = z.infer<typeof FacilityVerificationStatusSchema>;
export type ParticipatingLocation = z.infer<typeof ParticipatingLocationSchema>;
export type LocationSearchResponse = z.infer<typeof LocationSearchResponseSchema>;
