import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/cn";

/** Neutral frame where an evidence or classified image will render once image services exist. */
export function EvidencePlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "bg-surface-subtle text-muted-foreground flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-sm border",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <ImageIcon aria-hidden="true" className="size-8" />
      <span className="px-2 text-center text-xs">{label}</span>
    </div>
  );
}
