"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Card, CardContent, InfoPanel } from "@/components/ui/card";
import { PageHeading, SectionLabel } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { Field } from "@/components/ui/field";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { Select } from "@/components/ui/select";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_EXPORTS, type SampleExport } from "../samples";

const SCOPE_KEYS = ["approvedLabels", "verifiedOutcomes", "modelMetrics"] as const;
const [DEFAULT_SCOPE] = SCOPE_KEYS;

const STATUS_TONE = {
  ready: "success",
  running: "info",
  failed: "danger",
} as const satisfies Record<SampleExport["status"], "success" | "info" | "danger">;

const SCOPE_LABEL = {
  approvedLabels: "scopeApprovedLabels",
  verifiedOutcomes: "scopeVerifiedOutcomes",
  modelMetrics: "scopeModelMetrics",
} as const satisfies Record<SampleExport["scopeKey"], string>;

/**
 * No Figma frame. Exports are the boundary where data leaves the programme, so the consent
 * rule from the privacy step leads the screen and each request keeps its scope and its state.
 */
export function DataExports() {
  const translate = useTranslations("screens.exports");
  const translateWorkflow = useTranslations("screens.workflow");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const date = useDate();
  const [scope, setScope] = useState<string>(DEFAULT_SCOPE);

  const columns: DataColumn<SampleExport>[] = [
    { key: "id", header: translate("colExport"), primary: true, cell: (row) => row.id },
    {
      key: "scope",
      header: translate("colScope"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translate(SCOPE_LABEL[row.scopeKey])}
        </span>
      ),
    },
    {
      key: "status",
      header: translate("colStatus"),
      cell: (row) => (
        <ToneBadge tone={STATUS_TONE[row.status]}>{translateWorkflow(row.status)}</ToneBadge>
      ),
    },
    {
      key: "requested",
      header: translate("colRequested"),
      cell: (row) => <span className="font-normal">{date(row.requestedOn)}</span>,
    },
    {
      key: "rows",
      header: translate("colRows"),
      align: "end",
      cell: (row) => <span className="text-primary font-bold">{number(row.rows)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("exportsTitle")}</PageHeading>
      <SampleDataNote />

      <InfoPanel as="h2" title={translate("consentTitle")} tone="warning">
        {translate("consentText")}
      </InfoPanel>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4 sm:pt-5">
          <Field className="min-w-56 flex-1" label={translate("scopeLabel")}>
            {(control) => (
              <Select onChange={(event) => setScope(event.target.value)} value={scope} {...control}>
                {SCOPE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {translate(SCOPE_LABEL[key])}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <DeferredActionButton>{translate("request")}</DeferredActionButton>
        </CardContent>
      </Card>

      <section aria-labelledby="exports-heading" className="space-y-2">
        <SectionLabel>
          <span id="exports-heading">{translate("heading")}</span>
        </SectionLabel>
        <DataTable
          caption={translate("tableCaption")}
          columns={columns}
          getRowId={(row) => row.id}
          rows={SAMPLE_EXPORTS}
        />
      </section>
    </div>
  );
}
