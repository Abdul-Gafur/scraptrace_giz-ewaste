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

import { SAMPLE_LABELS, type LabelCategoryKey, type SampleLabel } from "../samples";

const CATEGORY_KEYS = [
  "pcbHigh",
  "pcbLow",
  "batteries",
  "glass",
] as const satisfies readonly LabelCategoryKey[];

/**
 * No Figma frame. The correction queue commits one label at a time; this is the reviewed
 * dataset those commits produce. Each row keeps its origin, so a human correction is never
 * confused with a confirmed prediction.
 */
export function ApprovedLabels() {
  const translate = useTranslations("screens.labels");
  const translateMl = useTranslations("screens.ml");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const date = useDate();
  const [category, setCategory] = useState("all");

  const rows = useMemo(
    () => SAMPLE_LABELS.filter((label) => category === "all" || label.category === category),
    [category],
  );

  const corrected = SAMPLE_LABELS.filter((label) => label.corrected).length;

  const columns: DataColumn<SampleLabel>[] = [
    { key: "id", header: translate("colImage"), primary: true, cell: (row) => row.id },
    {
      key: "category",
      header: translate("colCategory"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translateMl(`categories.${row.category}`)}
        </span>
      ),
    },
    {
      key: "origin",
      header: translate("colOrigin"),
      cell: (row) => (
        <ToneBadge tone={row.corrected ? "info" : "success"}>
          {translate(row.corrected ? "originCorrection" : "originConfirmed")}
        </ToneBadge>
      ),
    },
    { key: "reviewer", header: translate("colReviewer"), cell: (row) => row.reviewer },
    {
      key: "approved",
      header: translate("colApproved"),
      cell: (row) => <span className="font-normal">{date(row.approvedOn)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("labelsTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label={translate("approved")}
          tone="success"
          value={translate("approvedValue", { count: number(SAMPLE_LABELS.length) })}
        />
        <MetricCard
          label={translate("corrected")}
          tone="info"
          value={translate("correctedValue", { count: number(corrected) })}
        />
      </div>

      <FilterControl
        className="max-w-xs"
        label={translate("filterCategory")}
        onChange={(event) => setCategory(event.target.value)}
        options={[
          { value: "all", label: translate("categoryAll") },
          ...CATEGORY_KEYS.map((key) => ({ value: key, label: translateMl(`categories.${key}`) })),
        ]}
        value={category}
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

      <InfoPanel as="h2" title={translate("governanceTitle")} tone="warning">
        {translate("governanceText")}
      </InfoPanel>
    </div>
  );
}
