import { describe, expect, it } from "vitest";

import { isPermissionAllowed, PermissionSchema, ROLE_PERMISSIONS, UserRoleSchema } from "../src/index.js";

const noScope = { owns_resource: false, assigned_programme: false, assigned_facility: false, assigned_review: false, personal_data_required: false };

describe("deny-by-default permissions", () => {
  it("denies every role permission not explicitly granted", () => {
    for (const role of UserRoleSchema.options) {
      for (const permission of PermissionSchema.options) {
        if (ROLE_PERMISSIONS[role].has(permission)) continue;
        expect(isPermissionAllowed(role, permission, noScope)).toBe(false);
      }
    }
  });

  it("allows explicitly granted actions that do not require resource scope", () => {
    expect(isPermissionAllowed("collector", "recovery_record:create", noScope)).toBe(true);
    expect(isPermissionAllowed("safety_content_administrator", "safety_content:manage", noScope)).toBe(true);
    expect(isPermissionAllowed("data_ml_reviewer", "model_performance:view", noScope)).toBe(true);
  });

  it("lets a collector view and correct only their own record", () => {
    const own = { ...noScope, owns_resource: true };
    expect(isPermissionAllowed("collector", "recovery_record:view_own", own)).toBe(true);
    expect(isPermissionAllowed("collector", "recovery_record:correct_own", own)).toBe(true);
    expect(isPermissionAllowed("collector", "handoff:record", own)).toBe(false);
  });

  it("requires a recycler facility assignment", () => {
    expect(isPermissionAllowed("recycler", "handoff:record", noScope)).toBe(false);
    expect(isPermissionAllowed("recycler", "handoff:record", { ...noScope, assigned_facility: true })).toBe(true);
  });

  it("separates programme review, content, and model-data authority", () => {
    const reviewScope = { ...noScope, assigned_programme: true, assigned_review: true };
    expect(isPermissionAllowed("programme_reviewer", "review:approve", reviewScope)).toBe(true);
    expect(isPermissionAllowed("programme_manager", "review:approve", reviewScope)).toBe(false);
    expect(isPermissionAllowed("safety_content_administrator", "model_correction:review", noScope)).toBe(false);
    expect(isPermissionAllowed("data_ml_reviewer", "safety_content:manage", noScope)).toBe(false);
  });

  it("limits reviewers to assigned reviews and composes personal-data permission", () => {
    const programmeOnly = { ...noScope, assigned_programme: true };
    const assignedReview = { ...programmeOnly, assigned_review: true, personal_data_required: true };
    expect(isPermissionAllowed("programme_reviewer", "personal_data:view", programmeOnly)).toBe(false);
    expect(isPermissionAllowed("programme_reviewer", "recovery_record:view_operational", assignedReview)).toBe(true);
    expect(isPermissionAllowed("recycler", "recovery_record:view_operational", {
      ...noScope,
      assigned_facility: true,
      personal_data_required: true,
    })).toBe(false);
  });

  it("limits programme managers to their assigned programme", () => {
    expect(isPermissionAllowed("programme_manager", "programme_report:view", noScope)).toBe(false);
    expect(isPermissionAllowed("programme_manager", "programme_report:view", {
      ...noScope,
      assigned_programme: true,
    })).toBe(true);
  });
});
