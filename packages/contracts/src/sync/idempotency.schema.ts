import { z } from "zod";

import { ActorIdSchema, IdempotencyKeySchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { Sha256DigestSchema } from "../common/integrity.js";
import { UtcTimestampSchema } from "../common/timestamps.js";

export const IdempotencyScopeSchema = z.strictObject({
  actor_id: ActorIdSchema,
  operation: z.string().min(1).max(120),
  resource_id: RecoveryRecordIdSchema.optional(),
});

/**
 * The one operation name each idempotent command uses in `idempotency.scope.operation`. A
 * retry must repeat the same key, digest and scope to replay the first result.
 */
export const IDEMPOTENT_OPERATIONS = {
  createRecord: "create_record",
  recordHandoff: "record_handoff",
  recordProcessing: "record_processing",
  recordReviewDecision: "record_review_decision",
} as const;

export const IdempotencyMetadataSchema = z.strictObject({
  idempotency_key: IdempotencyKeySchema,
  request_digest: Sha256DigestSchema,
  scope: IdempotencyScopeSchema,
});

export const IdempotencyReplayStatusSchema = z.enum(["created", "replayed"]);

export type IdempotencyMetadata = z.infer<typeof IdempotencyMetadataSchema>;

export type IdempotencyDecision =
  | { readonly outcome: "new" }
  | { readonly outcome: "replay" }
  | { readonly outcome: "conflict"; readonly error_code: "IDEMPOTENCY_CONFLICT" };

export const compareIdempotencyRequest = (
  existing: IdempotencyMetadata | undefined,
  incoming: IdempotencyMetadata,
): IdempotencyDecision => {
  if (!existing) return { outcome: "new" };
  const sameScope =
    existing.scope.actor_id === incoming.scope.actor_id &&
    existing.scope.operation === incoming.scope.operation &&
    existing.scope.resource_id === incoming.scope.resource_id;
  if (sameScope && existing.idempotency_key === incoming.idempotency_key && existing.request_digest === incoming.request_digest) {
    return { outcome: "replay" };
  }
  if (sameScope && existing.idempotency_key === incoming.idempotency_key) {
    return { outcome: "conflict", error_code: "IDEMPOTENCY_CONFLICT" };
  }
  return { outcome: "new" };
};

export const IdempotencyRetentionExpectationSchema = z.strictObject({
  retained_until: UtcTimestampSchema,
  policy_name: z.string().min(1).max(120),
});

