"use client";

import type { RecoveryRecord } from "@scraptrace/contracts";
import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { ListItem, MetricCard, PageHeading, SectionLabel } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOwnRecords } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";

const RECENT_LIMIT = 5;

/** Collector home: start a record, resume a draft, and follow recent records (Figma: collector-home). */
export function CollectorHome() {
  const translate = useTranslations("screens.collectorHome");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOwnRecords();

  /** Trailing value for a row, omitted entirely when no weight is recorded. */
  const describe = (record: RecoveryRecord): { value: string } | Record<string, never> => {
    const weight = record.handoff?.measured_weight ?? record.approximate_weight;
    return weight ? { value: `${formats.number(toKilograms(weight), 1)} kg` } : {};
  };

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

      <AsyncPanel query={query}>
        {(records) => {
          const drafts = records.filter((record) => record.business_state === "draft");
          const verified = records.filter(
            (record) => record.business_state === "approved_and_completed",
          );
          const verifiedWeight = verified.reduce(
            (total, record) =>
              record.handoff ? total + toKilograms(record.handoff.measured_weight) : total,
            0,
          );
          const recent = [...records]
            .sort((first, second) => second.captured_at.localeCompare(first.captured_at))
            .slice(0, RECENT_LIMIT);

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={translate("totalRecords")}
                  value={formats.number(records.length, 0)}
                />
                <MetricCard
                  label={translate("verifiedRecords")}
                  tone="success"
                  value={formats.number(verified.length, 0)}
                />
                <MetricCard
                  label={translate("verifiedWeight")}
                  tone="success"
                  value={formats.kilograms(verifiedWeight)}
                />
              </div>

              {drafts.length > 0 ? (
                <section aria-labelledby="drafts-heading" className="space-y-2">
                  <SectionLabel>
                    <span id="drafts-heading">{translate("draftsHeading")}</span>
                  </SectionLabel>
                  <ul className="space-y-2">
                    {drafts.map((record) => (
                      <ListItem
                        href={`/collector/records/${record.record_id}`}
                        key={record.record_id}
                        status={<StatusBadge status={record.business_state} />}
                        subtitle={record.human_reference}
                        title={labels.category(record.category)}
                        {...describe(record)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="recent-heading" className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>
                    <span id="recent-heading">
                      {translate("recentHeading", { count: formats.number(records.length, 0) })}
                    </span>
                  </SectionLabel>
                  <Link
                    className="min-h-touch text-info inline-flex items-center text-xs font-bold underline-offset-2 hover:underline"
                    href="/collector/locations"
                  >
                    {translate("nearbyLink")}
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
                    {translate("noRecords")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recent.map((record) => (
                      <ListItem
                        href={`/collector/records/${record.record_id}`}
                        key={record.record_id}
                        status={<StatusBadge status={record.business_state} />}
                        subtitle={record.human_reference}
                        title={labels.category(record.category)}
                        {...describe(record)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </>
          );
        }}
      </AsyncPanel>

      <p className="bg-surface text-muted-foreground rounded-md border p-3 text-xs leading-5">
        {translate("privacy")}
      </p>
    </div>
  );
}
