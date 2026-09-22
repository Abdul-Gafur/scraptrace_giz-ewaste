import type { UserRole } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { DevelopmentSessionProvider } from "@/auth/session";
import { ConnectionIndicator, OfflineNotice } from "@/components/feedback/connectivity";
import { BrandMark } from "@/components/navigation/brand-mark";
import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { MobileHeader } from "@/components/navigation/mobile-header";
import { BottomNav, SidebarNav, type ResolvedNavItem } from "@/components/navigation/nav-lists";
import { ShellBreadcrumb } from "@/components/navigation/shell-breadcrumb";
import { UserMenu } from "@/components/navigation/user-menu";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/content";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  getNavigationForRole,
  ROLE_WORKSPACES,
  type ShellKind,
} from "@/navigation/navigation-config";

interface AppShellProps {
  role: UserRole;
  /** Only the collector shell narrows content on tablet-and-below widths. */
  kind: ShellKind;
  children: ReactNode;
}

/**
 * Shared authenticated frame: mobile header and bottom navigation below 1024px, operational
 * header and sidebar from 1024px. The collector, operational and administration shells are
 * thin wrappers so the three roles never diverge into separate visual systems.
 */
export function AppShell({ role, kind, children }: AppShellProps) {
  const translate = useTranslations("common");
  const translateNavigation = useTranslations("navigation");
  const translateShell = useTranslations("shell");
  const translateRoles = useTranslations("roles");
  const translateWorkspaces = useTranslations("workspaces");
  const workspace = ROLE_WORKSPACES[role];

  const items: readonly ResolvedNavItem[] = getNavigationForRole(role).map((item) => ({
    ...item,
    label: translateNavigation(item.labelKey),
  }));
  const sidebarItems = items.filter((item) => item.desktop);
  const workspaceLabel = translateWorkspaces(workspace.workspaceKey);

  return (
    <DevelopmentSessionProvider role={role}>
      <div className="min-h-screen pb-20 lg:pb-0" data-shell={kind}>
        <OfflineNotice />
        <MobileHeader fallbackTitle={workspaceLabel} items={items} role={role} />
        <header className="h-header bg-surface sticky top-0 z-30 hidden items-center gap-4 border-b px-6 lg:flex">
          <Link aria-label={translate("brand")} href={workspace.home}>
            <BrandMark label={translate("brand")} />
          </Link>
          <Divider orientation="vertical" />
          <Badge>{translateRoles(role)}</Badge>
          <div className="ms-auto flex items-center gap-2">
            <ConnectionIndicator />
            <LanguageSwitcher />
            <Divider orientation="vertical" />
            <UserMenu role={role} />
          </div>
        </header>
        <div className="lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
          <aside className="bg-surface hidden border-e lg:block lg:min-h-[calc(100dvh-var(--header-height))]">
            <SidebarNav
              className="top-header sticky p-4"
              items={sidebarItems}
              label={translateShell("primaryNavigation")}
            />
          </aside>
          <div className="min-w-0 px-4 py-5 sm:px-6 lg:py-8">
            <div className="mb-2 hidden lg:block">
              <ShellBreadcrumb
                items={items}
                workspaceHref={workspace.home}
                workspaceLabel={workspaceLabel}
              />
            </div>
            <main
              className={cn(
                kind === "collector-workspace" && "mx-auto max-w-2xl lg:mx-0 lg:max-w-none",
              )}
              id="main-content"
              tabIndex={-1}
            >
              {children}
            </main>
          </div>
        </div>
        <BottomNav items={items} label={translateShell("mobileNavigation")} />
      </div>
    </DevelopmentSessionProvider>
  );
}
