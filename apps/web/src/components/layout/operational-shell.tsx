import type { UserRole } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";

/** Recycler, programme reviewer and programme manager workspaces. */
export function OperationalShell({ role, children }: { role: UserRole; children: ReactNode }) {
  return (
    <AppShell kind="operational" role={role}>
      {children}
    </AppShell>
  );
}
