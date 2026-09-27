import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceIdSchema } from "@scraptrace/contracts";

import { HttpClient, ScrapTraceServiceError } from "@/services/http/http-client";
import { createHttpServices } from "@/services/http/http-services";

const evidenceId = EvidenceIdSchema.parse("0199a111-1111-7111-8111-111111111111");
const timestamp = "2026-09-26T12:30:00.000Z";
const scores = [
  { category: "refrigerators", score: 0.03 },
  { category: "laptops_and_desktop_computers", score: 0.04 },
  { category: "televisions", score: 0.8 },
  { category: "microwaves", score: 0.03 },
  { category: "air_conditioners", score: 0.04 },
  { category: "compressors", score: 0.03 },
  { category: "mixed_scrap", score: 0.03 },
];

const upload = () => ({
  evidence_id: evidenceId,
  image: new File(["image"], "sample.jpg", { type: "image/jpeg" }),
});

afterEach(() => vi.unstubAllGlobals());

describe("vision HTTP adapter", () => {
  it("submits multipart data and parses a classified response", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("evidence_id")).toBe(evidenceId);
      expect(form.get("image")).toBeInstanceOf(File);
      return new Response(
        JSON.stringify({
          outcome: "classified",
          category: "televisions",
          scores,
          confidence: 0.8,
          model_name: "scraptrace-vision-efficientnet-b0",
          model_version: "0.2.0",
          inferred_at: timestamp,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createHttpServices("http://localhost:8000").vision.appraise(upload());
    expect(result.outcome).toBe("classified");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("preserves a low-confidence outcome for manual confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              outcome: "unable_to_classify",
              reason: "low_confidence",
              scores,
              model_name: "scraptrace-vision-efficientnet-b0",
              model_version: "0.2.0",
              inferred_at: timestamp,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const result = await createHttpServices("http://localhost:8000").vision.appraise(upload());
    expect(result).toMatchObject({ outcome: "unable_to_classify", reason: "low_confidence" });
  });

  it("rejects a contract-invalid successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ outcome: "classified", category: "unknown" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(
      createHttpServices("http://localhost:8000").vision.appraise(upload()),
    ).rejects.toThrow();
  });

  it("normalizes a standard service-unavailable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              contract_version: "1.0.0",
              error: {
                code: "DEPENDENCY_UNAVAILABLE",
                message: "The vision model is unavailable.",
                retryable: true,
              },
              meta: { correlation_id: "request-0001", timestamp },
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    await expect(
      createHttpServices("http://localhost:8000").vision.appraise(upload()),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });
});

describe("HTTP foundation", () => {
  const session = {
    actor_id: "0199b001-0001-7001-8001-000000000001",
    role: "collector",
    preferred_language: "en",
    display_label: "Collector",
  } as const;
  const mappedSession = {
    actorId: session.actor_id,
    role: session.role,
    preferredLanguage: session.preferred_language,
    displayLabel: session.display_label,
    developmentOnly: false,
  } as const;
  const success = (data: unknown) => ({
    success: true,
    contract_version: "1.0.0",
    data,
    meta: { correlation_id: "request-0002", timestamp },
  });

  it("restores and creates a secure-cookie session without exposing a token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input.toString()).pathname;
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("X-Request-ID")).toMatch(/^web-/);
      if (path.endsWith("/session")) return Response.json(success(session));
      if (path.endsWith("/sign-in")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          email: "collector@example.test",
          password: "correct horse battery staple",
        });
        return Response.json(success(session));
      }
      return Response.json(success({ signed_out: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const authentication = createHttpServices("https://api.example.test").authentication;

    await expect(authentication.getSession()).resolves.toEqual(mappedSession);
    await expect(
      authentication.signIn({
        email: "collector@example.test",
        password: "correct horse battery staple",
      }),
    ).resolves.toEqual(mappedSession);
    await expect(authentication.signOut()).resolves.toBeUndefined();
  });

  it("treats an unauthenticated session lookup as anonymous", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(
      createHttpServices("https://api.example.test").authentication.getSession(),
    ).resolves.toBeNull();
  });

  it.each([401, 403, 404, 409, 413, 415, 422, 429, 503])(
    "normalizes an empty %i response into a safe error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status })),
      );
      const request = new HttpClient("https://api.example.test").request("/v1/example", {
        method: "GET",
        suppressSessionExpiry: true,
      });
      await expect(request).rejects.toMatchObject({ status });
    },
  );

  it("passes cancellation to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);
    controller.abort();
    await expect(
      new HttpClient("https://api.example.test").request("/v1/example", {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
