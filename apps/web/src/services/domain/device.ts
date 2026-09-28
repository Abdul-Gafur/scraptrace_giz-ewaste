import { DeviceInstanceIdSchema } from "@scraptrace/contracts";
import type { z } from "zod";

import { newDeviceInstanceId } from "@/services/domain/identifiers";

/** Released web application version, recorded in evidence provenance. */
export const APPLICATION_VERSION = "0.1.0";

const STORAGE_KEY = "scraptrace.device-instance-id";

let memoryDeviceId: z.infer<typeof DeviceInstanceIdSchema> | undefined;

/**
 * The application-generated device-instance identifier recorded in provenance (ADR-004). It is
 * a random UUIDv7, not a hardware fingerprint and not a credential, so it may live in browser
 * storage; when storage is unavailable it lasts for the page's lifetime.
 */
export const deviceInstanceId = (): z.infer<typeof DeviceInstanceIdSchema> => {
  if (memoryDeviceId) return memoryDeviceId;
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = DeviceInstanceIdSchema.safeParse(stored);
    if (parsed.success) {
      memoryDeviceId = parsed.data;
      return parsed.data;
    }
    const created = newDeviceInstanceId();
    globalThis.localStorage?.setItem(STORAGE_KEY, created);
    memoryDeviceId = created;
    return created;
  } catch {
    memoryDeviceId = newDeviceInstanceId();
    return memoryDeviceId;
  }
};
