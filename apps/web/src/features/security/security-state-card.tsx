import { CircleAlert, TriangleAlert } from "lucide-react";
import type { ElementType } from "react";

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
  /** Heading level for the title. A security route owns the page, so it defaults to `h1`. */
  as?: ElementType;
}

/**
 * Figma: SharedSecurityStatesShell card. Title, explanation, a bordered notice and a single
 * primary action. The frame shows the 403 and session-expired cards side by side; a route
 * renders only its own, and the showcase reproduces the pair.
 */
export function SecurityStateCard({
  tone,
  title,
  description,
  noticeTitle,
  notice,
  actionLabel,
  actionHref,
  as: Heading = "h1",
}: SecurityStateCardProps) {
  const Icon = tone === "danger" ? CircleAlert : TriangleAlert;
  return (
    <section className="bg-surface shadow-raised w-full max-w-lg rounded-md border p-6 sm:p-8">
      <Heading
        className={cn(
          "flex items-center gap-3 text-xl font-bold",
          tone === "danger" ? "text-danger" : "text-warning",
        )}
      >
        <Icon aria-hidden="true" className="size-7 shrink-0" />
        {title}
      </Heading>
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
