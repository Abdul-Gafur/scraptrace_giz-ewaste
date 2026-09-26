"use client";

import type { UserRole } from "@scraptrace/contracts";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Drawer } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Link } from "@/i18n/navigation";

import { BrandMark } from "./brand-mark";
import { LanguageSwitcher } from "./language-switcher";
import { DrawerNav, useActiveLabel, type ResolvedNavItem } from "./nav-lists";

interface MobileHeaderProps {
  items: readonly ResolvedNavItem[];
  role: UserRole;
  fallbackTitle: string;
}

/** Collector and operational header below 1024px: menu, page title and language control. */
export function MobileHeader({ items, role, fallbackTitle }: MobileHeaderProps) {
  const translate = useTranslations("common");
  const translateShell = useTranslations("shell");
  const translateRoles = useTranslations("roles");
  const [menuOpen, setMenuOpen] = useState(false);
  const title = useActiveLabel(items) ?? fallbackTitle;
  return (
    <header className="bg-surface sticky top-0 z-30 border-b lg:hidden">
      <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-2">
        <IconButton
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          icon={Menu}
          label={translate("openMenu")}
          onClick={() => setMenuOpen(true)}
        />
        <p className="text-primary-dark truncate text-center text-xl font-bold">{title}</p>
        <LanguageSwitcher />
      </div>
      <Drawer onClose={() => setMenuOpen(false)} open={menuOpen} title={translate("menu")}>
        <div className="space-y-5">
          <BrandMark label={translate("brand")} />
          <p className="text-muted-foreground text-xs">
            {translateRoles(role)} · {translate("developmentSession")}
          </p>
          <DrawerNav
            items={items}
            label={translateShell("menuNavigation")}
            onNavigate={() => setMenuOpen(false)}
          />
          <Link
            className="min-h-touch text-danger hover:bg-danger-subtle flex items-center rounded-sm px-3 text-sm font-bold"
            href="/sign-in"
            onClick={() => setMenuOpen(false)}
          >
            {translate("signOut")}
          </Link>
        </div>
      </Drawer>
    </header>
  );
}
