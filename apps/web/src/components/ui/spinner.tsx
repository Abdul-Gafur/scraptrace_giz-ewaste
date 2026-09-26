import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/cn";

/** Decorative spinner. Pair it with visible text or an accessible live-region label. */
export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn("size-4 motion-safe:animate-spin", className)}
      data-testid="spinner"
    />
  );
}
