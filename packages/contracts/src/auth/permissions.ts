import { z } from "zod";

import type { UserRole } from "./roles.js";

export const PermissionSchema = z.enum([
  "recovery_record:create",
  "recovery_record:correct_own",
  "recovery_record:view_own",
  "recovery_record:view_operational",
  "handoff:record",
  "handoff:accept",
  "processing:record",
  "processing:complete",
  "review:flag",
  "review:evidence",
  "review:approve",
  "review:reject",
  "review:request_correction",
  "safety_content:manage",
  "model_correction:review",
  "model_performance:view",
  "programme_report:view",
  "programme_data:export",
  "personal_data:view",
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const AuthorizationContextSchema = z.strictObject({
  owns_resource: z.boolean().default(false),
  assigned_programme: z.boolean().default(false),
  assigned_facility: z.boolean().default(false),
  assigned_review: z.boolean().default(false),
  personal_data_required: z.boolean().default(false),
});

export type AuthorizationContext = z.infer<typeof AuthorizationContextSchema>;

const BASE_PERMISSIONS = {
  collector: ["recovery_record:create", "recovery_record:correct_own", "recovery_record:view_own"],
  recycler: [
    "recovery_record:view_operational",
    "handoff:record",
    "handoff:accept",
    "processing:record",
    "processing:complete",
  ],
  programme_reviewer: [
    "recovery_record:view_operational",
    "review:flag",
    "review:evidence",
    "review:approve",
    "review:reject",
    "review:request_correction",
    "personal_data:view",
  ],
  programme_manager: [
    "recovery_record:view_operational",
    "programme_report:view",
    "programme_data:export",
    "personal_data:view",
  ],
  safety_content_administrator: ["safety_content:manage"],
  data_ml_reviewer: ["model_correction:review", "model_performance:view"],
} as const satisfies Record<UserRole, readonly Permission[]>;

export const ROLE_PERMISSIONS = {
  collector: new Set<Permission>(BASE_PERMISSIONS.collector),
  recycler: new Set<Permission>(BASE_PERMISSIONS.recycler),
  programme_reviewer: new Set<Permission>(BASE_PERMISSIONS.programme_reviewer),
  programme_manager: new Set<Permission>(BASE_PERMISSIONS.programme_manager),
  safety_content_administrator: new Set<Permission>(BASE_PERMISSIONS.safety_content_administrator),
  data_ml_reviewer: new Set<Permission>(BASE_PERMISSIONS.data_ml_reviewer),
} as const satisfies Readonly<Record<UserRole, ReadonlySet<Permission>>>;

const hasRequiredScope = (
  role: UserRole,
  permission: Permission,
  context: AuthorizationContext,
): boolean => {
  if (permission === "recovery_record:view_own" || permission === "recovery_record:correct_own") {
    return role === "collector" && context.owns_resource;
  }
  if (role === "recycler") {
    return context.assigned_facility;
  }
  if (role === "programme_reviewer") {
    return context.assigned_programme && context.assigned_review;
  }
  if (role === "programme_manager") {
    return context.assigned_programme;
  }
  return true;
};

export const isPermissionAllowed = (
  role: UserRole,
  permission: Permission,
  context: AuthorizationContext,
): boolean => {
  if (!ROLE_PERMISSIONS[role].has(permission)) {
    return false;
  }
  if (context.personal_data_required && !ROLE_PERMISSIONS[role].has("personal_data:view")) {
    return false;
  }
  return hasRequiredScope(role, permission, context);
};
