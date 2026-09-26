import { z } from "zod";

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const UtcTimestampSchema = z
  .string()
  .regex(UTC_TIMESTAMP_PATTERN, "Expected an ISO 8601 UTC timestamp ending in Z.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Timestamp is not a valid calendar instant.");

export const LocalClockContextSchema = z.strictObject({
  timezone_offset_minutes: z.number().int().min(-840).max(840).optional(),
  clock_uncertainty_seconds: z.number().nonnegative().optional(),
});

export type UtcTimestamp = z.infer<typeof UtcTimestampSchema>;

