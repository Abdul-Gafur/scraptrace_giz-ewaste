import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function TabList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-1 border-b", className)} role="tablist" {...props} />;
}

export function Tab({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "min-h-11 border-b-2 border-transparent px-3 aria-selected:border-[var(--color-primary)]",
        className,
      )}
      role="tab"
      type="button"
      {...props}
    />
  );
}
