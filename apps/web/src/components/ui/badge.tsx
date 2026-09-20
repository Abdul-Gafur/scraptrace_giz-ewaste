import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full bg-[var(--color-surface-subtle)] px-2.5 text-xs font-semibold text-[var(--color-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}
