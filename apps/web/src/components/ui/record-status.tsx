import type { RecoveryRecordState, SynchronizationState } from "@scraptrace/contracts";

import { StatusBadge } from "./status-badge";

interface RecordStatusProps {
  state: RecoveryRecordState;
  synchronization?: SynchronizationState;
  gps?: "verified_gps" | "unverified_gps";
}

/**
 * Lifecycle, synchronization and GPS-trust badges for one record. Each is a separate meaning
 * and is never merged into a single "status" (see the Figma meaning registry).
 */
export function RecordStatus({ state, synchronization, gps }: RecordStatusProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <StatusBadge status={state} />
      {synchronization ? <StatusBadge status={synchronization} /> : null}
      {gps ? <StatusBadge status={gps} /> : null}
    </span>
  );
}
