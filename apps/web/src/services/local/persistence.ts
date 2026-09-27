/**
 * Refresh-safe storage for the demonstration repository.
 *
 * `localStorage` is used when it is available and writable; otherwise the same interface falls
 * back to a module-level map so server rendering, private windows, blocked site data and tests
 * all behave the same. Every access is guarded, because a quota or security error must never
 * take a screen down, and a failed write is reported rather than silently claimed as saved
 * (FR-OFF-007).
 */

export interface PersistentStore {
  read(): unknown | null;
  write(value: unknown): { readonly ok: true } | { readonly ok: false; readonly reason: string };
  clear(): void;
  readonly durable: boolean;
}

const memory = new Map<string, string>();

const browserStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__scraptrace_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
};

export const createPersistentStore = (key: string): PersistentStore => {
  const storage = browserStorage();
  return {
    durable: storage !== null,
    read() {
      try {
        const raw = storage ? storage.getItem(key) : (memory.get(key) ?? null);
        return raw === null ? null : (JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    write(value) {
      let serialized: string;
      try {
        serialized = JSON.stringify(value);
      } catch {
        return { ok: false, reason: "serialization_failed" };
      }
      try {
        if (storage) storage.setItem(key, serialized);
        else memory.set(key, serialized);
        return { ok: true };
      } catch (error) {
        const reason =
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "storage_full"
            : "storage_unavailable";
        return { ok: false, reason };
      }
    },
    clear() {
      try {
        if (storage) storage.removeItem(key);
        else memory.delete(key);
      } catch {
        // Nothing further to do: the caller keeps its in-memory state.
      }
    },
  };
};

/** Test and sign-out support: drops the in-memory fallback for every key. */
export const clearMemoryStores = (): void => memory.clear();
