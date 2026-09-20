import { describe, expect, it } from "vitest";

import { QrPayloadSchema, RecoveryRecordSchema } from "../src/index.js";
import { validRecoveryRecord } from "./fixtures/recovery-record.fixture.js";

describe("recovery record contract", () => {
  it("accepts a valid recovery record", () => {
    expect(RecoveryRecordSchema.parse(validRecoveryRecord)).toEqual(validRecoveryRecord);
  });

  it("rejects an unsupported category", () => {
    const result = RecoveryRecordSchema.safeParse({ ...validRecoveryRecord, category: "phones" });
    expect(result.success).toBe(false);
  });

  it("requires mixed scrap to be a weighted batch", () => {
    const result = RecoveryRecordSchema.safeParse({
      ...validRecoveryRecord,
      category: "mixed_scrap",
      category_confirmation: { ...validRecoveryRecord.category_confirmation, confirmed_category: "mixed_scrap" },
    });
    expect(result.success).toBe(false);
  });

  it("keeps personal data out of the QR payload", () => {
    const parsed = QrPayloadSchema.parse(validRecoveryRecord.qr_payload);
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toMatch(/name|phone|latitude|longitude|collector/i);
  });

  it("rejects a QR payload whose record ID differs", () => {
    const result = RecoveryRecordSchema.safeParse({
      ...validRecoveryRecord,
      qr_payload: { ...validRecoveryRecord.qr_payload, record_id: "0199afff-ffff-7fff-8fff-ffffffffffff" },
    });
    expect(result.success).toBe(false);
  });
});

