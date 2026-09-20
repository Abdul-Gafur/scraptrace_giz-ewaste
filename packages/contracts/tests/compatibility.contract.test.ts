import { describe, expect, it } from "vitest";
import { toJSONSchema } from "zod";

import { PUBLIC_SCHEMA_REGISTRY, RecoveryRecordSchema } from "../src/index.js";
import { validRecoveryRecord } from "./fixtures/recovery-record.fixture.js";

describe("serialization and compatibility", () => {
  it("round-trips a representative version 1 record", () => {
    const serialized = JSON.stringify(validRecoveryRecord);
    expect(RecoveryRecordSchema.parse(JSON.parse(serialized))).toEqual(validRecoveryRecord);
  });

  it("rejects unsupported contract versions", () => {
    expect(RecoveryRecordSchema.safeParse({ ...validRecoveryRecord, contract_schema_version: "2.0.0" }).success).toBe(false);
  });

  it("publishes the expected core schemas", () => {
    expect(Object.keys(PUBLIC_SCHEMA_REGISTRY)).toContain("recovery_record");
    expect(Object.keys(PUBLIC_SCHEMA_REGISTRY)).toContain("sync_batch_request");
    expect(Object.keys(PUBLIC_SCHEMA_REGISTRY)).toContain("error_envelope");
  });

  it("generates Draft 2020-12 compatible JSON Schema for every public contract", () => {
    for (const schema of Object.values(PUBLIC_SCHEMA_REGISTRY)) {
      const generated = toJSONSchema(schema, { target: "draft-2020-12", reused: "ref" });
      expect(generated).toMatchObject({ $schema: "https://json-schema.org/draft/2020-12/schema" });
    }
  });
});
