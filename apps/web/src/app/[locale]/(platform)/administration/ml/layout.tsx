import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { OperationalShell } from "@/components/layout/operational-shell";

export default async function MlLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("navigation");
  return (
    <OperationalShell role={UserRoleSchema.enum.data_ml_reviewer} pageLabel={t("ml")}>
      {children}
    </OperationalShell>
  );
}
