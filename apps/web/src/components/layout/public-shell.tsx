import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { OfflineNotice } from "@/components/feedback/connectivity";
import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Public and information pages: brand, language control, sign-in entry and content. */
export function PublicShell({ children }: { children: ReactNode }) {
  const translate = useTranslations("common");
  return (
    <div className="min-h-screen" data-shell="public">
      <OfflineNotice />
      <header className="bg-surface border-b">
        <div className="content-container flex min-h-16 items-center justify-between gap-3">
          <Link aria-label={translate("brand")} href="/">
            <BrandMark label={translate("brand")} />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link className={buttonVariants({ variant: "secondary" })} href="/sign-in">
              {translate("signIn")}
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
