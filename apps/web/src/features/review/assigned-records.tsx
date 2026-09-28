"use client";

import { useTranslations } from "next-intl";

import { ListItem, MetricCard, PageHeading, SectionLabel } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useActingIdentity } from "@/hooks/use-identity";
import { useReviewCases } from "@/hooks/use-records";

/**
 * Records assigned to the acting reviewer: everything they have already touched, plus the records
 * still waiting for information after a correction request.
 */
export function AssignedRecords() {
  const translate = useTranslations("screens.reviewAssigned");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const identity = useActingIdentity();
  // The first page of every case in the reviewer's scope, open or decided.
  const query = useReviewCases({
    status: ["open", "awaiting_information", "approved", "rejected"],
    limit: 100,
  });

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <AsyncPanel query={query}>
        {(page) => {
          const records = page.items;
          const mine = records.filter((record) => record.assigned_reviewer_id === identity.actorId);
          const awaitingInformation = mine.filter(
            (record) => record.status === "awaiting_information",
          );
          const unassigned = records.filter(
            (record) => record.assigned_reviewer_id === undefined && record.decision_eligible,
          );

          const list = (heading: string, id: string, rows: typeof records) => (
            <section aria-labelledby={id} className="space-y-2">
              <SectionLabel>
                <span id={id}>
                  {heading} ({formats.number(rows.length, 0)})
                </span>
              </SectionLabel>
              {rows.length === 0 ? (
                <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
                  {translate("none")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((record) => (
                    <ListItem
                      href={`/review/queue/${record.record_id}`}
                      key={record.record_id}
                      status={<StatusBadge status={record.record_business_state} />}
                      subtitle={record.human_reference}
                      title={labels.category(record.category)}
                      value={labels.reviewState(record.status)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={translate("assignedCount")}
                  value={formats.number(mine.length, 0)}
                />
                <MetricCard
                  label={translate("awaitingInformation")}
                  tone="warning"
                  value={formats.number(awaitingInformation.length, 0)}
                />
                <MetricCard
                  label={translate("unassigned")}
                  tone="info"
                  value={formats.number(unassigned.length, 0)}
                />
              </div>
              {list(translate("unassignedHeading"), "unassigned-heading", unassigned)}
              {list(translate("assignedHeading"), "assigned-heading", mine)}
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
