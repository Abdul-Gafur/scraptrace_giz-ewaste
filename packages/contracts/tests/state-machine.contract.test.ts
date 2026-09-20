import { describe, expect, it } from "vitest";

import { RECOVERY_RECORD_TRANSITIONS, transitionRecoveryRecord, TransitionActorRoleSchema, type EvidenceType } from "../src/index.js";

describe("recovery-record state machine", () => {
  for (const rule of RECOVERY_RECORD_TRANSITIONS) {
    it(`allows ${rule.from} --${rule.event}--> ${rule.to} for each required role`, () => {
      for (const role of rule.required_roles) {
        const result = transitionRecoveryRecord({
          current_state: rule.from,
          event: rule.event,
          actor_role: role,
          available_evidence: new Set<EvidenceType>(rule.required_evidence),
          is_offline: false,
          has_unresolved_flags: false,
        });
        expect(result).toEqual({
          ok: true,
          previous_state: rule.from,
          next_state: rule.to,
          retry_safe: rule.retry_safe,
        });
      }
    });

    it(`rejects unapproved roles for ${rule.from} --${rule.event}--> ${rule.to}`, () => {
      for (const role of TransitionActorRoleSchema.options) {
        if ((rule.required_roles as readonly string[]).includes(role)) continue;
        const result = transitionRecoveryRecord({
          current_state: rule.from,
          event: rule.event,
          actor_role: role,
          available_evidence: new Set<EvidenceType>(rule.required_evidence),
          is_offline: false,
          has_unresolved_flags: false,
        });
        expect(result).toMatchObject({ ok: false, error: { code: "ROLE_NOT_ALLOWED" } });
      }
    });
  }

  it("rejects a role that is not permitted", () => {
    const result = transitionRecoveryRecord({
      current_state: "awaiting_handoff",
      event: "record_handoff",
      actor_role: "collector",
      available_evidence: new Set<EvidenceType>(["handoff_qr_scan", "recycler_receipt", "handoff_photo", "weight_measurement"]),
      is_offline: false,
      has_unresolved_flags: false,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "ROLE_NOT_ALLOWED" } });
  });

  it("reports missing evidence", () => {
    const result = transitionRecoveryRecord({
      current_state: "awaiting_handoff",
      event: "record_handoff",
      actor_role: "recycler",
      available_evidence: new Set<EvidenceType>(),
      is_offline: false,
      has_unresolved_flags: false,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "MISSING_EVIDENCE" } });
  });

  it("does not permit a server-authoritative transition offline", () => {
    const result = transitionRecoveryRecord({
      current_state: "draft",
      event: "submit_record",
      actor_role: "collector",
      available_evidence: new Set<EvidenceType>(["original_item_photo"]),
      is_offline: true,
      has_unresolved_flags: false,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "OFFLINE_NOT_ALLOWED" } });
  });

  it("blocks silent reopening of terminal records", () => {
    const result = transitionRecoveryRecord({
      current_state: "approved_and_completed",
      event: "flag_for_review",
      actor_role: "programme_reviewer",
      available_evidence: new Set<EvidenceType>(),
      is_offline: false,
      has_unresolved_flags: false,
    });
    expect(result).toMatchObject({ ok: false, error: { code: "TERMINAL_STATE" } });
  });
});
