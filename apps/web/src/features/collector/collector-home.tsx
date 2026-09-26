import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { ListItem, PageHeading, SectionLabel } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_RECORDS } from "../samples";

/** Figma: collector-home. */
export function CollectorHome() {
  const translate = useTranslations("screens.collectorHome");
  const translatePages = useTranslations("pages");
  const translateSamples = useTranslations("samples");
  const number = useNumber();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("collectorTitle")}</PageHeading>

      <section
        aria-labelledby="register-heading"
        className="border-primary bg-surface rounded-md border-2 p-4"
      >
        <h2
          className="text-primary-dark flex items-center gap-2 text-lg font-bold"
          id="register-heading"
        >
          <Camera aria-hidden="true" className="text-primary size-5" />
          {translate("registerTitle")}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{translate("registerText")}</p>
        <Link
          className={`${buttonVariants({ size: "large", block: true })} mt-4`}
          href="/collector/capture"
        >
          {translate("captureAction")}
        </Link>
      </section>

      <section aria-labelledby="drafts-heading" className="space-y-2">
        <SectionLabel>
          <span id="drafts-heading">{translate("draftsHeading")}</span>
        </SectionLabel>
        <Link
          className="min-h-touch bg-surface hover:bg-surface-subtle flex items-center justify-between gap-3 rounded-md border px-4"
          href="/collector/capture"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="bg-secondary size-2 shrink-0 rounded-full" />
            <span className="text-sm font-bold">{translate("draftName")}</span>
          </span>
          <span className="text-primary shrink-0 text-xs font-bold">
            {translate("resume", { percent: number(80) })}
          </span>
        </Link>
      </section>

      <section aria-labelledby="recent-heading" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            <span id="recent-heading">
              {translate("recentHeading", { count: number(SAMPLE_RECORDS.length) })}
            </span>
          </SectionLabel>
          <Link
            className="min-h-touch text-info inline-flex items-center text-xs font-bold underline-offset-2 hover:underline"
            href="/collector/locations"
          >
            {translate("nearbyLink")}
          </Link>
        </div>
        <ul className="space-y-2">
          {SAMPLE_RECORDS.map((record) => (
            <ListItem
              key={record.id}
              status={<StatusBadge status={record.status} />}
              subtitle={record.id}
              title={translateSamples(`${record.key}.shortName`)}
              value={translateSamples(`${record.key}.massShort`)}
            />
          ))}
        </ul>
      </section>

      <p className="bg-surface text-muted-foreground rounded-md border p-3 text-xs leading-5">
        {translate("privacy")}
      </p>
    </div>
  );
}
