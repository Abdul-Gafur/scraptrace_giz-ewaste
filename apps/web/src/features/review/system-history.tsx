"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { InfoPanel } from "@/components/ui/card";
import { PageHeading, SectionLabel } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterControl } from "@/components/ui/filter-control";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { useDate } from "@/i18n/use-date";

import { SAMPLE_EVENTS, type SampleEvent } from "../samples";

const RECORD_IDS = [...new Set(SAMPLE_EVENTS.map((entry) => entry.recordId))];

/**
 * No Figma frame. `RecoveryRecordEventSchema` is the source: every row is one recorded state
 * transition with the actor role that caused it. The screen is read-only by construction.
 */
export function SystemHistory() {
  const translate = useTranslations("screens.history");
  const translateEvents = useTranslations("screens.events");
  const translateActors = useTranslations("screens.actors");
  const translatePages = useTranslations("pages");
  const date = useDate();
  const [record, setRecord] = useState("all");

  const rows = useMemo(
    () => SAMPLE_EVENTS.filter((entry) => record === "all" || entry.recordId === record),
    [record],
  );

  const columns: DataColumn<SampleEvent>[] = [
    {
      key: "event",
      header: translate("colEvent"),
      primary: true,
      cell: (row) => translateEvents(row.type),
    },
    { key: "record", header: translate("colRecord"), cell: (row) => row.recordId },
    {
      key: "actor",
      header: translate("colActor"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">{translateActors(row.actorKey)}</span>
      ),
    },
    {
      key: "date",
      header: translate("colDate"),
      cell: (row) => <span className="font-normal">{date(row.occurredOn)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("historyTitle")}</PageHeading>
      <SampleDataNote />

      <FilterControl
        className="max-w-xs"
        label={translate("filterRecord")}
        onChange={(event) => setRecord(event.target.value)}
        options={[
          { value: "all", label: translate("recordAll") },
          ...RECORD_IDS.map((id) => ({ value: id, label: id })),
        ]}
        value={record}
      />

      <section aria-labelledby="history-heading" className="space-y-2">
        <SectionLabel>
          <span id="history-heading">{translate("heading")}</span>
        </SectionLabel>
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
      </section>

      <InfoPanel as="h2" title={translate("integrityTitle")} tone="info">
        {translate("integrityText")}
      </InfoPanel>
    </div>
  );
}
