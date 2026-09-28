"use client";

import {
  REVIEW_QUEUE_STATUSES,
  type ReviewCaseSummary,
  type ReviewQueueFilters,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useDestinations } from "@/hooks/use-reference";
import { useReviewCases } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { REVIEW_FLAG_CODES, isReviewFlagCode } from "@/services/domain/flags";

const PAGE_SIZE = 10;
const OPEN_STATUSES = ["open", "awaiting_information"] as const;
type StatusFilter = "unresolved" | (typeof REVIEW_QUEUE_STATUSES)[number];

/**
 * Review queue (FR-REV-003, FR-REV-004, FR-DSH-002).
 *
 * Status, flag, facility and opening-date filters are sent to the API, which applies them to the
 * reviewer's scope before paginating; this screen never filters or pages in the browser. Each
 * row shows enough to prioritise — the reason and the facility — without the collector's
 * identity, which a reviewer does not need to triage.
 */
export function ReviewQueue() {
  const translate = useTranslations("screens.reviewer");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const destinations = useDestinations();

  const [status, setStatus] = useState<StatusFilter>("unresolved");
  const [flag, setFlag] = useState("all");
  const [facility, setFacility] = useState("all");
  const [openedFrom, setOpenedFrom] = useState("");
  const [openedTo, setOpenedTo] = useState("");
  // Server cursors of the pages visited so far; the last one selects the current page.
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);

  const filters = useMemo<ReviewQueueFilters>(() => {
    const cursor = cursors.at(-1);
    return {
      limit: PAGE_SIZE,
      status: status === "unresolved" ? [...OPEN_STATUSES] : [status],
      ...(isReviewFlagCode(flag) ? { flag_code: flag } : {}),
      ...(facility !== "all" ? { facility_id: facility } : {}),
      ...(openedFrom ? { opened_from: openedFrom } : {}),
      ...(openedTo ? { opened_to: openedTo } : {}),
      ...(cursor ? { cursor } : {}),
    };
  }, [cursors, facility, flag, openedFrom, openedTo, status]);
  const query = useReviewCases(filters);

  const restart = () => setCursors([undefined]);

  // Facilities are identified by their receiving locations' names in the programme directory.
  const facilities = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const location of destinations.data ?? []) {
      names.set(location.facility_id, [...(names.get(location.facility_id) ?? []), location.name]);
    }
    return [...names.entries()].map(([id, locationNames]) => ({
      value: id,
      label: locationNames.join(", "),
    }));
  }, [destinations.data]);
  const facilityName = (id: string | undefined) =>
    facilities.find((entry) => entry.value === id)?.label;

  const columns: DataColumn<ReviewCaseSummary>[] = [
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
        row.flag_codes.length === 0 ? (
          <span className="text-muted-foreground">{translate("manualReview")}</span>
        ) : (
          <span className="text-warning font-semibold">
            {row.flag_codes.map((code) => labels.flag(code)).join(", ")}
          </span>
        ),
    },
    {
      key: "facility",
      header: translate("colFacility"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {facilityName(row.facility_id) ?? translate("noFacility")}
        </span>
      ),
    },
    {
      key: "opened",
      header: translate("colOpened"),
      cell: (row) => formats.date(row.opened_at) ?? "",
    },
    {
      key: "state",
      header: translate("colStatus"),
      cell: (row) => <StatusBadge status={row.record_business_state} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("reviewTitle")}</PageHeading>

      <div className="flex flex-wrap items-end gap-3">
        <FilterControl
          label={translate("filterStatus")}
          onChange={(event) => {
            setStatus(event.target.value as StatusFilter);
            restart();
          }}
          options={[
            { value: "unresolved", label: translate("unresolvedCases") },
            ...REVIEW_QUEUE_STATUSES.map((value) => ({
              value,
              label: labels.reviewState(value),
            })),
          ]}
          value={status}
        />
        <FilterControl
          label={translate("filterReason")}
          onChange={(event) => {
            setFlag(event.target.value);
            restart();
          }}
          options={[
            { value: "all", label: translate("allReasons") },
            ...REVIEW_FLAG_CODES.map((code) => ({ value: code, label: labels.flag(code) })),
          ]}
          value={flag}
        />
        <FilterControl
          label={translate("filterFacility")}
          onChange={(event) => {
            setFacility(event.target.value);
            restart();
          }}
          options={[{ value: "all", label: translate("allFacilities") }, ...facilities]}
          value={facility}
        />
        <label className="block">
          <span className="text-foreground block text-xs font-semibold">
            {translate("filterDateFrom")}
          </span>
          <input
            className="border-border bg-surface min-h-touch mt-1 rounded-sm border px-3 text-sm"
            onChange={(event) => {
              setOpenedFrom(event.target.value);
              restart();
            }}
            type="date"
            value={openedFrom}
          />
        </label>
        <label className="block">
          <span className="text-foreground block text-xs font-semibold">
            {translate("filterDateTo")}
          </span>
          <input
            className="border-border bg-surface min-h-touch mt-1 rounded-sm border px-3 text-sm"
            onChange={(event) => {
              setOpenedTo(event.target.value);
              restart();
            }}
            type="date"
            value={openedTo}
          />
        </label>
      </div>

      <AsyncPanel query={query}>
        {(page) => (
          <>
            <p className="text-muted-foreground text-xs" role="status">
              {translate("pageCount", {
                count: formats.number(page.items.length, 0),
                page: formats.number(cursors.length, 0),
              })}
            </p>
            {page.items.length === 0 ? (
              <p className="bg-surface text-muted-foreground rounded-md border p-4 text-sm">
                {translate("noResults")}
              </p>
            ) : (
              <DataTable
                caption={translate("tableCaption")}
                columns={columns}
                getRowId={(row) => row.case_id}
                rows={page.items}
              />
            )}
            <nav aria-label={translate("pagination")} className="flex gap-2">
              <Button
                disabled={cursors.length === 1 || query.isFetching}
                onClick={() => setCursors((current) => current.slice(0, -1))}
                variant="secondary"
              >
                {translate("previousPage")}
              </Button>
              <Button
                disabled={!page.pagination.has_more || query.isFetching}
                onClick={() => {
                  const next = page.pagination.next_cursor;
                  if (next) setCursors((current) => [...current, next]);
                }}
                variant="secondary"
              >
                {translate("nextPage")}
              </Button>
            </nav>
          </>
        )}
      </AsyncPanel>
    </div>
  );
}
