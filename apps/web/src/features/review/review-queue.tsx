"use client";

import { EwasteCategorySchema, type RecoveryRecord } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useReviewQueue } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { REVIEW_FLAG_CODES } from "@/services/domain/flags";
import { toKilograms } from "@/services/domain/flags";
import { findLocationName } from "@/services/local/location-directory";
import { DEMO_FACILITY_LOCATION_IDS } from "@/auth/actors";

const PAGE_SIZE = 10;

/**
 * Review queue (FR-REV-003, FR-REV-004, FR-DSH-002).
 *
 * Only records that are under review, or that still carry an open flag, appear. Each row shows
 * enough to prioritise — the reason, the weight difference and the facility — without the
 * collector's identity, which a reviewer does not need to triage.
 */
export function ReviewQueue() {
  const translate = useTranslations("screens.reviewer");
  const translatePages = useTranslations("pages");
  const translateStatus = useTranslations("status");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useReviewQueue();

  const [flag, setFlag] = useState("all");
  const [category, setCategory] = useState("all");
  const [facility, setFacility] = useState("all");
  const [state, setState] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter((record) => {
      if (flag !== "all" && !(record.review.flag_codes as readonly string[]).includes(flag))
        return false;
      if (category !== "all" && record.category !== category) return false;
      if (state !== "all" && record.business_state !== state) return false;
      if (facility !== "all" && record.handoff?.receiving_location_id !== facility) return false;
      if (dateFrom && record.updated_at.slice(0, 10) < dateFrom) return false;
      if (term.length > 0 && !record.human_reference.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [category, dateFrom, facility, flag, query.data, search, state]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const difference = (record: RecoveryRecord): string => {
    if (!record.approximate_weight || !record.handoff) return "—";
    const declared = toKilograms(record.approximate_weight);
    const measured = toKilograms(record.handoff.measured_weight);
    if (declared <= 0) return "—";
    return formats.percent((measured - declared) / declared);
  };

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
      key: "category",
      header: translate("colCategory"),
      cell: (row) => labels.category(row.category),
    },
    {
      key: "reason",
      header: translate("colReason"),
      cell: (row) =>
        row.review.flag_codes.length === 0 ? (
          <span className="text-muted-foreground">{translate("manualReview")}</span>
        ) : (
          <span className="text-warning font-semibold">
            {row.review.flag_codes.map((code) => labels.flag(code)).join(", ")}
          </span>
        ),
    },
    {
      key: "difference",
      header: translate("colDifference"),
      cell: (row) => difference(row),
    },
    {
      key: "facility",
      header: translate("colFacility"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {findLocationName(row.handoff?.receiving_location_id) ?? translate("noFacility")}
        </span>
      ),
    },
    {
      key: "updated",
      header: translate("colUpdated"),
      cell: (row) => formats.date(row.updated_at) ?? "",
    },
    {
      key: "state",
      header: translate("colStatus"),
      cell: (row) => <StatusBadge status={row.business_state} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("reviewTitle")}</PageHeading>

      <AsyncPanel query={query}>
        {(records) => {
          const open = records.filter((record) => record.business_state === "under_review");
          const awaitingInformation = records.filter(
            (record) => record.review.review_state === "awaiting_information",
          );
          const flaggedWeight = records.reduce(
            (total, record) =>
              record.handoff ? total + toKilograms(record.handoff.measured_weight) : total,
            0,
          );
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={translate("awaiting")}
                  tone="warning"
                  value={formats.number(open.length, 0)}
                />
                <MetricCard
                  label={translate("awaitingInformation")}
                  tone="danger"
                  value={formats.number(awaitingInformation.length, 0)}
                />
                <MetricCard
                  label={translate("weightUnderReview")}
                  value={formats.kilograms(flaggedWeight)}
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <FilterControl
                  label={translate("filterReason")}
                  onChange={(event) => {
                    setFlag(event.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: translate("allReasons") },
                    ...REVIEW_FLAG_CODES.map((code) => ({ value: code, label: labels.flag(code) })),
                  ]}
                  value={flag}
                />
                <FilterControl
                  label={translate("filterCategory")}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: translate("allCategories") },
                    ...EwasteCategorySchema.options.map((value) => ({
                      value,
                      label: labels.category(value),
                    })),
                  ]}
                  value={category}
                />
                <FilterControl
                  label={translate("filterFacility")}
                  onChange={(event) => {
                    setFacility(event.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: translate("allFacilities") },
                    ...DEMO_FACILITY_LOCATION_IDS.map((id) => ({
                      value: id,
                      label: findLocationName(id) ?? id,
                    })),
                  ]}
                  value={facility}
                />
                <FilterControl
                  label={translate("filterState")}
                  onChange={(event) => {
                    setState(event.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: translate("allStates") },
                    { value: "under_review", label: translateStatus("under_review") },
                    {
                      value: "approved_and_completed",
                      label: translateStatus("approved_and_completed"),
                    },
                    { value: "rejected", label: translateStatus("rejected") },
                  ]}
                  value={state}
                />
                <label className="block">
                  <span className="text-foreground block text-xs font-semibold">
                    {translate("filterDateFrom")}
                  </span>
                  <input
                    className="border-border bg-surface min-h-touch mt-1 rounded-sm border px-3 text-sm"
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPage(1);
                    }}
                    type="date"
                    value={dateFrom}
                  />
                </label>
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

              <p className="text-muted-foreground text-xs" role="status">
                {translate("resultCount", { count: formats.number(rows.length, 0) })}
              </p>

              {visible.length === 0 ? (
                <p className="bg-surface text-muted-foreground rounded-md border p-4 text-sm">
                  {translate("noResults")}
                </p>
              ) : (
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
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
