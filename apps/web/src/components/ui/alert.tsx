import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { alertToneClass, toneIcon, type Tone } from "./tone";

interface AlertProps {
  tone: Tone;
  title: string;
  children?: ReactNode;
  /** Overrides the default icon. Icons are decorative; the title carries the meaning. */
  icon?: ReactNode;
  className?: string;
}

/** Inline alert. Danger alerts interrupt assistive technology; others are polite status. */
export function Alert({ tone, title, children, icon, className }: AlertProps) {
  const Icon = toneIcon[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-sm border p-3",
        alertToneClass[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="mt-px shrink-0">
        {icon ?? <Icon className="size-5" />}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs font-bold">{title}</p>
        {children ? <div className="text-muted-foreground text-[0.6875rem]">{children}</div> : null}
      </div>
    </div>
  );
}
