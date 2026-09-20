import { Camera, FileText, House, MapPin, UserRound } from "lucide-react";
import { UserRoleSchema } from "@scraptrace/contracts";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { DevelopmentSessionProvider } from "@/auth/session";
import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const collectorItems = [
  { href: "/collector", key: "home", icon: House },
  { href: "/collector/capture", key: "capture", icon: Camera },
  { href: "/collector/records", key: "records", icon: FileText },
  { href: "/collector/locations", key: "locations", icon: MapPin },
  { href: "/collector/profile", key: "profile", icon: UserRound },
] as const;

export async function CollectorShell({ children }: { children: ReactNode }) {
  const translateCommon = await getTranslations("common");
  const translateNav = await getTranslations("navigation");
  const translateShell = await getTranslations("shell");
  return (
    <DevelopmentSessionProvider role={UserRoleSchema.enum.collector}>
      <div className="min-h-screen pb-20 md:pb-0">
        <header className="sticky top-0 z-30 border-b bg-[var(--color-surface)]/95 backdrop-blur">
          <div className="content-container flex min-h-16 items-center justify-between gap-3">
            <Link href="/collector">
              <BrandMark label={translateCommon("brand")} />
            </Link>
            <div className="flex items-center gap-2">
              <Badge className="hidden sm:inline-flex">{translateShell("collectorLabel")}</Badge>
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <div className="content-container md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
          <nav
            className="sticky top-20 hidden self-start py-6 md:block"
            aria-label={translateShell("primaryNavigation")}
          >
            <ul className="space-y-1">
              {collectorItems.map(({ href, key, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-[var(--color-surface-subtle)]"
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {translateNav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main id="main-content" className="min-w-0 py-6 sm:py-8">
            {children}
          </main>
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label={translateShell("mobileNavigation")}
        >
          <ul className="grid grid-cols-5">
            {collectorItems.map(({ href, key, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] font-medium text-[var(--color-text-secondary)]",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{translateNav(key)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </DevelopmentSessionProvider>
  );
}
