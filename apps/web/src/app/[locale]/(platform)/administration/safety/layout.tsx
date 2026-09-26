import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";

import { AdministrationShell } from "@/components/layout/administration-shell";

export default function SafetyLayout({ children }: { children: ReactNode }) {
  return (
    <AdministrationShell role={UserRoleSchema.enum.safety_content_administrator}>
      {children}
    </AdministrationShell>
  );
}
