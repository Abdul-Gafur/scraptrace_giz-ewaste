"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/states";
import { buttonVariants } from "@/components/ui/button";
import { PageHeading, SectionLabel } from "@/components/ui/content";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";
import { useOwnRecords } from "@/services/queries";

import { RecordListItem } from "../records/record-display";
import { OutboxPanel } from "./outbox-panel";

/** Figma: collector-home, over the records this device actually holds. */
export function CollectorHome() {
  const translate = useTranslations("screens.collectorHome");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const { data: records, isPending } = useOwnRecords();

  const drafts = records?.filter((record) => record.business_state === "draft") ?? [];
  const recent = records?.slice(0, 5) ?? [];

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

      <OutboxPanel />

      {drafts.length > 0 ? (
        <section aria-labelledby="drafts-heading" className="space-y-2">
          <SectionLabel>
            <span id="drafts-heading">{translate("draftsHeading")}</span>
          </SectionLabel>
          <ul className="space-y-2">
            {drafts.map((record) => (
              <RecordListItem
                href={`/collector/records/${record.record_id}`}
                key={record.record_id}
                record={record}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent-heading" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            <span id="recent-heading">
              {translate("recentHeading", { count: number(records?.length ?? 0) })}
            </span>
          </SectionLabel>
          <Link
            className="min-h-touch text-info inline-flex items-center text-xs font-bold underline-offset-2 hover:underline"
            href="/collector/locations"
          >
            {translate("nearbyLink")}
          </Link>
        </div>
        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : recent.length > 0 ? (
          <ul className="space-y-2">
            {recent.map((record) => (
              <RecordListItem
                href={`/collector/records/${record.record_id}`}
                key={record.record_id}
                record={record}
              />
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </section>

      <p className="bg-surface text-muted-foreground rounded-md border p-3 text-xs leading-5">
        {translate("privacy")}
      </p>
    </div>
  );
}
