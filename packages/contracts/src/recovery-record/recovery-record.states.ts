import { z } from "zod";

export const RecoveryRecordStateSchema = z.enum([
  "draft",
  "submitted",
  "awaiting_handoff",
  "received",
  "processing_recorded",
  "completed",
  "under_review",
  "approved_and_completed",
  "rejected",
]);

export const HandoffStateSchema = z.enum(["not_started", "awaiting", "received", "disputed"]);
export const ProcessingStateSchema = z.enum([
  "not_started",
  "in_progress",
  "evidence_recorded",
  "completed",
]);
export const ReviewStateSchema = z.enum([
  "not_required",
  "open",
  "awaiting_information",
  "approved",
  "rejected",
]);
export const SynchronizationStateSchema = z.enum([
  "offline",
  "pending_synchronization",
  "synchronizing",
  "synchronized",
  "action_required",
]);

export type RecoveryRecordState = z.infer<typeof RecoveryRecordStateSchema>;
export type HandoffState = z.infer<typeof HandoffStateSchema>;
export type ProcessingState = z.infer<typeof ProcessingStateSchema>;
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export type SynchronizationState = z.infer<typeof SynchronizationStateSchema>;

export const TERMINAL_RECOVERY_RECORD_STATES = new Set<RecoveryRecordState>([
  "approved_and_completed",
  "rejected",
]);

