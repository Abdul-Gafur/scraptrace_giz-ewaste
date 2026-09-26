import { BadgeCheck, CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";

/** Semantic tones shared by alerts, info panels and metric values. */
export type Tone = "danger" | "warning" | "success" | "info" | "neutral";

export const toneIcon: Record<Tone, LucideIcon> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  success: BadgeCheck,
  info: Info,
  neutral: Info,
};

/** Roomy panels (Figma "semantic-box"): tinted background, tone border. */
export const panelToneClass: Record<Tone, string> = {
  danger: "border-danger bg-danger-subtle text-danger",
  warning: "border-secondary bg-caution-subtle text-warning",
  success: "border-primary bg-success-subtle text-primary",
  info: "border-info bg-info-subtle text-info",
  neutral: "border-border bg-surface text-foreground",
};

/** Compact alerts (Figma "error-toast" and "sync-warning"). */
export const alertToneClass: Record<Tone, string> = {
  danger: "border-danger bg-danger-subtle text-danger",
  warning: "border-secondary bg-caution-soft text-warning",
  success: "border-primary bg-success-subtle text-primary",
  info: "border-info bg-info-subtle text-info",
  neutral: "border-border bg-surface text-foreground",
};

export const toneTextClass: Record<Tone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  success: "text-primary",
  info: "text-info",
  neutral: "text-foreground",
};

/** Compact chips that carry a meaning other than a record's contract state (ToneBadge). */
export const badgeToneClass: Record<Tone, { container: string; dot: string }> = {
  danger: { container: "bg-danger-subtle text-danger", dot: "bg-danger" },
  warning: { container: "bg-warning-subtle text-warning", dot: "bg-warning" },
  success: { container: "bg-success-subtle text-success", dot: "bg-success" },
  info: { container: "bg-info-subtle text-info", dot: "bg-info" },
  neutral: { container: "bg-neutral-subtle text-muted-foreground", dot: "bg-muted-foreground" },
};
