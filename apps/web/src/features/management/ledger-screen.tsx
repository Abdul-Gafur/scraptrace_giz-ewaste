"use client";

import { RecoveryRecordStateSchema, type RecoveryRecord } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { toKilograms } from "@/services/domain/flags";
import { findLocationName } from "@/services/local/location-directory";

const PAGE_SIZE = 15;

/** Every record in the programme, in one read-only ledger. */
export function LedgerScreen() {
  const translate = useTranslations("screens.ledger");
  const translateStatus = useTranslations("status");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOperationalRecords();
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? [])
      .filter(
        (record) =>
          (state === "all" || record.business_state === state) &&
          (term.length === 0 || record.human_reference.toLowerCase().includes(term)),
      )
      .sort((first, second) => second.captured_at.localeCompare(first.captured_at));
  }, [query.data, search, state]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: DataColumn<RecoveryRecord>[] = [
    {
      key: "reference",
      header: translate("colReference"),
      primary: true,
      cell: (row) => <span className="font-mono">{row.human_reference}</span>,
    },
    {
      key: "category",
      header: translate("colCategory"),
      cell: (row) => labels.category(row.category),
    },
    {
      key: "revision",
      header: translate("colRevision"),
      cell: (row) => formats.number(row.revision, 0),
    },
    {
      key: "declared",
      header: translate("colDeclared"),
      cell: (row) => formats.weight(row.approximate_weight) ?? "—",
    },
    {
      key: "received",
      header: translate("colReceived"),
      cell: (row) =>
        row.handoff ? `${formats.number(toKilograms(row.handoff.measured_weight), 2)} kg` : "—",
    },
    {
      key: "facility",
      header: translate("colFacility"),
      cell: (row) => findLocationName(row.handoff?.receiving_location_id) ?? "—",
    },
    {
      key: "digest",
      header: translate("colDigest"),
      cell: (row) => (
        <span className="font-mono text-[0.625rem]">
          {row.integrity_digest ? `${row.integrity_digest.slice(7, 19)}…` : "—"}
        </span>
      ),
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

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterState")}
          onChange={(event) => {
            setState(event.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: translate("allStates") },
            ...RecoveryRecordStateSchema.options.map((value) => ({
              value,
              label: translateStatus(value),
            })),
          ]}
          value={state}
        />
        <SearchInput
          className="min-w-48 flex-1 sm:max-w-xs"
          label={translate("search")}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={translate("search")}
          value={search}
        />
      </div>

      <p className="text-muted-foreground text-xs" role="status">
        {translate("resultCount", { count: formats.number(rows.length, 0) })}
      </p>

      <AsyncPanel isEmpty={() => rows.length === 0} query={query}>
        {() => (
          <>
            <DataTable
              caption={translate("tableCaption")}
              columns={columns}
              getRowId={(row) => row.record_id}
              rows={visible}
            />
            {pageCount > 1 ? (
              <Pagination onPageChange={setPage} page={currentPage} pageCount={pageCount} />
            ) : null}
          </>
        )}
      </AsyncPanel>
      <p className="text-muted-foreground text-xs leading-5">{translate("digestNotice")}</p>
    </div>
  );
}
