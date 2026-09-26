"use client";

import { SupportedLanguageSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { InfoPanel } from "@/components/ui/card";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { FilterControl } from "@/components/ui/filter-control";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_TRANSLATIONS, type SampleTranslation, type WorkflowStatus } from "../samples";

const STATUS_TONE = {
  approved: "success",
  inReview: "warning",
  draft: "neutral",
} as const satisfies Record<WorkflowStatus, "success" | "warning" | "neutral">;

/**
 * No Figma frame. `SafetyGuidanceRequestSchema` asks for a card in a requested language, and
 * only an approved card may be served, so this tracks each card and language pair through
 * draft, review and approval. A translation is never published from this screen.
 */
export function SafetyTranslations() {
  const translate = useTranslations("screens.translations");
  const translateWorkflow = useTranslations("screens.workflow");
  const translatePages = useTranslations("pages");
  const translateCards = useTranslations("samples.safetyCards");
  const translateLanguages = useTranslations("languages");
  const number = useNumber();
  const date = useDate();
  const [language, setLanguage] = useState("all");

  const rows = useMemo(
    () => SAMPLE_TRANSLATIONS.filter((row) => language === "all" || row.language === language),
    [language],
  );

  const cards = new Set(SAMPLE_TRANSLATIONS.map((row) => row.card));
  const approvedCards = new Set(
    SAMPLE_TRANSLATIONS.filter((row) => row.status === "approved").map((row) => row.card),
  );

  const columns: DataColumn<SampleTranslation>[] = [
    {
      key: "card",
      header: translate("colCard"),
      primary: true,
      cell: (row) => translateCards(row.card),
    },
    {
      key: "language",
      header: translate("colLanguage"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translateLanguages(row.language)}
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
      key: "updated",
      header: translate("colUpdated"),
      cell: (row) => <span className="font-normal">{date(row.updatedOn)}</span>,
    },
    {
      key: "actions",
      header: translate("colActions"),
      align: "end",
      cell: (row) => (
        <DeferredActionButton
          aria-label={translate("requestFor", {
            card: translateCards(row.card),
            language: translateLanguages(row.language),
          })}
        >
          {translate("request")}
        </DeferredActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("translationsTitle")}</PageHeading>
      <SampleDataNote />

      <MetricCard
        className="sm:max-w-xs"
        label={translate("coverage")}
        tone="success"
        value={translate("coverageValue", {
          count: number(approvedCards.size),
          total: number(cards.size),
        })}
      />

      <FilterControl
        className="max-w-xs"
        label={translate("filterLanguage")}
        onChange={(event) => setLanguage(event.target.value)}
        options={[
          { value: "all", label: translate("languageAll") },
          ...SupportedLanguageSchema.options.map((value) => ({
            value,
            label: translateLanguages(value),
          })),
        ]}
        value={language}
      />

      {rows.length > 0 ? (
        <DataTable
          caption={translate("tableCaption")}
          columns={columns}
          getRowId={(row) => `${row.card}-${row.language}`}
          rows={rows}
        />
      ) : (
        <EmptyState />
      )}

      <InfoPanel as="h2" title={translate("groundingTitle")} tone="info">
        {translate("groundingText")}
      </InfoPanel>
    </div>
  );
}
