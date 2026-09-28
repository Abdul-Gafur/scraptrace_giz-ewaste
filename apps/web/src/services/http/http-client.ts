import {
  CONTRACT_SCHEMA_VERSION,
  CorrelationIdSchema,
  ErrorEnvelopeSchema,
  type ErrorCode,
  type ErrorEnvelope,
} from "@scraptrace/contracts";
import type { z } from "zod";

export class ScrapTraceServiceError extends Error {
  constructor(
    readonly envelope: ErrorEnvelope,
    readonly status?: number,
  ) {
    super(envelope.error.message);
    this.name = "ScrapTraceServiceError";
  }
}

export const normalizeServiceError = (error: unknown): ScrapTraceServiceError | Error => {
  if (error instanceof ScrapTraceServiceError) return error;
  const parsed = ErrorEnvelopeSchema.safeParse(error);
  if (parsed.success) return new ScrapTraceServiceError(parsed.data);
  return new Error("The service request could not be completed.");
};

export const shouldRetryServiceError = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2) return false;
  if (!(error instanceof ScrapTraceServiceError)) return failureCount < 1;
  return error.envelope.error.retryable;
};

const STATUS_ERROR: Readonly<Record<number, { code: ErrorCode; retryable: boolean }>> = {
  401: { code: "AUTHENTICATION_REQUIRED", retryable: false },
  403: { code: "PERMISSION_DENIED", retryable: false },
  404: { code: "RESOURCE_NOT_FOUND", retryable: false },
  409: { code: "VERSION_CONFLICT", retryable: false },
  413: { code: "VALIDATION_FAILED", retryable: false },
  415: { code: "VALIDATION_FAILED", retryable: false },
  422: { code: "VALIDATION_FAILED", retryable: false },
  429: { code: "RATE_LIMIT_REACHED", retryable: true },
  503: { code: "DEPENDENCY_UNAVAILABLE", retryable: true },
};

const statusMessage = (status: number): string => {
  if (status === 401) return "Your session is missing or has expired.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested resource is not available.";
  if (status === 409) return "The record changed before this action completed.";
  if (status === 413) return "The selected file is too large.";
  if (status === 415) return "The selected file type is not supported.";
  if (status === 422) return "Some submitted information is invalid.";
  if (status === 429) return "Too many requests were made. Try again later.";
  if (status === 503) return "The service is temporarily unavailable.";
  return "The service request could not be completed.";
};

const requestId = (): string => {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return CorrelationIdSchema.parse(`web-${value}`);
};

const fallbackEnvelope = (status: number, correlationId: string): ErrorEnvelope => {
  const mapped = STATUS_ERROR[status] ?? { code: "INTERNAL_FAILURE" as const, retryable: false };
  const safeCorrelationId = CorrelationIdSchema.safeParse(correlationId);
  return ErrorEnvelopeSchema.parse({
    success: false,
    contract_version: CONTRACT_SCHEMA_VERSION,
    error: {
      code: mapped.code,
      message: statusMessage(status),
      retryable: mapped.retryable,
    },
    meta: {
      correlation_id: safeCorrelationId.success ? safeCorrelationId.data : requestId(),
      timestamp: new Date().toISOString(),
    },
  });
};

export const SESSION_EXPIRED_EVENT = "scraptrace:session-expired";

export interface HttpRequestOptions extends Omit<RequestInit, "body"> {
  readonly body?: BodyInit | object;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  /** Invalid credentials are not an expired browser session. */
  readonly suppressSessionExpiry?: boolean;
}

export class HttpClient {
  constructor(private readonly baseUrl: string) {}

  private async send(path: string, init: HttpRequestOptions = {}): Promise<Response> {
    const {
      requestId: explicitRequestId,
      idempotencyKey,
      suppressSessionExpiry,
      body,
      ...requestInit
    } = init;
    const correlationId = CorrelationIdSchema.parse(explicitRequestId ?? requestId());
    const bodyIsJson =
      body !== undefined &&
      !(body instanceof FormData) &&
      !(body instanceof Blob) &&
      !(body instanceof URLSearchParams) &&
      typeof body !== "string";
    const headers = new Headers(requestInit.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    headers.set("X-Request-ID", correlationId);
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (bodyIsJson) headers.set("Content-Type", "application/json");

    const response = await fetch(new URL(path, this.baseUrl), {
      ...requestInit,
      ...(body === undefined
        ? {}
        : { body: bodyIsJson ? JSON.stringify(body) : (body as BodyInit) }),
      credentials: "include",
      headers,
    });
    const responseCorrelationId =
      response.headers.get("X-Request-ID") ??
      response.headers.get("X-Correlation-ID") ??
      correlationId;
    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      const payload: unknown = contentType.includes("application/json")
        ? await response.json().catch(() => undefined)
        : undefined;
      const parsed = ErrorEnvelopeSchema.safeParse(payload);
      const error = new ScrapTraceServiceError(
        parsed.success ? parsed.data : fallbackEnvelope(response.status, responseCorrelationId),
        response.status,
      );
      if (response.status === 401 && !suppressSessionExpiry && typeof window !== "undefined") {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw error;
    }
    return response;
  }

  async request(path: string, init: HttpRequestOptions = {}): Promise<unknown> {
    const response = await this.send(path, init);
    if (response.status === 204) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    const payload: unknown = contentType.includes("application/json")
      ? await response.json().catch(() => undefined)
      : undefined;
    return payload;
  }

  async requestBlob(path: string, init: HttpRequestOptions = {}): Promise<Blob> {
    return (await this.send(path, init)).blob();
  }

  async requestParsed<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    init?: HttpRequestOptions,
  ): Promise<z.infer<Schema>> {
    return schema.parse(await this.request(path, init));
  }
}
