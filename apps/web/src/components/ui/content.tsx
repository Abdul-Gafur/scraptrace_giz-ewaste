import { UserRound } from "lucide-react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

import { toneTextClass, type Tone } from "./tone";

interface HeadingProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function PageHeading({
  eyebrow,
  description,
  actions,
  children,
  as: Heading = "h1",
  className,
  visuallyHiddenBelowDesktop,
}: HeadingProps & {
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  /** Keep the heading for assistive technology but hide it visually below 1024px, where the header already shows the title. */
  visuallyHiddenBelowDesktop?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        visuallyHiddenBelowDesktop && "sr-only lg:not-sr-only",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-muted-foreground text-xs">{eyebrow}</p> : null}
        <Heading className="text-primary-dark text-2xl font-bold tracking-tight text-balance sm:text-[1.625rem]">
          {children}
        </Heading>
        {description ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-6">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({ as: Heading = "h2", className, children }: HeadingProps) {
  return (
    <Heading className={cn("text-primary-dark text-lg font-bold", className)}>{children}</Heading>
  );
}

/** Small uppercase group label (Figma "RESUME DRAFTS", "PREFERENCES"). */
export function SectionLabel({
  as: Heading = "h2",
  tone = "neutral",
  className,
  children,
}: HeadingProps & { tone?: "neutral" | "danger" }) {
  return (
    <Heading
      className={cn(
        "text-xs font-bold tracking-wide uppercase",
        tone === "danger" ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </Heading>
  );
}

export function Divider({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return orientation === "vertical" ? (
    <span aria-hidden="true" className={cn("bg-border inline-block h-6 w-px", className)} />
  ) : (
    <hr className={cn("border-t", className)} />
  );
}

export function Avatar({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-border text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full",
        className,
      )}
      {...props}
    >
      <UserRound className="size-4" />
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  tone?: Tone;
  className?: string;
}

export function MetricCard({ label, value, tone = "neutral", className }: MetricCardProps) {
  return (
    <div className={cn("bg-surface rounded-md border p-4", className)}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={cn("mt-2 text-2xl font-extrabold sm:text-[1.75rem]", toneTextClass[tone])}>
        {value}
      </p>
    </div>
  );
}

interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Trailing status, usually a StatusBadge. */
  status?: ReactNode;
  value?: string;
  /** Local (locale-less) route. Makes the whole row a single link target. */
  href?: string;
  className?: string;
}

/** Record-style row: title and status on the first line, identifier and value on the second. */
export function ListItem({ title, subtitle, status, value, href, className }: ListItemProps) {
  const titleNode = href ? (
    <Link className="text-foreground font-bold after:absolute after:inset-0" href={href}>
      {title}
    </Link>
  ) : (
    <span className="text-foreground font-bold">{title}</span>
  );
  return (
    <li
      className={cn(
        "min-h-touch bg-surface focus-within:outline-focus relative flex flex-col gap-2 rounded-md border p-4 focus-within:outline-[length:var(--focus-ring-width)]",
        href && "hover:bg-surface-subtle",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 text-sm">
        {titleNode}
        {status}
      </div>
      {subtitle || value ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">{subtitle}</span>
          <span className="text-primary font-bold">{value}</span>
        </div>
      ) : null}
    </li>
  );
}

export function DefinitionList({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("divide-y", className)} {...props} />;
}

export function DefinitionRow({
  term,
  children,
  tone = "neutral",
}: {
  term: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className={cn("text-end font-bold", toneTextClass[tone])}>{children}</dd>
    </div>
  );
}
