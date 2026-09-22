import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { OperationalShell } from "@/components/layout/operational-shell";

export default function RecyclerLayout({ children }: { children: ReactNode }) {
  return <OperationalShell role={UserRoleSchema.enum.recycler}>{children}</OperationalShell>;
}
