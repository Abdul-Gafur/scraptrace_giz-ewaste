import { AlertTriangle, CircleCheck, CloudOff, Inbox, ShieldAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type StatusTone = "empty" | "error" | "permission" | "offline" | "pending" | "success";

const icons: Record<StatusTone, typeof Inbox> = {
  empty: Inbox,
  error: AlertTriangle,
  permission: ShieldAlert,
  offline: CloudOff,
  pending: RefreshCw,
  success: CircleCheck,
};

interface StatusPanelProps {
  title: string;
  description: string;
  tone?: StatusTone;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function StatusPanel({
  title,
  description,
  tone = "empty",
  actionLabel,
  onAction,
  children,
}: StatusPanelProps) {
  const Icon = icons[tone];
  return (
    <section
      className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6"
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-primary)]",
            tone === "error" && "text-[var(--color-danger)]",
            tone === "permission" && "text-[var(--color-warning)]",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="max-w-prose space-y-2">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
          {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
