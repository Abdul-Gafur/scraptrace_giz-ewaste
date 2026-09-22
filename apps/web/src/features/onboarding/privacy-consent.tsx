"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice-controls";
import { PageHeading } from "@/components/ui/content";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Figma: privacy-consent. The optional training reuse choice is held locally in this milestone. */
export function PrivacyConsent() {
  const translate = useTranslations("screens.privacy");
  const [optional, setOptional] = useState(false);
  return (
    <div className="space-y-4">
      <PageHeading description={translate("subtitle")}>{translate("title")}</PageHeading>

      <section className="bg-surface rounded-md border p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Check aria-hidden="true" className="text-primary size-5" />
          {translate("requiredTitle")}
        </h2>
        <p className="text-muted-foreground mt-2 text-xs leading-5">{translate("requiredText")}</p>
      </section>

      <section className="bg-surface rounded-md border p-4">
        <div className="flex items-center justify-between gap-3">
          <Checkbox
            checked={optional}
            className="min-h-0"
            label={<span className="text-sm font-bold">{translate("optionalTitle")}</span>}
            onChange={(event) => setOptional(event.target.checked)}
          />
          <span
            className={cn(
              "shrink-0 rounded-xs px-2 py-1 text-[0.6875rem] font-bold",
              optional ? "bg-success-subtle text-success-strong" : "bg-warning-subtle text-warning",
            )}
          >
            {optional ? translate("selected") : translate("unselected")}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs leading-5">{translate("optionalText")}</p>
      </section>

      <p className="border-secondary bg-caution-subtle text-foreground rounded-md border p-3 text-xs leading-5">
        <strong className="text-warning">{translate("noteLabel")}</strong> {translate("noteText")}
      </p>

      <div className="flex flex-col gap-2">
        <Link className={buttonVariants({ block: true, size: "large" })} href="/collector">
          {translate("accept")}
        </Link>
        <Link
          className={cn(
            buttonVariants({ variant: "secondary", block: true, size: "large" }),
            "bg-neutral-subtle text-muted-foreground",
          )}
          href="/collector"
        >
          {translate("decline")}
        </Link>
      </div>
    </div>
  );
}
