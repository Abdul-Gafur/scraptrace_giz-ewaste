import { z } from "zod";

import { ActorReferenceSchema, EventIdSchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { TransitionActorRoleSchema } from "../auth/roles.js";
import { EVENT_SCHEMA_VERSION } from "../schema-version.js";
import { RecoveryRecordStateSchema } from "./recovery-record.states.js";

export const RecoveryRecordEventTypeSchema = z.enum([
  "submit_record",
  "publish_for_handoff",
  "record_handoff",
  "record_processing",
  "mark_processing_complete",
  "flag_for_review",
  "approve_unflagged_completion",
  "approve_review",
  "request_correction",
  "reject_review",
]);

export const RecoveryRecordEventSchema = z.strictObject({
  event_schema_version: z.literal(EVENT_SCHEMA_VERSION),
  event_id: EventIdSchema,
  recovery_record_id: RecoveryRecordIdSchema,
  event_type: RecoveryRecordEventTypeSchema,
  actor: ActorReferenceSchema.optional(),
  actor_role: TransitionActorRoleSchema,
  occurred_at: UtcTimestampSchema,
  previous_state: RecoveryRecordStateSchema,
  resulting_state: RecoveryRecordStateSchema,
  reason: z.string().min(1).max(1_000).optional(),
});

export type RecoveryRecordEventType = z.infer<typeof RecoveryRecordEventTypeSchema>;
export type RecoveryRecordEvent = z.infer<typeof RecoveryRecordEventSchema>;

