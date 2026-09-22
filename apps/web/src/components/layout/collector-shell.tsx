import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";

/** Mobile-first collector workspace: bottom navigation, offline notice, sidebar from 1024px. */
export function CollectorShell({ children }: { children: ReactNode }) {
  return (
    <AppShell kind="collector-workspace" role={UserRoleSchema.enum.collector}>
      {children}
    </AppShell>
  );
}
