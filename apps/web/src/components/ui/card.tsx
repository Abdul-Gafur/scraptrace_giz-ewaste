import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { panelToneClass, toneIcon, type Tone } from "./tone";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-surface rounded-md border", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 p-4 sm:p-5", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

interface InfoPanelProps {
  tone: Tone;
  title: string;
  /** Heading level for the title. Defaults to `h3`. */
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

/** Distinct-meaning panel: safety guidance, indicative estimate, verified outcome. */
export function InfoPanel({
  tone,
  title,
  as: Heading = "h3",
  children,
  className,
}: InfoPanelProps) {
  const Icon = toneIcon[tone];
  return (
    <section className={cn("rounded-sm border p-4", panelToneClass[tone], className)}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <Heading className="text-sm font-bold">{title}</Heading>
      </div>
      <div className="text-foreground mt-2 text-xs leading-5">{children}</div>
    </section>
  );
}
