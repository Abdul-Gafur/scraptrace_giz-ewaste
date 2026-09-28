"use client";

import { RecoveryRecordStateSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useRecordPages } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";
import type { RecoveryRecord } from "@scraptrace/contracts";

/**
 * Records this facility may act on. The lifecycle-state filter and paging are applied by the API;
 * the reference search narrows the rows already loaded.
 */
export function RecyclerRecordsScreen() {
  const translate = useTranslations("screens.recyclerRecords");
  const translateStatus = useTranslations("status");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");
  const stateFilter = RecoveryRecordStateSchema.safeParse(state);
  const query = useRecordPages({
    limit: 25,
    ...(stateFilter.success ? { state: [stateFilter.data] } : {}),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
      (record) => term.length === 0 || record.human_reference.toLowerCase().includes(term),
    );
  }, [query.data, search]);

  const columns: DataColumn<RecoveryRecord>[] = [
    {
      key: "reference",
      header: translate("colReference"),
      primary: true,
      cell: (row) => (
        <Link
          className="text-info font-mono font-bold underline-offset-2 hover:underline"
          href={`/recycler/records/${row.record_id}`}
        >
          {row.human_reference}
        </Link>
      ),
    },
    {
      key: "category",
      header: translate("colCategory"),
      cell: (row) => labels.category(row.category),
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
        row.handoff ? (
          <span className="text-primary font-bold">
            {formats.number(toKilograms(row.handoff.measured_weight), 2)} kg
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "flags",
      header: translate("colFlags"),
      cell: (row) =>
        row.review.flag_codes.length === 0 ? (
          <span className="text-muted-foreground">{translate("noFlags")}</span>
        ) : (
          <span className="text-warning font-semibold">
            {row.review.flag_codes.map((code) => labels.flag(code)).join(", ")}
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
      <PageHeading>{translate("title")}</PageHeading>

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterState")}
          onChange={(event) => setState(event.target.value)}
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder={translate("search")}
          value={search}
        />
      </div>

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
      {query.hasNextPage ? (
        <Button
          disabled={query.isFetchingNextPage}
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          variant="secondary"
        >
          {translate("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
