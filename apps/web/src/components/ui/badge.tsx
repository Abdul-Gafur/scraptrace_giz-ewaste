import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Neutral label chip (for example a role or version tag). Use StatusBadge for record status. */
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "bg-brand-subtle text-primary-dark inline-flex items-center rounded-xs border px-2 py-1 text-xs font-bold",
        className,
      )}
      {...props}
    />
  );
}
