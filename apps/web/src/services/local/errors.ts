import {
  CONTRACT_SCHEMA_VERSION,
  CorrelationIdSchema,
  ErrorEnvelopeSchema,
  type ErrorCode,
  type StandardError,
} from "@scraptrace/contracts";

import { ScrapTraceServiceError } from "@/services/http/http-client";
import { nowUtc } from "@/services/domain/time";

/**
 * Builds the standard error envelope (ADR-007) for a locally enforced failure, so a screen
 * handles a denied or invalid local call exactly as it will handle the same failure from a
 * future API. `message_key` names a translated message; `message` stays short, safe and free of
 * record content.
 */

const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "DEPENDENCY_UNAVAILABLE",
  "RATE_LIMIT_REACHED",
  "INTERNAL_FAILURE",
]);

let correlationCounter = 0;

const nextCorrelationId = () => {
  correlationCounter += 1;
  return CorrelationIdSchema.parse(`local-${Date.now().toString(36)}-${correlationCounter}`);
};

export interface ServiceErrorOptions {
  readonly messageKey?: string;
  readonly fieldIssues?: readonly { readonly field: string; readonly reason: string }[];
  readonly safeDetails?: Readonly<Record<string, string | number | boolean | null>>;
}

export const serviceError = (
  code: ErrorCode,
  message: string,
  options: ServiceErrorOptions = {},
): ScrapTraceServiceError => {
  const error: StandardError = {
    code,
    message,
    retryable: RETRYABLE.has(code),
    ...(options.messageKey ? { message_key: options.messageKey } : {}),
    ...(options.fieldIssues && options.fieldIssues.length > 0
      ? { field_issues: options.fieldIssues.map((issue) => ({ ...issue })) }
      : {}),
    ...(options.safeDetails ? { safe_details: { ...options.safeDetails } } : {}),
  };
  return new ScrapTraceServiceError(
    ErrorEnvelopeSchema.parse({
      success: false,
      contract_version: CONTRACT_SCHEMA_VERSION,
      error,
      meta: { correlation_id: nextCorrelationId(), timestamp: nowUtc() },
    }),
  );
};

export const permissionDenied = (messageKey = "errors.permissionDenied") =>
  serviceError("PERMISSION_DENIED", "The current role may not perform this action.", {
    messageKey,
  });

export const notFound = (messageKey = "errors.notFound") =>
  serviceError("RESOURCE_NOT_FOUND", "The requested record is not available.", { messageKey });

export const invalidTransition = (message: string, messageKey = "errors.invalidTransition") =>
  serviceError("INVALID_STATE_TRANSITION", message, { messageKey });

export const validationFailed = (
  message: string,
  fieldIssues: readonly { readonly field: string; readonly reason: string }[] = [],
  messageKey = "errors.validationFailed",
) => serviceError("VALIDATION_FAILED", message, { messageKey, fieldIssues });
