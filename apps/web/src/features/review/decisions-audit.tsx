"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { InfoPanel } from "@/components/ui/card";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterControl } from "@/components/ui/filter-control";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_DECISIONS, type DecisionKey, type SampleDecision } from "../samples";

const DECISION_TONE = {
  approve: "success",
  reject: "danger",
  requestCorrection: "warning",
} as const satisfies Record<DecisionKey, "success" | "danger" | "warning">;

const DECISION_LABEL = {
  approve: "labelApprove",
  reject: "labelReject",
  requestCorrection: "labelRequestCorrection",
} as const satisfies Record<DecisionKey, string>;

/**
 * No Figma frame. `ReviewInformationSchema` allows approve, reject and request_correction, and
 * the transition model never rewrites a recorded decision, so this reads as an append-only log
 * rather than an editable list.
 */
export function DecisionsAudit() {
  const translate = useTranslations("screens.decisions");
  const translatePages = useTranslations("pages");
  const translateSamples = useTranslations("samples");
  const number = useNumber();
  const date = useDate();
  const [decision, setDecision] = useState("all");

  const rows = useMemo(
    () => SAMPLE_DECISIONS.filter((row) => decision === "all" || row.decision === decision),
    [decision],
  );

  const count = (key: DecisionKey) => SAMPLE_DECISIONS.filter((row) => row.decision === key).length;

  const columns: DataColumn<SampleDecision>[] = [
    { key: "id", header: translate("colRecord"), primary: true, cell: (row) => row.id },
    {
      key: "decision",
      header: translate("colDecision"),
      cell: (row) => (
        <ToneBadge tone={DECISION_TONE[row.decision]}>
          {translate(DECISION_LABEL[row.decision])}
        </ToneBadge>
      ),
    },
    {
      key: "source",
      header: translate("colReviewer"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {row.reviewer} · {translateSamples(`${row.key}.facility`)}
        </span>
      ),
    },
    {
      key: "date",
      header: translate("colDate"),
      cell: (row) => <span className="font-normal">{date(row.decidedOn)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("decisionsTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("approved")}
          tone="success"
          value={translate("approvedValue", { count: number(count("approve")) })}
        />
        <MetricCard
          label={translate("corrections")}
          tone="warning"
          value={translate("correctionsValue", { count: number(count("requestCorrection")) })}
        />
        <MetricCard
          label={translate("rejected")}
          tone="danger"
          value={translate("rejectedValue", { count: number(count("reject")) })}
        />
      </div>

      <FilterControl
        className="max-w-xs"
        label={translate("filterDecision")}
        onChange={(event) => setDecision(event.target.value)}
        options={[
          { value: "all", label: translate("decisionAll") },
          { value: "approve", label: translate("labelApprove") },
          { value: "requestCorrection", label: translate("labelRequestCorrection") },
          { value: "reject", label: translate("labelReject") },
        ]}
        value={decision}
      />

      {rows.length > 0 ? (
        <DataTable
          caption={translate("tableCaption")}
          columns={columns}
          getRowId={(row) => `${row.id}-${row.decidedOn}`}
          rows={rows}
        />
      ) : (
        <EmptyState />
      )}

      <InfoPanel as="h2" title={translate("appendOnlyTitle")} tone="info">
        {translate("appendOnlyText")}
      </InfoPanel>
    </div>
  );
}
