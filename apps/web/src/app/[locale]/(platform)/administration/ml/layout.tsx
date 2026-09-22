import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { AdministrationShell } from "@/components/layout/administration-shell";

export default function MlLayout({ children }: { children: ReactNode }) {
  return (
    <AdministrationShell role={UserRoleSchema.enum.data_ml_reviewer}>
      {children}
    </AdministrationShell>
  );
}
