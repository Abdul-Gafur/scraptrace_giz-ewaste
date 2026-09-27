import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceIdSchema } from "@scraptrace/contracts";

import { ScrapTraceServiceError } from "@/services/http/http-client";
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
