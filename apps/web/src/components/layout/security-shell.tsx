import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ConnectionIndicator, OfflineNotice } from "@/components/feedback/connectivity";
import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Divider } from "@/components/ui/content";
import { Link } from "@/i18n/navigation";

/**
 * Figma: SharedSecurityStatesShell. The frame's chrome — brand, the "System Security View"
 * badge, connectivity, language and an account control — above a single centred card.
 *
 * The frame's account control is a signed-in user menu with "Sign Out". These routes are
 * reached without a usable session, so it is a sign-in link instead: offering to sign out of a
 * session that has just expired would be untrue.
 */
export function SecurityShell({ children }: { children: ReactNode }) {
  const translate = useTranslations("common");
  const translateSecurity = useTranslations("security");
  return (
    <div className="min-h-screen" data-shell="security">
      <OfflineNotice />
      <header className="bg-surface sm:h-header flex min-h-16 items-center gap-3 border-b px-4 sm:gap-4 sm:px-6">
        <Link aria-label={translate("brand")} href="/">
          <BrandMark label={translate("brand")} />
        </Link>
        <Divider className="hidden sm:inline-block" orientation="vertical" />
        <Badge className="hidden sm:inline-flex">{translateSecurity("systemSecurityView")}</Badge>
        <div className="ms-auto flex items-center gap-2">
          {/* Narrow widths keep only the controls the frame's chrome cannot do without. */}
          <span className="hidden sm:inline-flex">
            <ConnectionIndicator />
          </span>
          <LanguageSwitcher />
          <Divider className="hidden sm:inline-block" orientation="vertical" />
          <Link className={buttonVariants({ variant: "secondary" })} href="/sign-in">
            {translate("signIn")}
          </Link>
        </div>
      </header>
      <main
        className="content-container flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center py-12"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
