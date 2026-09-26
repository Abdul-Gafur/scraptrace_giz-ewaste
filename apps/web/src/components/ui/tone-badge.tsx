import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { badgeToneClass, type Tone } from "./tone";

/**
 * Chip for a meaning that is not a record's contract state: facility verification, review
 * priority, translation progress, export progress. Like StatusBadge it pairs a dot with a
 * text label, so the meaning never depends on colour alone. Use StatusBadge for record state.
 */
export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const style = badgeToneClass[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs px-2 py-1 text-[0.6875rem] leading-none font-semibold whitespace-nowrap",
        style.container,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {children}
    </span>
  );
}
