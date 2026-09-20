import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { Link } from "@/i18n/navigation";

export async function PublicShell({ children }: { children: ReactNode }) {
  const translate = await getTranslations("common");
  return (
    <div className="min-h-screen">
      <header className="border-b bg-[var(--color-surface)]">
        <div className="content-container flex min-h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={translate("brand")}>
            <BrandMark label={translate("brand")} />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}
