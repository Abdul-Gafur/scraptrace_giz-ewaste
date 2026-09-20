import { describe, expect, it } from "vitest";

import { SyncBatchRequestSchema, SyncBatchResponseSchema } from "../src/index.js";
import { IDS } from "./fixtures/recovery-record.fixture.js";

const mutation = {
  contract_version: "1.0.0",
  client_mutation_id: IDS.mutation,
  record_id: IDS.record,
  device_instance_id: IDS.device,
  local_sequence: 1,
  base_server_revision: null,
  mutation_type: "create_record",
  mutation_payload: { category: "televisions" },
  created_at: "2026-09-20T08:00:00Z",
  idempotency: {
    idempotency_key: "idem_demo_operation_0001",
    request_digest: `sha256:${"a".repeat(64)}`,
    scope: { actor_id: IDS.actor, operation: "create_record", resource_id: IDS.record },
  },
  sync_state: "pending_synchronization",
  attempt: { attempt_count: 0 },
} as const;

describe("offline synchronization", () => {
  it("accepts a valid batch", () => {
    expect(SyncBatchRequestSchema.safeParse({ contract_version: "1.0.0", mutations: [mutation] }).success).toBe(true);
  });

  it("reports each item independently for partial success", () => {
    const result = SyncBatchResponseSchema.parse({
      contract_version: "1.0.0",
      server_timestamp: "2026-09-20T08:05:00Z",
      results: [
        { outcome: "accepted", client_mutation_id: IDS.mutation, record_id: IDS.record, server_revision: 1, server_timestamp: "2026-09-20T08:05:00Z", replay_status: "created" },
        { outcome: "rejected", client_mutation_id: "0199a999-9999-7999-8999-999999999999", error_code: "VALIDATION_FAILED", message: "Invalid category.", retryable: false },
      ],
    });
    expect(result.results.map((item) => item.outcome)).toEqual(["accepted", "rejected"]);
  });

  it("marks a duplicate mutation replay without creating another result", () => {
    const result = SyncBatchResponseSchema.parse({
      contract_version: "1.0.0",
      server_timestamp: "2026-09-20T08:05:00Z",
      results: [{ outcome: "accepted", client_mutation_id: IDS.mutation, record_id: IDS.record, server_revision: 1, server_timestamp: "2026-09-20T08:05:00Z", replay_status: "replayed" }],
    });
    expect(result.results[0]).toMatchObject({ outcome: "accepted", replay_status: "replayed" });
  });

  it("represents revision and integrity conflicts safely", () => {
    const result = SyncBatchResponseSchema.parse({
      contract_version: "1.0.0",
      server_timestamp: "2026-09-20T08:05:00Z",
      results: [{
        outcome: "conflicting",
        client_mutation_id: IDS.mutation,
        conflict: { code: "STALE_BASE_REVISION", message: "Review the server and local versions.", retryable: false, client_revision: 1, server_revision: 2, resolution: "refresh_and_review" },
      }],
    });
    expect(result.results[0]?.outcome).toBe("conflicting");
  });
});
