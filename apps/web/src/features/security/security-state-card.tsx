import { CircleAlert, TriangleAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

interface SecurityStateCardProps {
  tone: "danger" | "warning";
  title: string;
  description: string;
  noticeTitle: string;
  notice: string;
  actionLabel: string;
  /** Locale-less route. */
  actionHref: string;
}

/**
 * Figma: SharedSecurityStatesShell card. Title, explanation, a bordered notice and a single
 * primary action. The page that renders it owns the level-one heading.
 */
export function SecurityStateCard({
  tone,
  title,
  description,
  noticeTitle,
  notice,
  actionLabel,
  actionHref,
}: SecurityStateCardProps) {
  const Icon = tone === "danger" ? CircleAlert : TriangleAlert;
  return (
    <section className="bg-surface shadow-raised w-full max-w-lg rounded-md border p-6 sm:p-8">
      <h1
        className={cn(
          "flex items-center gap-3 text-xl font-bold",
          tone === "danger" ? "text-danger" : "text-warning",
        )}
      >
        <Icon aria-hidden="true" className="size-7 shrink-0" />
        {title}
      </h1>
      <p className="text-foreground mt-4 text-sm leading-6">{description}</p>
      <p className="bg-background text-muted-foreground mt-4 rounded-sm border p-3 text-xs leading-5">
        <strong className="font-bold">{noticeTitle}:</strong> {notice}
      </p>
      <Link
        className={cn(buttonVariants({ block: true, size: "large" }), "mt-5")}
        href={actionHref}
      >
        {actionLabel}
      </Link>
    </section>
  );
}
