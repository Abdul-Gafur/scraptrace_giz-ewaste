import type { QueuedMutation, RecoveryRecord, SynchronizationState } from "@scraptrace/contracts";

export interface LocalRecoveryRecordStorage {
  get(recordId: string): Promise<RecoveryRecord | null>;
  put(record: RecoveryRecord): Promise<void>;
  remove(recordId: string): Promise<void>;
  clearForCurrentUser(): Promise<void>;
}

export interface MutationQueue {
  enqueue(mutation: QueuedMutation): Promise<void>;
  pending(): Promise<readonly QueuedMutation[]>;
  remove(clientMutationId: string): Promise<void>;
}

export interface SynchronizationStatusStore {
  get(recordId: string): Promise<SynchronizationState>;
  set(recordId: string, state: SynchronizationState): Promise<void>;
}

export interface ConnectivityStatus {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export interface CachedSafetyGuidanceStore {
  get(cacheKey: string): Promise<unknown | null>;
  put(cacheKey: string, validatedGuidance: unknown): Promise<void>;
}
