"use client";

import type { UserRole } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";

import { useAuthenticationOptional } from "@/auth/auth-session";
import { PageLoading } from "@/components/feedback/page-loading";
import { useRouter } from "@/i18n/navigation";
import { useServiceConfigurationOptional } from "@/services/service-provider";

/** HTTP-mode route guard. The API remains the authority for every object and action. */
export function WorkspaceGuard({
  role,
  children,
}: {
  readonly role: UserRole;
  children: ReactNode;
}) {
  const configuration = useServiceConfigurationOptional();
  const authentication = useAuthenticationOptional();
  const mode = configuration?.mode ?? "mock";
  const session = authentication?.session ?? null;
  const status = authentication?.status ?? "anonymous";
  const router = useRouter();
  const locale = useLocale();
  const translate = useTranslations("common");

  useEffect(() => {
    if (mode === "mock" || status === "loading") return;
    if (!session) router.replace("/session-expired");
    else if (session.role !== role) router.replace("/access-denied");
  }, [locale, mode, role, router, session, status]);

  if (mode === "mock") return <>{children}</>;
  if (status === "loading") return <PageLoading label={translate("loading")} />;
  if (!session || session.role !== role) return <PageLoading label={translate("loading")} />;
  return <>{children}</>;
}
