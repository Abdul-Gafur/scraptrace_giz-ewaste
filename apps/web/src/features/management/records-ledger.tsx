"use client";

import { RecoveryRecordStateSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { InfoPanel } from "@/components/ui/card";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_LEDGER, type SampleLedgerEntry } from "../samples";

const PAGE_SIZE = 4;
const state = RecoveryRecordStateSchema.enum;

/**
 * No Figma frame. `ReportingFiltersSchema` defines what a manager may filter by, and
 * `ReportingSummarySchema` reports a coarse area rather than coordinates, so the ledger shows
 * an approximate area and separates verified weight from everything still in flight.
 */
export function RecordsLedger() {
  const translate = useTranslations("screens.ledger");
  const translatePages = useTranslations("pages");
  const translateStatus = useTranslations("status");
  const translateCategories = useTranslations("samples.categories");
  const number = useNumber();
  const [recordState, setRecordState] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () =>
      SAMPLE_LEDGER.filter(
        (entry) =>
          (recordState === "all" || entry.state === recordState) &&
          entry.id.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [recordState, search],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Filtering resets the page, but clamping here keeps the view valid if the rows ever shrink
  // without a filter change, without a render-triggering effect.
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const verifiedWeight = SAMPLE_LEDGER.filter(
    (entry) => entry.state === state.approved_and_completed,
  ).reduce((total, entry) => total + entry.weightKg, 0);
  const awaitingDecision = SAMPLE_LEDGER.filter(
    (entry) => entry.state === state.under_review,
  ).length;

  const columns: DataColumn<SampleLedgerEntry>[] = [
    { key: "id", header: translate("colRecord"), primary: true, cell: (row) => row.id },
    {
      key: "category",
      header: translate("colCategory"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translateCategories(row.categoryKey)}
        </span>
      ),
    },
    {
      key: "area",
      header: translate("colArea"),
      cell: (row) => <span className="text-muted-foreground font-normal">{row.area}</span>,
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
      key: "state",
      header: translate("colState"),
      cell: (row) => <StatusBadge status={row.state} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("ledgerTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("total")}
          value={translate("totalValue", { count: number(SAMPLE_LEDGER.length) })}
        />
        <MetricCard
          label={translate("verified")}
          tone="success"
          value={translate("verifiedValue", { value: number(verifiedWeight, 1) })}
        />
        <MetricCard
          label={translate("pending")}
          tone="warning"
          value={translate("pendingValue", { count: number(awaitingDecision) })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterState")}
          onChange={(event) => {
            setRecordState(event.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: translate("stateAll") },
            ...RecoveryRecordStateSchema.options.map((value) => ({
              value,
              label: translateStatus(value),
            })),
          ]}
          value={recordState}
        />
        <SearchInput
          className="min-w-48 flex-1 sm:ms-auto sm:max-w-xs"
          label={translate("search")}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={translate("search")}
          value={search}
        />
      </div>

      {visible.length > 0 ? (
        <>
          <DataTable
            caption={translate("tableCaption")}
            columns={columns}
            getRowId={(row) => row.id}
            rows={visible}
          />
          <Pagination onPageChange={setPage} page={currentPage} pageCount={pageCount} />
        </>
      ) : (
        <EmptyState />
      )}

      <InfoPanel as="h2" title={translate("areaTitle")} tone="info">
        {translate("areaText")}
      </InfoPanel>
    </div>
  );
}
