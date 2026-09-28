import { z } from "zod";

import { ActorReferenceSchema, EventIdSchema, EvidenceIdSchema, RecoveryRecordIdSchema } from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import { TransitionActorRoleSchema } from "../auth/roles.js";
import { EVENT_SCHEMA_VERSION } from "../schema-version.js";
import { RecoveryRecordStateSchema } from "./recovery-record.states.js";
import { ReviewFlagCodeSchema } from "./review-codes.js";

/** Events that move a record through the lifecycle state machine. */
export const LIFECYCLE_EVENT_TYPES = [
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
] as const;

/**
 * Persisted facts about a record that do not change its business state. The previous and
 * resulting states are therefore equal. Each is written by the server in the same transaction
 * as the change it describes; clients never synthesise them.
 */
export const RECORD_FACT_EVENT_TYPES = [
  "draft_created",
  "evidence_added",
  "appraisal_recorded",
  "category_confirmed",
  "category_corrected",
  "qr_issued",
  "qr_rotated",
  "review_opened",
] as const;

export const LifecycleEventTypeSchema = z.enum(LIFECYCLE_EVENT_TYPES);
export const RecordFactEventTypeSchema = z.enum(RECORD_FACT_EVENT_TYPES);
export const RecoveryRecordEventTypeSchema = z.enum([...LIFECYCLE_EVENT_TYPES, ...RECORD_FACT_EVENT_TYPES]);

export const isLifecycleEventType = (value: string): value is LifecycleEventType =>
  (LIFECYCLE_EVENT_TYPES as readonly string[]).includes(value);

/**
 * One timeline entry. An absent `actor` means the system acted (`actor_role: "system"`); it is
 * omitted, never `null`. `evidence_id` names the evidence an `evidence_added` event describes,
 * and `flag_codes` the flags a `review_opened` or `flag_for_review` event raised.
 */
export const RecoveryRecordEventSchema = z
  .strictObject({
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
    evidence_id: EvidenceIdSchema.optional(),
    flag_codes: z.array(ReviewFlagCodeSchema).min(1).max(50).optional(),
  })
  .superRefine((value, context) => {
    if (!isLifecycleEventType(value.event_type) && value.previous_state !== value.resulting_state) {
      context.addIssue({
        code: "custom",
        path: ["resulting_state"],
        message: "A record fact event does not change the business state.",
      });
    }
    if (value.actor_role !== "system" && !value.actor) {
      context.addIssue({ code: "custom", path: ["actor"], message: "A user event names its actor." });
    }
  });

/** A record's timeline in occurrence order. Bounded per record, so not paginated. */
export const RecoveryRecordEventListSchema = z.array(RecoveryRecordEventSchema).max(1_000);

export type LifecycleEventType = z.infer<typeof LifecycleEventTypeSchema>;
export type RecordFactEventType = z.infer<typeof RecordFactEventTypeSchema>;
export type RecoveryRecordEventType = z.infer<typeof RecoveryRecordEventTypeSchema>;
export type RecoveryRecordEvent = z.infer<typeof RecoveryRecordEventSchema>;
