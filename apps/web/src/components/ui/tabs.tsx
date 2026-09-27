"use client";

import {
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";

import { cn } from "@/lib/cn";

export function TabList({
  className,
  listRef,
  ...props
}: HTMLAttributes<HTMLDivElement> & { listRef?: Ref<HTMLDivElement> }) {
  return (
    <div className={cn("flex gap-1 border-b", className)} ref={listRef} role="tablist" {...props} />
  );
}

export function Tab({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "min-h-11 border-b-2 border-transparent px-3 aria-selected:border-[var(--primary)]",
        className,
      )}
      role="tab"
      type="button"
      {...props}
    />
  );
}

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

/**
 * Tab set with the expected keyboard behaviour: arrow keys move between tabs, Home and End jump to
 * the ends, and only the selected tab is in the tab order. Panels are labelled by their tab.
 */
export function Tabs({
  items,
  label,
  className,
}: {
  items: readonly TabItem[];
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
}) {
  const baseId = useId();
  const [selected, setSelected] = useState(items[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);

  const move = (offset: number) => {
    const index = items.findIndex((item) => item.id === selected);
    const next = items[(index + offset + items.length) % items.length];
    if (!next) return;
    setSelected(next.id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${baseId}-${next.id}-tab`)}`)
      ?.focus();
  };

  const active = items.find((item) => item.id === selected) ?? items[0];
  if (!active) return null;

  return (
    <div className={className}>
      <TabList
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") move(1);
          else if (event.key === "ArrowLeft") move(-1);
          else if (event.key === "Home") setSelected(items[0]?.id ?? selected);
          else if (event.key === "End") setSelected(items.at(-1)?.id ?? selected);
          else return;
          event.preventDefault();
        }}
        listRef={listRef}
      >
        {items.map((item) => {
          const isSelected = item.id === active.id;
          return (
            <Tab
              aria-controls={`${baseId}-${item.id}-panel`}
              aria-selected={isSelected}
              className={cn(
                "text-sm font-bold",
                isSelected ? "text-primary-dark" : "text-muted-foreground",
              )}
              id={`${baseId}-${item.id}-tab`}
              key={item.id}
              onClick={() => setSelected(item.id)}
              tabIndex={isSelected ? 0 : -1}
            >
              {item.label}
            </Tab>
          );
        })}
      </TabList>
      <div
        aria-labelledby={`${baseId}-${active.id}-tab`}
        className="pt-4"
        id={`${baseId}-${active.id}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        {active.content}
      </div>
    </div>
  );
}
