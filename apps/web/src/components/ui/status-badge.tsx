import type { RecoveryRecordState, ReviewState, SynchronizationState } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/** Contract lifecycle, synchronization and review states plus the GPS trust display states. */
export type StatusKey =
  | RecoveryRecordState
  | SynchronizationState
  | Extract<ReviewState, "awaiting_information">
  | "verified_gps"
  | "unverified_gps";

interface StatusStyle {
  /** Tinted background, dot and text colours from the Figma meaning registry. */
  container: string;
  dot: string;
}

const success: StatusStyle = {
  container: "bg-success-subtle text-success-strong",
  dot: "bg-success-strong",
};
const warning: StatusStyle = { container: "bg-warning-subtle text-warning", dot: "bg-warning" };
const info: StatusStyle = { container: "bg-info-subtle text-info", dot: "bg-info" };
const danger: StatusStyle = { container: "bg-danger-subtle text-danger", dot: "bg-danger" };

const styles: Record<StatusKey, StatusStyle> = {
  draft: { container: "bg-brand-subtle text-success", dot: "bg-success" },
  submitted: { container: "bg-brand-subtle text-primary", dot: "bg-primary" },
  awaiting_handoff: { container: "bg-warning-tint text-warning", dot: "bg-warning" },
  received: success,
  processing_recorded: info,
  completed: success,
  under_review: warning,
  approved_and_completed: success,
  rejected: danger,
  offline: warning,
  pending_synchronization: info,
  synchronizing: info,
  synchronized: success,
  action_required: danger,
  awaiting_information: danger,
  verified_gps: { container: "bg-success-subtle text-success", dot: "bg-success" },
  unverified_gps: {
    container: "bg-neutral-subtle text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

/**
 * Status is always communicated by a text label and a dot, never by colour alone.
 */
export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const translate = useTranslations("status");
  const style = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs px-2 py-1 text-[0.6875rem] leading-none font-semibold whitespace-nowrap",
        style.container,
        className,
      )}
      data-status={status}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {translate(status)}
    </span>
  );
}

export const STATUS_KEYS = Object.keys(styles) as readonly StatusKey[];
