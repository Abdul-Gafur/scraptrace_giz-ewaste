"use client";

import { Check } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export interface MenuItem {
  id: string;
  label: string;
  /** Locale-less route. Renders a link instead of a button. */
  href?: string;
  onSelect?: () => void;
  /** For single-choice menus such as the language switcher. */
  checked?: boolean;
  /** Sets `lang` on the item so it is pronounced correctly. */
  lang?: string;
  tone?: "default" | "danger";
}

interface DropdownMenuProps {
  /** Accessible name for the trigger button. */
  label: string;
  trigger: ReactNode;
  items: readonly MenuItem[];
  /** Static content shown above the items (for example the signed-in role). */
  header?: ReactNode;
  choice?: boolean;
  align?: "start" | "end";
  triggerClassName?: string;
}

/** Disclosure menu with roving arrow-key focus, Escape, outside-click and Tab dismissal. */
export function DropdownMenu({
  label,
  trigger,
  items,
  header,
  choice = false,
  align = "end",
  triggerClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const menuItems = () =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    menuItems()[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = menuItems();
    const index = elements.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      elements[(next + elements.length) % elements.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(elements.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") close(false);
  };

  const itemRole = choice ? "menuitemradio" : "menuitem";
  const itemClass = (item: MenuItem) =>
    cn(
      "flex min-h-touch w-full items-center justify-between gap-3 rounded-sm px-3 text-start text-sm font-semibold hover:bg-surface-subtle",
      item.tone === "danger" ? "text-danger" : "text-foreground",
    );

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={cn(
          "min-h-touch text-foreground hover:bg-surface-subtle inline-flex items-center gap-2 rounded-sm px-2 text-sm font-semibold",
          triggerClassName,
        )}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        {trigger}
      </button>
      {open ? (
        <div
          className={cn(
            "bg-surface shadow-raised absolute top-full z-50 mt-1 min-w-48 rounded-md border p-1",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {header ? (
            <div className="text-muted-foreground border-b px-3 py-2 text-xs">{header}</div>
          ) : null}
          <div aria-label={label} id={menuId} onKeyDown={onMenuKeyDown} role="menu">
            {items.map((item) => {
              const content = (
                <>
                  <span lang={item.lang}>{item.label}</span>
                  {item.checked ? (
                    <Check aria-hidden="true" className="text-primary size-4" />
                  ) : null}
                </>
              );
              return item.href ? (
                <Link
                  className={itemClass(item)}
                  href={item.href}
                  key={item.id}
                  onClick={() => close(false)}
                  role={itemRole}
                  {...(item.checked === undefined ? {} : { "aria-checked": item.checked })}
                >
                  {content}
                </Link>
              ) : (
                <button
                  className={itemClass(item)}
                  key={item.id}
                  onClick={() => {
                    item.onSelect?.();
                    close(true);
                  }}
                  role={itemRole}
                  type="button"
                  {...(item.checked === undefined ? {} : { "aria-checked": item.checked })}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
