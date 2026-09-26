import type { ReactNode } from "react";

import { SecurityShell } from "@/components/layout/security-shell";

export default function SecurityLayout({ children }: { children: ReactNode }) {
  return <SecurityShell>{children}</SecurityShell>;
}
