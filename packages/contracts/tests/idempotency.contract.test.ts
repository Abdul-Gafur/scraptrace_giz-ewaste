import { describe, expect, it } from "vitest";

import { compareIdempotencyRequest, IdempotencyMetadataSchema, type IdempotencyMetadata } from "../src/index.js";
import { IDS } from "./fixtures/recovery-record.fixture.js";

const base = IdempotencyMetadataSchema.parse({
  idempotency_key: "idem_demo_operation_0001",
  request_digest: `sha256:${"a".repeat(64)}`,
  scope: { actor_id: IDS.actor, operation: "create_record", resource_id: IDS.record },
});

describe("idempotency", () => {
  it("accepts a new key", () => expect(compareIdempotencyRequest(undefined, base)).toEqual({ outcome: "new" }));

  it("replays the same key, scope and digest", () =>
    expect(compareIdempotencyRequest(base, { ...base })).toEqual({ outcome: "replay" }));

  it("rejects key reuse with a different payload", () => {
    const incoming = { ...base, request_digest: `sha256:${"b".repeat(64)}` as IdempotencyMetadata["request_digest"] };
    expect(compareIdempotencyRequest(base, incoming)).toEqual({ outcome: "conflict", error_code: "IDEMPOTENCY_CONFLICT" });
  });
});
