import { isPermissionAllowed, type Permission, type RecoveryRecord } from "@scraptrace/contracts";

import { authorizationContextFor, type ActorContext } from "@/auth/actors";

import { permissionDenied } from "./errors";
import type { ScrapTraceRepository } from "./repository";

/** Shared state for every locally implemented service. */
export interface LocalServiceContext {
  readonly repository: ScrapTraceRepository;
  readonly actor: ActorContext;
  /** Simulated latency so loading states are observable in the demonstration. */
  readonly delayMilliseconds: number;
}

export const pause = (milliseconds: number): Promise<void> =>
  milliseconds <= 0
    ? Promise.resolve()
    : new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
      });

export interface PermissionOptions {
  readonly record?: RecoveryRecord;
  readonly personalDataRequired?: boolean;
  /**
   * Set when the check is about a scope rather than one object, for example a collector listing
   * their own records before any record exists.
   */
  readonly ownsResource?: boolean;
}

/**
 * Evaluates one contract permission for the acting actor. This is the only place a service
 * decides whether an action is allowed, and it always defers to `isPermissionAllowed`.
 */
export const isAllowed = (
  context: LocalServiceContext,
  permission: Permission,
  options: PermissionOptions = {},
): boolean => {
  const base = authorizationContextFor(context.actor, options);
  const scoped =
    options.ownsResource === undefined ? base : { ...base, owns_resource: options.ownsResource };
  return isPermissionAllowed(context.actor.role, permission, scoped);
};

/** Throws the standard `PERMISSION_DENIED` envelope when the action is not allowed. */
export const requirePermission = (
  context: LocalServiceContext,
  permission: Permission,
  options: PermissionOptions = {},
): void => {
  if (!isAllowed(context, permission, options)) throw permissionDenied();
};
