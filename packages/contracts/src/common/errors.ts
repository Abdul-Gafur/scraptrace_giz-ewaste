import { z } from "zod";

import { CONTRACT_SCHEMA_VERSION } from "../schema-version.js";
import { CorrelationIdSchema } from "./identifiers.js";
import { UtcTimestampSchema } from "./timestamps.js";

export const ErrorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "AUTHENTICATION_REQUIRED",
  "PERMISSION_DENIED",
  "RESOURCE_NOT_FOUND",
  "INVALID_STATE_TRANSITION",
  "VERSION_CONFLICT",
  "DUPLICATE_RECORD",
  "IDEMPOTENCY_CONFLICT",
  "INTEGRITY_FAILURE",
  "UNSUPPORTED_CONTRACT_VERSION",
  "UNSUPPORTED_LANGUAGE",
  "MISSING_APPROVED_SAFETY_GUIDANCE",
  "RATE_LIMIT_REACHED",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_FAILURE",
]);

export const FieldValidationIssueSchema = z.strictObject({
  field: z.string().min(1).max(200),
  reason: z.string().min(1).max(120),
  message_key: z.string().min(1).max(160).optional(),
});

export const StandardErrorSchema = z.strictObject({
  code: ErrorCodeSchema,
  message: z.string().min(1).max(500),
  message_key: z.string().min(1).max(160).optional(),
  retryable: z.boolean(),
  field_issues: z.array(FieldValidationIssueSchema).max(100).optional(),
  safe_details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const ErrorEnvelopeSchema = z.strictObject({
  success: z.literal(false),
  contract_version: z.literal(CONTRACT_SCHEMA_VERSION),
  error: StandardErrorSchema,
  meta: z.strictObject({
    correlation_id: CorrelationIdSchema,
    timestamp: UtcTimestampSchema,
  }),
});

export const serviceSuccessSchema = <T extends z.ZodType>(data: T) =>
  z.strictObject({
    success: z.literal(true),
    contract_version: z.literal(CONTRACT_SCHEMA_VERSION),
    data,
    meta: z.strictObject({
      correlation_id: CorrelationIdSchema,
      timestamp: UtcTimestampSchema,
    }),
  });

export const serviceResultSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion("success", [serviceSuccessSchema(data), ErrorEnvelopeSchema]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type StandardError = z.infer<typeof StandardErrorSchema>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

