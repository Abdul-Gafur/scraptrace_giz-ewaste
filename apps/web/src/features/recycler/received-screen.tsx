"use client";

import { RecoveryRecordStateSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { PageHeading, MetricCard } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_HANDOFFS, type SampleHandoff } from "../samples";

const FILTERABLE_STATES = [
  RecoveryRecordStateSchema.enum.awaiting_handoff,
  RecoveryRecordStateSchema.enum.received,
  RecoveryRecordStateSchema.enum.under_review,
] as const;

/**
 * No Figma frame. The recycler bottom navigation names this destination "Received", so it
 * lists what has reached the facility next to what is still expected, using the same
 * responsive table as the reviewer queue. Opening a batch belongs to the handoff milestone.
 */
export function ReceivedScreen() {
  const translate = useTranslations("screens.received");
  const translatePages = useTranslations("pages");
  const translateStatus = useTranslations("status");
  const number = useNumber();
  const date = useDate();
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () =>
      SAMPLE_HANDOFFS.filter(
        (handoff) =>
          (state === "all" || handoff.state === state) &&
          handoff.id.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [state, search],
  );

  const measured = SAMPLE_HANDOFFS.reduce((total, handoff) => total + handoff.weightKg, 0);

  const columns: DataColumn<SampleHandoff>[] = [
    { key: "id", header: translate("colRecord"), primary: true, cell: (row) => row.id },
    {
      key: "node",
      header: translate("colNode"),
      cell: (row) => <span className="text-muted-foreground font-normal">{row.node}</span>,
    },
    {
      key: "weight",
      header: translate("colWeight"),
      cell: (row) => (
        <span className="text-primary font-bold">
          {translate("weight", { value: number(row.weightKg) })}
        </span>
      ),
    },
    {
      key: "received",
      header: translate("colReceived"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">{date(row.receivedOn)}</span>
      ),
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
      <PageHeading>{translatePages("receivedTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("awaiting")}
          tone="warning"
          value={translate("awaitingValue", { count: number(1) })}
        />
        <MetricCard
          label={translate("receivedWeek")}
          value={translate("receivedValue", { count: number(SAMPLE_HANDOFFS.length) })}
        />
        <MetricCard
          label={translate("measured")}
          tone="success"
          value={translate("measuredValue", { value: number(measured, 1) })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterState")}
          onChange={(event) => setState(event.target.value)}
          options={[
            { value: "all", label: translate("stateAll") },
            ...FILTERABLE_STATES.map((value) => ({ value, label: translateStatus(value) })),
          ]}
          value={state}
        />
        <SearchInput
          className="min-w-48 flex-1 sm:ms-auto sm:max-w-xs"
          label={translate("search")}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={translate("search")}
          value={search}
        />
      </div>

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
    </div>
  );
}
