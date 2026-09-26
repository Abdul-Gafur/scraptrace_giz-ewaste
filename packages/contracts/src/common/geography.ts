import { z } from "zod";

export const GeoCoordinatesSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_metres: z.number().positive().max(100_000).optional(),
  source: z.enum(["device", "manual", "facility", "imported"]),
});

export const ApproximateAreaSchema = z.strictObject({
  label: z.string().min(1).max(160),
  administrative_area: z.string().min(1).max(160).optional(),
  country_code: z.string().length(2).regex(/^[A-Z]{2}$/),
});

export const WeightSchema = z.strictObject({
  value: z.number().positive().finite(),
  unit: z.enum(["kg", "g"]),
});

export type GeoCoordinates = z.infer<typeof GeoCoordinatesSchema>;
export type ApproximateArea = z.infer<typeof ApproximateAreaSchema>;

