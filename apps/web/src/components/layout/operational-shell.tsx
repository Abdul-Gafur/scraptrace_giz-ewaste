import { ChartNoAxesCombined, ClipboardCheck, Recycle, ShieldCheck, ScanLine } from "lucide-react";
import type { UserRole } from "@scraptrace/contracts";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { DevelopmentSessionProvider } from "@/auth/session";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { Link } from "@/i18n/navigation";

const operationItems = [
  { href: "/recycler", key: "recycler", icon: ScanLine },
  { href: "/review", key: "review", icon: ClipboardCheck },
  { href: "/management", key: "management", icon: ChartNoAxesCombined },
  { href: "/administration/safety", key: "safety", icon: ShieldCheck },
  { href: "/administration/ml", key: "ml", icon: Recycle },
] as const;

export async function OperationalShell({
  children,
  role,
  pageLabel,
}: {
  children: ReactNode;
  role: UserRole;
  pageLabel: string;
}) {
  const common = await getTranslations("common");
  const navigation = await getTranslations("navigation");
  const shell = await getTranslations("shell");
  const roles = await getTranslations("roles");
  return (
    <DevelopmentSessionProvider role={role}>
      <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden border-e bg-[var(--color-surface)] lg:flex lg:min-h-screen lg:flex-col">
          <div className="flex min-h-16 items-center border-b px-5">
            <BrandMark label={common("brand")} />
          </div>
          <nav className="flex-1 p-3" aria-label={shell("primaryNavigation")}>
            <ul className="space-y-1">
              {operationItems.map(({ href, key, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-[var(--color-surface-subtle)]"
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {navigation(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t p-4">
            <Badge>{common("developmentOnly")}</Badge>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b bg-[var(--color-surface)]/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="lg:hidden">
                <BrandMark label={common("brand")} />
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold">{shell("operationsLabel")}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{pageLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="hidden sm:inline-flex">{roles(role)}</Badge>
                <LanguageSwitcher />
              </div>
            </div>
            <nav
              className="overflow-x-auto border-t px-2 lg:hidden"
              aria-label={shell("mobileNavigation")}
            >
              <ul className="flex min-w-max">
                {operationItems.map(({ href, key }) => (
                  <li key={href}>
                    <Link
                      className="inline-flex min-h-11 items-center px-3 text-sm font-medium"
                      href={href}
                    >
                      {navigation(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <nav
              aria-label={shell("breadcrumbLabel")}
              className="mb-5 text-sm text-[var(--color-text-secondary)]"
            >
              {shell("operationsLabel")} / <span aria-current="page">{pageLabel}</span>
            </nav>
            <main id="main-content">{children}</main>
          </div>
        </div>
      </div>
    </DevelopmentSessionProvider>
  );
}
