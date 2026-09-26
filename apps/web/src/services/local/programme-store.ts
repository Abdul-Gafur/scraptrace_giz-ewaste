import { createSeedState } from "./seed";
import type { ProgrammeState } from "./state";

/**
 * The programme state this build keeps in the browser. It is the stand-in for the services a
 * backend will own: screens read and write it only through the service ports, never directly.
 *
 * It is persisted to `localStorage` so a reload, a new tab or an offline session keeps the same
 * records. Photographs are far too large for that budget and live in the evidence store.
 */

const STORAGE_KEY = "scraptrace.programme.v1";

/** The snapshot the server renders and the client hydrates against: always the seed. */
const serverSnapshot = createSeedState();

let snapshot: ProgrammeState = serverSnapshot;
let hydrated = false;
const listeners = new Set<() => void>();

const readStorage = (): ProgrammeState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProgrammeState;
    // A stored state from an older shape is discarded rather than migrated: this is local
    // demonstration data, and a half-migrated record would be worse than starting again.
    return parsed.schemaVersion === serverSnapshot.schemaVersion ? parsed : null;
  } catch {
    return null;
  }
};

const writeStorage = (state: ProgrammeState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or blocked storage area must not break the session in progress.
  }
};

const hydrate = (): void => {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snapshot = readStorage() ?? serverSnapshot;
};

export const getProgrammeState = (): ProgrammeState => {
  hydrate();
  return snapshot;
};

export const getServerProgrammeState = (): ProgrammeState => serverSnapshot;

export const subscribeToProgrammeState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Applies a change, persists it and notifies subscribers. Returns the new state. */
export const updateProgrammeState = (
  change: (current: ProgrammeState) => ProgrammeState,
): ProgrammeState => {
  hydrate();
  snapshot = change(snapshot);
  if (typeof window !== "undefined") writeStorage(snapshot);
  for (const listener of listeners) listener();
  return snapshot;
};

/** Returns the programme to its seeded state. Used by "clear local data" and by tests. */
export const resetProgrammeState = (): ProgrammeState =>
  updateProgrammeState(() => createSeedState());

/** Bytes the stored state currently occupies, for the local-data screen. */
export const getStoredStateSize = (): number => {
  if (typeof window === "undefined") return 0;
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.length ?? 0;
  } catch {
    return 0;
  }
};
