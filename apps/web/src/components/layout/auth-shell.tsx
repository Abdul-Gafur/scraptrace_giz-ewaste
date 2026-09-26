import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { OfflineNotice } from "@/components/feedback/connectivity";
import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { Link } from "@/i18n/navigation";

/**
 * Sign-in, registration and onboarding: brand and language control above a single narrow
 * column that stacks naturally on phones and stays readable on desktop.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const translate = useTranslations("common");
  return (
    <div className="min-h-screen" data-shell="authentication">
      <OfflineNotice />
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-4">
        <Link aria-label={translate("brand")} href="/">
          <BrandMark label={translate("brand")} />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-8" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
