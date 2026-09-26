import { z } from "zod";

import { ClientMutationIdSchema, DeviceInstanceIdSchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { CONTRACT_SCHEMA_VERSION } from "../schema-version.js";
import { SynchronizationStateSchema } from "../recovery-record/recovery-record.states.js";
import { SyncConflictSchema } from "./conflicts.schema.js";
import { IdempotencyMetadataSchema } from "./idempotency.schema.js";

export const MutationTypeSchema = z.enum([
  "create_record",
  "submit_record",
  "attach_evidence",
  "record_handoff",
  "record_processing",
  "record_review_decision",
  "amend_record",
]);

export const QueuedMutationSchema = z.strictObject({
  contract_version: z.literal(CONTRACT_SCHEMA_VERSION),
  client_mutation_id: ClientMutationIdSchema,
  record_id: RecoveryRecordIdSchema,
  device_instance_id: DeviceInstanceIdSchema,
  local_sequence: z.number().int().nonnegative(),
  base_server_revision: z.number().int().nonnegative().nullable(),
  mutation_type: MutationTypeSchema,
  mutation_payload: z.record(z.string(), z.unknown()),
  created_at: UtcTimestampSchema,
  idempotency: IdempotencyMetadataSchema,
  sync_state: SynchronizationStateSchema,
  attempt: z.strictObject({
    attempt_count: z.number().int().nonnegative(),
    last_attempt_at: UtcTimestampSchema.optional(),
    next_attempt_at: UtcTimestampSchema.optional(),
  }),
});

const AcceptedSyncResultSchema = z.strictObject({
  outcome: z.literal("accepted"),
  client_mutation_id: ClientMutationIdSchema,
  record_id: RecoveryRecordIdSchema,
  server_revision: z.number().int().nonnegative(),
  server_timestamp: UtcTimestampSchema,
  replay_status: z.enum(["created", "replayed"]),
});

const RejectedSyncResultSchema = z.strictObject({
  outcome: z.literal("rejected"),
  client_mutation_id: ClientMutationIdSchema,
  error_code: z.enum(["VALIDATION_FAILED", "PERMISSION_DENIED", "INVALID_STATE_TRANSITION", "UNSUPPORTED_CONTRACT_VERSION", "INTEGRITY_FAILURE"]),
  message: z.string().min(1).max(500),
  retryable: z.literal(false),
});

const ConflictingSyncResultSchema = z.strictObject({
  outcome: z.literal("conflicting"),
  client_mutation_id: ClientMutationIdSchema,
  conflict: SyncConflictSchema,
});

const RetryableSyncResultSchema = z.strictObject({
  outcome: z.literal("retryable"),
  client_mutation_id: ClientMutationIdSchema,
  error_code: z.enum(["DEPENDENCY_UNAVAILABLE", "RATE_LIMIT_REACHED", "INTERNAL_FAILURE"]),
  message: z.string().min(1).max(500),
  retryable: z.literal(true),
  retry_after_seconds: z.number().int().positive().optional(),
});

export const SyncItemResultSchema = z.discriminatedUnion("outcome", [
  AcceptedSyncResultSchema,
  RejectedSyncResultSchema,
  ConflictingSyncResultSchema,
  RetryableSyncResultSchema,
]);

export const SyncBatchRequestSchema = z.strictObject({
  contract_version: z.literal(CONTRACT_SCHEMA_VERSION),
  mutations: z.array(QueuedMutationSchema).min(1).max(100),
});

export const SyncBatchResponseSchema = z.strictObject({
  contract_version: z.literal(CONTRACT_SCHEMA_VERSION),
  results: z.array(SyncItemResultSchema).min(1).max(100),
  server_timestamp: UtcTimestampSchema,
});

export type QueuedMutation = z.infer<typeof QueuedMutationSchema>;
export type SyncItemResult = z.infer<typeof SyncItemResultSchema>;

