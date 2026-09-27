"use client";

import { useTranslations } from "next-intl";

import { ListItem, MetricCard, PageHeading, SectionLabel } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useReviewQueue } from "@/hooks/use-records";
import { DEMO_ACTORS } from "@/auth/actors";

/**
 * Records assigned to the acting reviewer: everything they have already touched, plus the records
 * still waiting for information after a correction request.
 */
export function AssignedRecords() {
  const translate = useTranslations("screens.reviewAssigned");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useReviewQueue();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <AsyncPanel query={query}>
        {(records) => {
          const mine = records.filter(
            (record) =>
              record.review.assigned_reviewer?.actor_id === DEMO_ACTORS.programme_reviewer.actorId,
          );
          const awaitingInformation = mine.filter(
            (record) => record.review.review_state === "awaiting_information",
          );
          const unassigned = records.filter(
            (record) =>
              record.review.assigned_reviewer === undefined &&
              record.business_state === "under_review",
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
                      status={<StatusBadge status={record.business_state} />}
                      subtitle={record.human_reference}
                      title={labels.category(record.category)}
                      value={labels.reviewState(record.review.review_state)}
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
