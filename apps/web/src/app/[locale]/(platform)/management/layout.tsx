import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { OperationalShell } from "@/components/layout/operational-shell";

export default function ManagementLayout({ children }: { children: ReactNode }) {
  return (
    <OperationalShell role={UserRoleSchema.enum.programme_manager}>{children}</OperationalShell>
  );
}
