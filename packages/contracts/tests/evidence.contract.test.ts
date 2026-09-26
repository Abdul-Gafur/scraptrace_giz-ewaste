import { describe, expect, it } from "vitest";

import { EvidenceSchema } from "../src/index.js";
import { validEvidence } from "./fixtures/recovery-record.fixture.js";

describe("evidence provenance", () => {
  it("accepts complete provenance without hardware fingerprinting", () => {
    const evidence = EvidenceSchema.parse(validEvidence);
    expect(evidence.provenance.device_instance_id).toBeDefined();
    expect(JSON.stringify(evidence)).not.toMatch(/serial_number|imei|mac_address/i);
  });

  it("rejects a public URL as the storage reference", () => {
    const result = EvidenceSchema.safeParse({
      ...validEvidence,
      storage_reference: { storage_provider: "demo", object_key: "https://public.example/evidence.jpg" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects incomplete provenance", () => {
    const { device_instance_id: _deviceInstanceId, ...incompleteProvenance } = validEvidence.provenance;
    const result = EvidenceSchema.safeParse({ ...validEvidence, provenance: incompleteProvenance });
    expect(result.success).toBe(false);
  });

  it("preserves an AI observation and a later human correction", () => {
    const result = EvidenceSchema.parse({
      ...validEvidence,
      provenance: {
        ...validEvidence.provenance,
        ai_observation: { model_name: "demo", model_version: "0.1.0", original_prediction: "televisions", confidence: 0.4 },
        human_correction: {
          original_value: "televisions",
          corrected_value: "microwaves",
          corrected_by: validEvidence.provenance.captured_by,
          corrected_at: "2026-09-20T08:10:00Z",
          reason: "Manual confirmation",
        },
      },
    });
    expect(result.provenance.ai_observation?.original_prediction).toBe("televisions");
    expect(result.provenance.human_correction?.corrected_value).toBe("microwaves");
  });
});
