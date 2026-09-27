"use client";

import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { ListItem, MetricCard, PageHeading, SectionLabel } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";

/** Records received at this facility that still need processing details recorded. */
export function ProcessingQueueScreen() {
  const translate = useTranslations("screens.recyclerProcessingQueue");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOperationalRecords();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <AsyncPanel query={query}>
        {(records) => {
          const awaiting = records.filter((record) => record.business_state === "received");
          const recorded = records.filter(
            (record) => record.processing !== undefined && record.business_state !== "received",
          );
          const recoveredTotal = records
            .flatMap((record) => record.processing?.material_entries ?? [])
            .reduce((total, entry) => total + toKilograms(entry.weight), 0);

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={translate("awaiting")}
                  tone="warning"
                  value={formats.number(awaiting.length, 0)}
                />
                <MetricCard
                  label={translate("recorded")}
                  tone="info"
                  value={formats.number(recorded.length, 0)}
                />
                <MetricCard
                  label={translate("recoveredTotal")}
                  tone="success"
                  value={formats.kilograms(recoveredTotal)}
                />
              </div>

              <section aria-labelledby="awaiting-heading" className="space-y-2">
                <SectionLabel>
                  <span id="awaiting-heading">{translate("awaitingHeading")}</span>
                </SectionLabel>
                {awaiting.length === 0 ? (
                  <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
                    {translate("noneAwaiting")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {awaiting.map((record) => (
                      <ListItem
                        href={`/recycler/records/${record.record_id}/processing`}
                        key={record.record_id}
                        status={<StatusBadge status={record.business_state} />}
                        subtitle={record.human_reference}
                        title={labels.category(record.category)}
                        {...(record.handoff
                          ? {
                              value: `${formats.number(
                                toKilograms(record.handoff.measured_weight),
                                2,
                              )} kg`,
                            }
                          : {})}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="recorded-heading" className="space-y-2">
                <SectionLabel>
                  <span id="recorded-heading">{translate("recordedHeading")}</span>
                </SectionLabel>
                {recorded.length === 0 ? (
                  <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
                    {translate("noneRecorded")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recorded.map((record) => (
                      <ListItem
                        href={`/recycler/records/${record.record_id}`}
                        key={record.record_id}
                        status={<StatusBadge status={record.business_state} />}
                        subtitle={record.human_reference}
                        title={labels.category(record.category)}
                        value={formats.kilograms(
                          (record.processing?.material_entries ?? []).reduce(
                            (total, entry) => total + toKilograms(entry.weight),
                            0,
                          ),
                        )}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <Link className={buttonVariants({ variant: "secondary" })} href="/recycler/intake">
                {translate("backToIntake")}
              </Link>
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
