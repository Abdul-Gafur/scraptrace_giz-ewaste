import { z } from "zod";

import { Sha256DigestSchema } from "../common/integrity.js";

export const SyncConflictCodeSchema = z.enum([
  "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
  "STALE_BASE_REVISION",
  "DUPLICATE_RECORD",
  "CLIENT_AND_SERVER_CHANGED",
  "UNSUPPORTED_CONTRACT_VERSION",
  "INTEGRITY_VERIFICATION_FAILED",
  "PERMANENT_VALIDATION_FAILURE",
  "TEMPORARY_SERVICE_FAILURE",
]);

export const SyncConflictSchema = z.strictObject({
  code: SyncConflictCodeSchema,
  message: z.string().min(1).max(500),
  retryable: z.boolean(),
  client_revision: z.number().int().nonnegative().optional(),
  server_revision: z.number().int().nonnegative().optional(),
  client_digest: Sha256DigestSchema.optional(),
  server_digest: Sha256DigestSchema.optional(),
  resolution: z.enum(["replay_original", "refresh_and_review", "manual_merge", "correct_and_resubmit", "retry_later", "stop"]),
});

