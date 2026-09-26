import { describe, expect, it } from "vitest";

import { canonicalizeJson, computeRecoveryRecordDigest, Sha256DigestSchema, sha256CanonicalJson, verifyCanonicalJsonDigest } from "../src/index.js";
import { validRecoveryRecord } from "./fixtures/recovery-record.fixture.js";

describe("integrity semantics", () => {
  it("canonicalizes object keys deterministically", () => {
    expect(canonicalizeJson({ b: 2, a: 1 })).toBe(canonicalizeJson({ a: 1, b: 2 }));
  });

  it("produces the same digest regardless of object key order", async () => {
    expect(await sha256CanonicalJson({ b: 2, a: 1 })).toBe(await sha256CanonicalJson({ a: 1, b: 2 }));
  });

  it("produces the same digest for the same immutable payload", async () => {
    expect(await computeRecoveryRecordDigest(validRecoveryRecord)).toBe(await computeRecoveryRecordDigest(validRecoveryRecord));
  });

  it("changes the digest when an immutable field changes", async () => {
    const original = await computeRecoveryRecordDigest(validRecoveryRecord);
    const changed = await computeRecoveryRecordDigest({ ...validRecoveryRecord, condition: "working" });
    expect(changed).not.toBe(original);
  });

  it("does not change the digest for excluded synchronization metadata", async () => {
    const original = await computeRecoveryRecordDigest(validRecoveryRecord);
    const changed = await computeRecoveryRecordDigest({
      ...validRecoveryRecord,
      updated_at: "2026-09-20T10:00:00Z",
      revision: 4,
      sync: { ...validRecoveryRecord.sync, sync_state: "synchronized", server_revision: 4 },
    });
    expect(changed).toBe(original);
  });

  it("rejects malformed digests and returns typed verification failure", async () => {
    expect(Sha256DigestSchema.safeParse("sha256:ABC").success).toBe(false);
    const expected = Sha256DigestSchema.parse(`sha256:${"0".repeat(64)}`);
    const result = await verifyCanonicalJsonDigest({ value: true }, expected);
    expect(result).toMatchObject({ status: "failed", error_code: "INTEGRITY_FAILURE" });
  });
});
