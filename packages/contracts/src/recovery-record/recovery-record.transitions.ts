import type { TransitionActorRole } from "../auth/roles.js";
import type { EvidenceType } from "../evidence/evidence.schema.js";
import type { RecoveryRecordEventType } from "./recovery-record.events.js";
import { TERMINAL_RECOVERY_RECORD_STATES, type RecoveryRecordState } from "./recovery-record.states.js";

export interface RecoveryRecordTransitionRule {
  readonly from: RecoveryRecordState;
  readonly event: RecoveryRecordEventType;
  readonly required_roles: readonly TransitionActorRole[];
  readonly required_evidence: readonly EvidenceType[];
  readonly to: RecoveryRecordState;
  readonly allowed_offline: boolean;
  readonly retry_safe: boolean;
  readonly validation_failure: string;
  readonly requires_no_unresolved_flags?: boolean;
}

export const RECOVERY_RECORD_TRANSITIONS = [
  {
    from: "draft",
    event: "submit_record",
    required_roles: ["collector"],
    required_evidence: ["original_item_photo"],
    to: "submitted",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "A validated draft and original item photograph are required.",
  },
  {
    from: "submitted",
    event: "publish_for_handoff",
    required_roles: ["system"],
    required_evidence: ["original_item_photo"],
    to: "awaiting_handoff",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "The submitted record must pass server validation.",
  },
  {
    from: "awaiting_handoff",
    event: "record_handoff",
    required_roles: ["recycler"],
    required_evidence: ["handoff_qr_scan", "recycler_receipt", "handoff_photo", "weight_measurement"],
    to: "received",
    allowed_offline: true,
    retry_safe: true,
    validation_failure: "Authorised recycler receipt, handoff, and readable weight evidence are required.",
  },
  {
    from: "received",
    event: "record_processing",
    required_roles: ["recycler"],
    required_evidence: ["processing_completion"],
    to: "processing_recorded",
    allowed_offline: true,
    retry_safe: true,
    validation_failure: "A controlled processing result and supporting evidence are required.",
  },
  {
    from: "processing_recorded",
    event: "mark_processing_complete",
    required_roles: ["recycler"],
    required_evidence: ["processing_completion"],
    to: "completed",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "Processing evidence must be durably received before completion.",
  },
  {
    from: "processing_recorded",
    event: "flag_for_review",
    required_roles: ["system", "programme_reviewer"],
    required_evidence: [],
    to: "under_review",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "A named review reason is required by the command contract.",
  },
  {
    from: "completed",
    event: "flag_for_review",
    required_roles: ["system", "programme_reviewer"],
    required_evidence: [],
    to: "under_review",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "A named review reason is required by the command contract.",
  },
  {
    from: "completed",
    event: "approve_unflagged_completion",
    required_roles: ["system"],
    required_evidence: ["handoff_photo", "weight_measurement", "processing_completion"],
    to: "approved_and_completed",
    allowed_offline: false,
    retry_safe: true,
    requires_no_unresolved_flags: true,
    validation_failure: "Required evidence must be complete and no review flag may remain unresolved.",
  },
  {
    from: "under_review",
    event: "approve_review",
    required_roles: ["programme_reviewer"],
    required_evidence: ["reviewer_decision"],
    to: "approved_and_completed",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "A reasoned reviewer decision is required.",
  },
  {
    from: "under_review",
    event: "request_correction",
    required_roles: ["programme_reviewer"],
    required_evidence: ["reviewer_decision"],
    to: "under_review",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "A reason and requested correction are required.",
  },
  {
    from: "under_review",
    event: "reject_review",
    required_roles: ["programme_reviewer"],
    required_evidence: ["reviewer_decision"],
    to: "rejected",
    allowed_offline: false,
    retry_safe: true,
    validation_failure: "A reasoned reviewer rejection is required.",
  },
] as const satisfies readonly RecoveryRecordTransitionRule[];

export type TransitionFailureCode =
  | "TERMINAL_STATE"
  | "TRANSITION_NOT_ALLOWED"
  | "ROLE_NOT_ALLOWED"
  | "MISSING_EVIDENCE"
  | "UNRESOLVED_FLAGS"
  | "OFFLINE_NOT_ALLOWED";

export type TransitionResult =
  | { readonly ok: true; readonly previous_state: RecoveryRecordState; readonly next_state: RecoveryRecordState; readonly retry_safe: boolean }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: TransitionFailureCode;
        readonly message: string;
        readonly missing_evidence?: readonly EvidenceType[];
      };
    };

export interface TransitionInput {
  readonly current_state: RecoveryRecordState;
  readonly event: RecoveryRecordEventType;
  readonly actor_role: TransitionActorRole;
  readonly available_evidence: ReadonlySet<EvidenceType>;
  readonly is_offline: boolean;
  readonly has_unresolved_flags: boolean;
}

export const transitionRecoveryRecord = (input: TransitionInput): TransitionResult => {
  if (TERMINAL_RECOVERY_RECORD_STATES.has(input.current_state)) {
    return { ok: false, error: { code: "TERMINAL_STATE", message: "Terminal records require a reviewed amendment; they cannot be reopened by a transition." } };
  }

  const rule = (RECOVERY_RECORD_TRANSITIONS as readonly RecoveryRecordTransitionRule[]).find(
    (candidate) => candidate.from === input.current_state && candidate.event === input.event,
  );
  if (!rule) {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: "The event is not valid for the current recovery-record state." } };
  }
  if (!(rule.required_roles as readonly TransitionActorRole[]).includes(input.actor_role)) {
    return { ok: false, error: { code: "ROLE_NOT_ALLOWED", message: "The actor role cannot perform this transition." } };
  }
  if (input.is_offline && !rule.allowed_offline) {
    return { ok: false, error: { code: "OFFLINE_NOT_ALLOWED", message: "This transition requires server acknowledgement." } };
  }
  const missing = rule.required_evidence.filter((evidence) => !input.available_evidence.has(evidence));
  if (missing.length > 0) {
    return { ok: false, error: { code: "MISSING_EVIDENCE", message: rule.validation_failure, missing_evidence: missing } };
  }
  if (rule.requires_no_unresolved_flags === true && input.has_unresolved_flags) {
    return { ok: false, error: { code: "UNRESOLVED_FLAGS", message: rule.validation_failure } };
  }
  return { ok: true, previous_state: input.current_state, next_state: rule.to, retry_safe: rule.retry_safe };
};
