import { ErrorEnvelopeSchema, type ErrorEnvelope } from "@scraptrace/contracts";

export class ScrapTraceServiceError extends Error {
  constructor(readonly envelope: ErrorEnvelope) {
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

export class HttpClient {
  constructor(private readonly baseUrl: string) {}

  async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      credentials: "include",
      headers: { Accept: "application/json", ...init?.headers },
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw normalizeServiceError(payload);
    return payload;
  }
}
