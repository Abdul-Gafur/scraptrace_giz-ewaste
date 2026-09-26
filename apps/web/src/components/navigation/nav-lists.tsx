"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { findActiveNavItem, type NavItem } from "@/navigation/navigation-config";

import { NAV_ICONS } from "./nav-icons";

export interface ResolvedNavItem extends NavItem {
  /** Translated label. */
  readonly label: string;
}

function useActiveId(items: readonly ResolvedNavItem[]): string | undefined {
  return findActiveNavItem(items, usePathname())?.id;
}

interface NavProps {
  items: readonly ResolvedNavItem[];
  label: string;
  className?: string;
}

/** Desktop sidebar list. */
export function SidebarNav({ items, label, className }: NavProps) {
  const activeId = useActiveId(items);
  return (
    <nav aria-label={label} className={className}>
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-h-touch flex items-center gap-3 rounded-sm border px-3 text-sm font-semibold",
                  active
                    ? "border-border bg-background text-primary font-bold"
                    : "text-foreground hover:bg-surface-subtle border-transparent",
                )}
                href={item.href}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 break-words">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile bottom bar: only items flagged `mobile`. */
export function BottomNav({ items, label }: NavProps) {
  const activeId = useActiveId(items);
  const visible = items.filter((item) => item.mobile);
  return (
    <nav
      aria-label={label}
      className="bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-[0.6875rem] leading-tight",
                  active ? "text-primary font-bold" : "text-muted-foreground font-medium",
                )}
                href={item.href}
              >
                <Icon aria-hidden="true" className="size-6" />
                <span className="max-w-full break-words">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Full navigation inside the mobile menu drawer. */
export function DrawerNav({ items, label, onNavigate }: NavProps & { onNavigate: () => void }) {
  const activeId = useActiveId(items);
  return (
    <nav aria-label={label}>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-h-touch flex items-center gap-3 rounded-sm px-3 text-sm font-semibold",
                  active ? "bg-brand-subtle text-primary font-bold" : "hover:bg-surface-subtle",
                )}
                href={item.href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 break-words">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Label of the active item, used for the mobile header title and breadcrumbs. */
export function useActiveLabel(items: readonly ResolvedNavItem[]): string | undefined {
  const activeId = useActiveId(items);
  return items.find((item) => item.id === activeId)?.label;
}
