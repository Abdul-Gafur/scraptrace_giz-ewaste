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
  /** Heading level. Use `h1` when the panel is the page's primary content. */
  heading?: "h1" | "h2";
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function StatusPanel({
  title,
  description,
  tone = "empty",
  heading: Heading = "h2",
  actionLabel,
  onAction,
  children,
}: StatusPanelProps) {
  const Icon = icons[tone];
  return (
    <section
      className="bg-surface rounded-md border p-6"
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "bg-surface-subtle text-primary grid size-10 shrink-0 place-items-center rounded-full",
            tone === "error" && "text-danger",
            tone === "permission" && "text-warning",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="max-w-prose space-y-2">
          <Heading className="font-bold">{title}</Heading>
          <p className="text-muted-foreground text-sm leading-6">{description}</p>
          {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
