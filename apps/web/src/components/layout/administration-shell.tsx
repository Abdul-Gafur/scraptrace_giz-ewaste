import type { UserRole } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";

/**
 * Safety-content administrators and data/ML reviewers. Figma shows the same frame as the
 * operational workspaces, so this reuses it with its own shell marker for verification.
 */
export function AdministrationShell({ role, children }: { role: UserRole; children: ReactNode }) {
  return (
    <AppShell kind="administration" role={role}>
      {children}
    </AppShell>
  );
}
