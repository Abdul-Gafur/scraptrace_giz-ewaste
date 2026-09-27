import { UserRoleSchema, type UserRole } from "@scraptrace/contracts";

import { createLocalServices, createTestServices } from "@/services/local/local-services";
import type { FrontendServices } from "@/services/ports/service-ports";

/**
 * Development service factory.
 *
 * The development mode is no longer a set of fixed fixture responses: it is the browser-backed
 * repository implementation in `services/local`, which every role shares. This module keeps the
 * older entry point so existing callers and tests do not need to change.
 */

export interface MockServiceOptions {
  readonly role?: UserRole;
  readonly delayMilliseconds?: number;
  /** Use an isolated repository instead of the shared one, for tests. */
  readonly isolated?: boolean;
}

export const createMockServices = ({
  role = UserRoleSchema.enum.collector,
  delayMilliseconds = 0,
  isolated = false,
}: MockServiceOptions = {}): FrontendServices =>
  isolated
    ? createTestServices({ role }).services
    : createLocalServices({ role, delayMilliseconds });
