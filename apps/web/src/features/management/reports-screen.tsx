"use client";

import {
  EwasteCategorySchema,
  RecoveryRecordStateSchema,
  type EwasteCategory,
  type RecoveryRecord,
  type RecoveryRecordState,
  type ReportingFiltersSchema,
} from "@scraptrace/contracts";
import { Download, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { MetricCard, PageHeading, SectionHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import {
  downloadCsv,
  useBuildExport,
  useProgrammeSettings,
  useReportRows,
  useReportSummary,
} from "@/hooks/use-programme";
import { toKilograms } from "@/services/domain/flags";
import { ALL_DIRECTORY_LOCATIONS, findLocationName } from "@/services/local/location-directory";

type ReportingFilters = z.infer<typeof ReportingFiltersSchema>;

const PAGE_SIZE = 10;

/**
 * Programme reports and export (FR-DSH-003, FR-DSH-005, FR-DSH-007).
 *
 * The preview table, the totals and the downloaded file all come from the same filters, so the
 * file cannot disagree with what the screen shows. The export carries programme and evidence facts
 * only: no collector identifier, telephone number, precise coordinate or storage URL.
 */
export function ReportsScreen() {
  const translate = useTranslations("screens.reports");
  const translateStatus = useTranslations("status");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const settingsQuery = useProgrammeSettings();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState<EwasteCategory | "all">("all");
  const [state, setState] = useState<RecoveryRecordState | "all">("all");
  const [locationId, setLocationId] = useState("all");
  const [area, setArea] = useState("all");
  const [page, setPage] = useState(1);

  const areas = useMemo(() => ["Greater Accra", "Ashanti Region", "Northern Region"], []);

  const filters = useMemo<ReportingFilters>(
    () => ({
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(category === "all" ? {} : { categories: [category] }),
      ...(state === "all" ? {} : { states: [state] }),
      ...(locationId === "all" ? {} : { receiving_location_id: locationId }),
      ...(area === "all" ? {} : { coarse_area: area }),
      pagination: { cursor: String((page - 1) * PAGE_SIZE), limit: PAGE_SIZE },
    }),
    [area, category, dateFrom, dateTo, locationId, page, state],
  );

  const summaryQuery = useReportSummary(filters);
  const rowsQuery = useReportRows(filters);
  const buildExport = useBuildExport();

  const reset = () => {
    setDateFrom("");
    setDateTo("");
    setCategory("all");
    setState("all");
    setLocationId("all");
    setArea("all");
    setPage(1);
  };

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
      key: "captured",
      header: translate("colCaptured"),
      cell: (row) => formats.date(row.captured_at) ?? "",
    },
    { key: "area", header: translate("colArea"), cell: (row) => row.approximate_area.label },
    {
      key: "facility",
      header: translate("colFacility"),
      cell: (row) => findLocationName(row.handoff?.receiving_location_id) ?? "—",
    },
    {
      key: "received",
      header: translate("colReceived"),
      cell: (row) =>
        row.handoff ? `${formats.number(toKilograms(row.handoff.measured_weight), 2)} kg` : "—",
    },
    {
      key: "verified",
      header: translate("colVerified"),
      cell: (row) => (
        <span
          className={
            row.business_state === "approved_and_completed"
              ? "text-primary font-bold"
              : "text-muted-foreground"
          }
        >
          {translate(row.business_state === "approved_and_completed" ? "yes" : "no")}
        </span>
      ),
    },
    {
      key: "state",
      header: translate("colState"),
      cell: (row) => <StatusBadge status={row.business_state} />,
    },
  ];

  const onDownload = () => {
    buildExport.mutate(filters, {
      onSuccess: (result) => {
        downloadCsv(result.filename, result.content);
        show({
          title: translate("exportReady", {
            rows: formats.number(result.rowCount, 0),
            filename: result.filename,
          }),
          tone: "success",
        });
      },
      onError: (error) => show({ title: safeMessage(error), tone: "warning" }),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("filtersHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-foreground block text-xs font-semibold">
                {translate("dateFrom")}
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
            <label className="block">
              <span className="text-foreground block text-xs font-semibold">
                {translate("dateTo")}
              </span>
              <input
                className="border-border bg-surface min-h-touch mt-1 rounded-sm border px-3 text-sm"
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={dateTo}
              />
            </label>
            <FilterControl
              label={translate("filterCategory")}
              onChange={(event) => {
                setCategory(event.target.value as EwasteCategory | "all");
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
              label={translate("filterState")}
              onChange={(event) => {
                setState(event.target.value as RecoveryRecordState | "all");
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
            <FilterControl
              label={translate("filterFacility")}
              onChange={(event) => {
                setLocationId(event.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: translate("allFacilities") },
                ...ALL_DIRECTORY_LOCATIONS.map((entry) => ({
                  value: entry.location_id,
                  label: entry.name,
                })),
              ]}
              value={locationId}
            />
            <FilterControl
              label={translate("filterArea")}
              onChange={(event) => {
                setArea(event.target.value);
                setPage(1);
              }}
              options={[
                { value: "all", label: translate("allAreas") },
                ...areas.map((value) => ({ value, label: value })),
              ]}
              value={area}
            />
            <Button onClick={reset} variant="secondary">
              <RotateCcw aria-hidden="true" className="size-4" />
              {translate("resetFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AsyncPanel query={summaryQuery} skeletonRows={1}>
        {(summary) => (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label={translate("matchingRecords")}
                value={formats.number(
                  Object.values(summary.record_counts_by_state).reduce(
                    (total, value) => total + value,
                    0,
                  ),
                  0,
                )}
              />
              <MetricCard
                label={translate("verifiedRecords")}
                tone="success"
                value={formats.number(
                  summary.record_counts_by_state.approved_and_completed ?? 0,
                  0,
                )}
              />
              <MetricCard
                label={translate("verifiedWeight")}
                tone="success"
                value={`${formats.number(summary.verified_weight.value, 3)} ${summary.verified_weight.unit}`}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {translate("freshness", {
                when: formats.dateTime(summary.data_freshness_at) ?? "",
              })}
            </p>
            <Alert title={translate("verifiedDefinitionTitle")} tone="info">
              {translate("verifiedDefinition", {
                state: translateStatus(summary.verified_weight.eligible_state),
              })}
            </Alert>
          </>
        )}
      </AsyncPanel>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("previewHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          <AsyncPanel isEmpty={(data) => data.records.length === 0} query={rowsQuery}>
            {(data) => {
              const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
              return (
                <>
                  <p className="text-muted-foreground text-xs" role="status">
                    {translate("resultCount", { count: formats.number(data.total, 0) })}
                  </p>
                  <DataTable
                    caption={translate("tableCaption")}
                    columns={columns}
                    getRowId={(row) => row.record_id}
                    rows={data.records}
                  />
                  {pageCount > 1 ? (
                    <Pagination
                      onPageChange={setPage}
                      page={Math.min(page, pageCount)}
                      pageCount={pageCount}
                    />
                  ) : null}
                </>
              );
            }}
          </AsyncPanel>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("exportHeading")}</SectionHeading>
          <p className="text-muted-foreground text-xs leading-5">{translate("exportNotice")}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button block loading={buildExport.isPending} onClick={onDownload} size="large">
            <Download aria-hidden="true" className="size-5" />
            {translate("downloadCsv")}
          </Button>
          {buildExport.data ? (
            <p className="text-muted-foreground text-xs" role="status">
              {translate("lastExport", {
                filename: buildExport.data.filename,
                rows: formats.number(buildExport.data.rowCount, 0),
              })}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs leading-5">
            {translate("programmeName", {
              name: settingsQuery.data?.programme_name ?? "",
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
