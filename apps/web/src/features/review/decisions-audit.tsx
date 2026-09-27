"use client";

import type { RecoveryRecord } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";

/**
 * Recorded decisions. Rows are read-only: a decision, once made, is part of the record's
 * append-only history and is never edited here (FR-REV-008).
 */
export function DecisionsAudit() {
  const translate = useTranslations("screens.reviewDecisions");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOperationalRecords();
  const [decision, setDecision] = useState("all");

  const rows = useMemo(
    () =>
      (query.data ?? [])
        .filter(
          (record) =>
            record.review.decision !== undefined &&
            (decision === "all" || record.review.decision === decision),
        )
        .sort((first, second) =>
          (second.review.decided_at ?? "").localeCompare(first.review.decided_at ?? ""),
        ),
    [decision, query.data],
  );

  const columns: DataColumn<RecoveryRecord>[] = [
    {
      key: "reference",
      header: translate("colRecord"),
      primary: true,
      cell: (row) => (
        <Link
          className="text-info font-mono font-bold underline-offset-2 hover:underline"
          href={`/review/queue/${row.record_id}`}
        >
          {row.human_reference}
        </Link>
      ),
    },
    {
      key: "decision",
      header: translate("colDecision"),
      cell: (row) => labels.decision(row.review.decision ?? ""),
    },
    {
      key: "reason",
      header: translate("colReason"),
      cell: (row) => labels.reason(row.review.reason_code ?? ""),
    },
    {
      key: "note",
      header: translate("colNote"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">{row.review.reviewer_note ?? ""}</span>
      ),
    },
    {
      key: "decidedAt",
      header: translate("colDecidedAt"),
      cell: (row) => formats.dateTime(row.review.decided_at) ?? "",
    },
    {
      key: "state",
      header: translate("colState"),
      cell: (row) => <StatusBadge status={row.business_state} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>
      <FilterControl
        label={translate("filterDecision")}
        onChange={(event) => setDecision(event.target.value)}
        options={[
          { value: "all", label: translate("allDecisions") },
          { value: "approve", label: labels.decision("approve") },
          { value: "request_correction", label: labels.decision("request_correction") },
          { value: "reject", label: labels.decision("reject") },
        ]}
        value={decision}
      />
      <p className="text-muted-foreground text-xs" role="status">
        {translate("resultCount", { count: formats.number(rows.length, 0) })}
      </p>
      <AsyncPanel isEmpty={() => rows.length === 0} query={query}>
        {() => (
          <DataTable
            caption={translate("tableCaption")}
            columns={columns}
            getRowId={(row) => row.record_id}
            rows={rows}
          />
        )}
      </AsyncPanel>
    </div>
  );
}
