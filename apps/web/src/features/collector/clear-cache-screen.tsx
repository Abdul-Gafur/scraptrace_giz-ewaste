"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { InfoPanel } from "@/components/ui/card";
import { PageHeading, SectionLabel } from "@/components/ui/content";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";

/**
 * Figma: clear-local-data. Local storage does not exist yet, so confirming reports that
 * nothing was deleted instead of pretending to clear data.
 */
export function ClearCacheScreen() {
  const translate = useTranslations("screens.clearCache");
  const { show } = useToast();
  const number = useNumber();
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeading visuallyHiddenBelowDesktop>{translate("title")}</PageHeading>
      <InfoPanel as="h2" title={translate("warningTitle")} tone="danger">
        <p>{translate("warningText", { records: number(3), drafts: number(1) })}</p>
        <p className="mt-2 font-bold">{translate("warningStrong")}</p>
      </InfoPanel>

      <section aria-labelledby="previews" className="space-y-2">
        <SectionLabel>
          <span id="previews">{translate("previewsHeading")}</span>
        </SectionLabel>
        <ul className="space-y-2">
          <li className="bg-surface flex items-center gap-2 rounded-md border p-3 text-xs">
            <CircleCheck aria-hidden="true" className="text-primary size-5 shrink-0" />
            {translate("success")}
          </li>
          <li className="bg-surface flex items-center gap-2 rounded-md border p-3 text-xs">
            <CircleX aria-hidden="true" className="text-danger size-5 shrink-0" />
            {translate("failure")}
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-2">
        <Button
          block
          onClick={() => show({ title: translate("notAvailable"), tone: "info" })}
          size="large"
          variant="destructive"
        >
          {translate("confirm")}
        </Button>
        <Link
          className={buttonVariants({ variant: "secondary", block: true, size: "large" })}
          href="/collector/profile"
        >
          {translate("cancel")}
        </Link>
      </div>
    </div>
  );
}
