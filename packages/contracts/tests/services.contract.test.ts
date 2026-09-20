import { describe, expect, it } from "vitest";

import { ErrorEnvelopeSchema, LanguageMetadataSchema, LocationSearchRequestSchema, SafetyGuidanceRequestSchema, SafetyGuidanceResponseSchema, SupportedLanguageSchema, VisionAppraisalRequestSchema, getLanguageDirection, VisionAppraisalResponseSchema } from "../src/index.js";
import { IDS } from "./fixtures/recovery-record.fixture.js";

describe("service contracts", () => {
  it("accepts a valid service request and rejects unexpected fields", () => {
    expect(VisionAppraisalRequestSchema.safeParse({ evidence_id: IDS.evidence }).success).toBe(true);
    expect(VisionAppraisalRequestSchema.safeParse({ evidence_id: IDS.evidence, raw_image: "not-allowed" }).success).toBe(false);
  });

  it("rejects unsupported request languages and unsafe location radii", () => {
    expect(SafetyGuidanceRequestSchema.safeParse({
      category: "televisions",
      requested_language: "sw",
      transformation_mode: "translate",
      offline: false,
    }).success).toBe(false);
    expect(LocationSearchRequestSchema.safeParse({
      search_origin: { type: "manual_area", area: { label: "Demonstration area", country_code: "GH" } },
      radius_km: 501,
      categories: ["televisions"],
      offline: false,
    }).success).toBe(false);
  });

  it("validates a seven-score vision result", () => {
    const categories = ["refrigerators", "laptops_and_desktop_computers", "televisions", "microwaves", "air_conditioners", "compressors", "mixed_scrap"] as const;
    const result = VisionAppraisalResponseSchema.safeParse({
      outcome: "classified",
      category: "televisions",
      scores: categories.map((category, index) => ({ category, score: index === 2 ? 0.8 : 0.02 })),
      confidence: 0.8,
      model_name: "demo",
      model_version: "0.1.0",
      inferred_at: "2026-09-20T08:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("supports all four languages and identifies Arabic as right-to-left", () => {
    expect(SupportedLanguageSchema.options).toEqual(["en", "fr", "ar", "pt"]);
    expect(getLanguageDirection("ar")).toBe("rtl");
  });

  it("rejects language metadata with the wrong writing direction", () => {
    expect(LanguageMetadataSchema.safeParse({ language: "ar", direction: "ltr", reviewed: true }).success).toBe(false);
    expect(LanguageMetadataSchema.safeParse({ language: "fr", direction: "rtl", reviewed: true }).success).toBe(false);
  });

  it("rejects a seven-score result that duplicates a category", () => {
    const duplicatedScores = [
      "refrigerators",
      "refrigerators",
      "televisions",
      "microwaves",
      "air_conditioners",
      "compressors",
      "mixed_scrap",
    ].map((category) => ({ category, score: 0.1 }));
    const result = VisionAppraisalResponseSchema.safeParse({
      outcome: "classified",
      category: "televisions",
      scores: duplicatedScores,
      confidence: 0.7,
      model_name: "demo",
      model_version: "0.1.0",
      inferred_at: "2026-09-20T08:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects prediction fields that disagree with the category scores", () => {
    const categories = ["refrigerators", "laptops_and_desktop_computers", "televisions", "microwaves", "air_conditioners", "compressors", "mixed_scrap"] as const;
    const result = VisionAppraisalResponseSchema.safeParse({
      outcome: "classified",
      category: "televisions",
      scores: categories.map((category) => ({ category, score: category === "microwaves" ? 0.8 : category === "televisions" ? 0.4 : 0.02 })),
      confidence: 0.8,
      model_name: "demo",
      model_version: "0.1.0",
      inferred_at: "2026-09-20T08:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts approved grounded guidance", () => {
    const result = SafetyGuidanceResponseSchema.safeParse({
      outcome: "approved_guidance",
      category: "televisions",
      language: { language: "ar", direction: "rtl", reviewed: true },
      safety_card_id: IDS.card,
      safety_card_version: "1.0.0",
      source_references: ["reviewed-source-1"],
      approval_date: "2026-09-01",
      review_date: "2027-09-01",
      answers: { what_is_it: "Reviewed text", possible_dangers: "Reviewed text", prohibited_actions: "Reviewed text", safe_actions_now: "Reviewed text", suitable_destination: "Reviewed text" },
      transformation_mode: "translate",
      grounding_references: ["card:1.0.0"],
      offline_available: true,
      ai_assisted: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires a fixed safe referral when guidance is unavailable", () => {
    const result = SafetyGuidanceResponseSchema.parse({
      outcome: "safe_fallback",
      category: "televisions",
      language: { language: "en", direction: "ltr", reviewed: true },
      reason: "no_approved_card",
      message: "Approved guidance is not available.",
      referral: "Contact a programme-verified receiving location or trained technician.",
      llm_called: false,
    });
    expect(result.llm_called).toBe(false);
  });

  it("validates a safe error envelope", () => {
    const result = ErrorEnvelopeSchema.parse({
      success: false,
      contract_version: "1.0.0",
      error: { code: "PERMISSION_DENIED", message: "You cannot perform this action.", retryable: false },
      meta: { correlation_id: "corr_demo_0001", timestamp: "2026-09-20T08:00:00Z" },
    });
    expect(JSON.stringify(result)).not.toMatch(/stack|token|password/i);
  });

  it("rejects unsafe extra error details", () => {
    const result = ErrorEnvelopeSchema.safeParse({
      success: false,
      contract_version: "1.0.0",
      error: { code: "INTERNAL_FAILURE", message: "The operation failed.", retryable: false, stack: "sensitive" },
      meta: { correlation_id: "corr_demo_0001", timestamp: "2026-09-20T08:00:00Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed vision result", () => {
    expect(VisionAppraisalResponseSchema.safeParse({ outcome: "classified", category: "televisions" }).success).toBe(false);
  });
});
