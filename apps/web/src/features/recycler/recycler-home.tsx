"use client";

import type { RecoveryRecord } from "@scraptrace/contracts";
import { QrCode } from "lucide-react";
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

const PREVIEW_LIMIT = 4;

/**
 * Recycler dashboard, derived entirely from the shared repository (Figma: recycler-home).
 *
 * Each bucket is a real query over the records this facility may act on, and every entry opens the
 * record it names. Weight totals count measured weight only, so nothing declared but unweighed is
 * presented as received material.
 */
export function RecyclerHome() {
  const translate = useTranslations("screens.recyclerHome");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOperationalRecords();

  const rows = (records: readonly RecoveryRecord[], heading: string, id: string) => (
    <section aria-labelledby={id} className="space-y-2" key={id}>
      <SectionLabel>
        <span id={id}>
          {heading} ({formats.number(records.length, 0)})
        </span>
      </SectionLabel>
      {records.length === 0 ? (
        <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
          {translate("bucketEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {records.slice(0, PREVIEW_LIMIT).map((record) => {
            const weight = record.handoff?.measured_weight ?? record.approximate_weight;
            return (
              <ListItem
                href={`/recycler/records/${record.record_id}`}
                key={record.record_id}
                status={<StatusBadge status={record.business_state} />}
                subtitle={record.human_reference}
                title={labels.category(record.category)}
                {...(weight ? { value: `${formats.number(toKilograms(weight), 1)} kg` } : {})}
              />
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("recyclerTitle")}</PageHeading>

      <section
        aria-labelledby="verify-heading"
        className="border-primary bg-surface rounded-md border-2 p-4"
      >
        <h2
          className="text-primary-dark flex items-center gap-2 text-lg font-bold"
          id="verify-heading"
        >
          <QrCode aria-hidden="true" className="text-primary size-5" />
          {translate("verifyTitle")}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{translate("verifyText")}</p>
        <Link
          className={`${buttonVariants({ size: "large", block: true })} mt-4`}
          href="/recycler/intake"
        >
          {translate("openIntake")}
        </Link>
      </section>

      <AsyncPanel query={query}>
        {(records) => {
          const awaiting = records.filter((record) => record.business_state === "awaiting_handoff");
          const received = records.filter((record) => record.business_state === "received");
          const discrepancies = records.filter(
            (record) => record.review.flag_codes.length > 0 && record.business_state !== "rejected",
          );
          const completed = records.filter(
            (record) =>
              record.business_state === "processing_recorded" ||
              record.business_state === "completed" ||
              record.business_state === "approved_and_completed",
          );
          const recentlyReceived = [...records]
            .filter((record) => record.handoff)
            .sort((first, second) =>
              (second.handoff?.server_received_at ?? "").localeCompare(
                first.handoff?.server_received_at ?? "",
              ),
            );
          const measuredTotal = records.reduce(
            (total, record) =>
              record.handoff ? total + toKilograms(record.handoff.measured_weight) : total,
            0,
          );

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={translate("awaitingHandoff")}
                  tone="warning"
                  value={formats.number(awaiting.length, 0)}
                />
                <MetricCard
                  label={translate("awaitingProcessing")}
                  tone="info"
                  value={formats.number(received.length, 0)}
                />
                <MetricCard
                  label={translate("withDiscrepancies")}
                  tone="danger"
                  value={formats.number(discrepancies.length, 0)}
                />
                <MetricCard
                  label={translate("measuredTotal")}
                  tone="success"
                  value={formats.kilograms(measuredTotal)}
                />
              </div>

              {rows(awaiting, translate("awaitingHandoffHeading"), "awaiting-handoff")}
              {rows(recentlyReceived, translate("recentlyReceivedHeading"), "recently-received")}
              {rows(received, translate("awaitingProcessingHeading"), "awaiting-processing")}
              {rows(discrepancies, translate("discrepanciesHeading"), "discrepancies")}
              {rows(completed, translate("completedHeading"), "completed")}
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
