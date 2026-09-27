import {
  RecoveryRecordStateSchema,
  SupportedLanguageSchema,
  UtcTimestampSchema,
  ActorIdSchema,
} from "@scraptrace/contracts";
import { z } from "zod";

/**
 * Programme configuration. Every field here is consumed by an existing service or contract
 * field, so no unsupported setting is offered:
 *
 * - `programme_name` titles the manager dashboard and export filename.
 * - `currency` fills `HandoffRequestSchema.final_price.currency`.
 * - `country_code` fills `ApproximateAreaSchema.country_code` on a new record.
 * - `weight_discrepancy_threshold_percentage` drives the handoff weight rule (FR-HND-006).
 * - `supported_languages` limits the language switcher and safety-card languages (FR-ACC-005).
 * - `show_unverified_facilities` controls whether unverified locations are offered (FR-LOC-004).
 * - `default_report_period_days` and `default_report_states` seed the report filters.
 *
 * Per-programme safety-card assignment is deliberately absent: no contract or service supports
 * it, so the safety administrator assigns a card to a programme on the card itself instead.
 */
export const ProgrammeSettingsSchema = z.strictObject({
  programme_name: z.string().min(2).max(160),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  country_code: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/),
  weight_discrepancy_threshold_percentage: z.number().min(1).max(100),
  supported_languages: z.array(SupportedLanguageSchema).min(1).max(4),
  show_unverified_facilities: z.boolean(),
  default_report_period_days: z.number().int().min(1).max(365),
  default_report_states: z.array(RecoveryRecordStateSchema).max(9),
  updated_at: UtcTimestampSchema,
  updated_by: ActorIdSchema.optional(),
});

export type ProgrammeSettings = z.infer<typeof ProgrammeSettingsSchema>;

/** English must remain available because it is the declared translation fallback (FR-ACC-007). */
export const validateProgrammeSettings = (value: unknown) => {
  const parsed = ProgrammeSettingsSchema.safeParse(value);
  if (!parsed.success) return parsed;
  if (!parsed.data.supported_languages.includes("en")) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom" as const,
          path: ["supported_languages"],
          message: "English must remain available as the translation fallback.",
          input: value,
        },
      ]),
    };
  }
  return parsed;
};
