import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { OperationalShell } from "@/components/layout/operational-shell";

export default async function RecyclerLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("navigation");
  return (
    <OperationalShell role={UserRoleSchema.enum.recycler} pageLabel={t("recycler")}>
      {children}
    </OperationalShell>
  );
}
