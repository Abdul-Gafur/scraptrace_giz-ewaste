"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { InfoPanel } from "@/components/ui/card";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { FilterControl } from "@/components/ui/filter-control";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { StatusBadge } from "@/components/ui/status-badge";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_ASSIGNMENTS, type SampleAssignment } from "../samples";

/**
 * No Figma frame. The reviewer sidebar separates the whole verification queue from the records
 * one reviewer holds, so this repeats the queue's table with the two facts an assignment adds:
 * a priority and the date the decision is due. It never suggests an outcome (ADR-006, SRS).
 */
export function AssignedRecords() {
  const translate = useTranslations("screens.assigned");
  const translateWorkflow = useTranslations("screens.workflow");
  const translatePages = useTranslations("pages");
  const translateSamples = useTranslations("samples");
  const number = useNumber();
  const date = useDate();
  const [priority, setPriority] = useState("all");

  const rows = useMemo(
    () =>
      SAMPLE_ASSIGNMENTS.filter(
        (assignment) => priority === "all" || assignment.priority === priority,
      ),
    [priority],
  );

  const columns: DataColumn<SampleAssignment>[] = [
    { key: "id", header: translate("colRecord"), primary: true, cell: (row) => row.id },
    {
      key: "source",
      header: translate("colSource"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translateSamples(`${row.key}.facility`)}
        </span>
      ),
    },
    {
      key: "priority",
      header: translate("colPriority"),
      cell: (row) => (
        <ToneBadge tone={row.priority === "high" ? "danger" : "neutral"}>
          {translateWorkflow(row.priority)}
        </ToneBadge>
      ),
    },
    {
      key: "due",
      header: translate("colDue"),
      cell: (row) => <span className="font-normal">{date(row.dueOn)}</span>,
    },
    {
      key: "state",
      header: translate("colState"),
      cell: (row) => <StatusBadge status={row.state} />,
    },
    {
      key: "actions",
      header: translate("colActions"),
      align: "end",
      cell: (row) => (
        <DeferredActionButton aria-label={translate("openRecord", { id: row.id })}>
          {translate("open")}
        </DeferredActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("assignedTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("assigned")}
          value={translate("assignedValue", { count: number(SAMPLE_ASSIGNMENTS.length) })}
        />
        <MetricCard
          label={translate("dueSoon")}
          tone="warning"
          value={translate("dueValue", { count: number(1) })}
        />
        <MetricCard
          label={translate("overdue")}
          tone="danger"
          value={translate("overdueValue", { count: number(0) })}
        />
      </div>

      <FilterControl
        className="max-w-xs"
        label={translate("filterPriority")}
        onChange={(event) => setPriority(event.target.value)}
        options={[
          { value: "all", label: translate("priorityAll") },
          { value: "high", label: translateWorkflow("high") },
          { value: "normal", label: translateWorkflow("normal") },
        ]}
        value={priority}
      />

      {rows.length > 0 ? (
        <DataTable
          caption={translate("tableCaption")}
          columns={columns}
          getRowId={(row) => row.id}
          rows={rows}
        />
      ) : (
        <EmptyState />
      )}

      <InfoPanel as="h2" title={translate("judgementTitle")} tone="info">
        {translate("judgementText")}
      </InfoPanel>
    </div>
  );
}
