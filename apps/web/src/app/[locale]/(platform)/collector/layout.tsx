import type { ReactNode } from "react";

import { CollectorShell } from "@/components/layout/collector-shell";

export default function CollectorLayout({ children }: { children: ReactNode }) {
  return <CollectorShell>{children}</CollectorShell>;
}
