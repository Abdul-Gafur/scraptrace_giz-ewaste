"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/states";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterControl } from "@/components/ui/filter-control";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { SearchInput } from "@/components/ui/input";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_RECORDS, type SampleRecord } from "../samples";

const MATERIAL: Record<SampleRecord["key"], "battery" | "glass" | "boards"> = {
  leadAcid: "battery",
  crt: "glass",
  telecom: "boards",
};

/** Figma: ProgrammeReviewerShell. Filters and search act on the sample rows only. */
export function ReviewQueue() {
  const translate = useTranslations("screens.reviewer");
  const translatePages = useTranslations("pages");
  const translateSamples = useTranslations("samples");
  const number = useNumber();
  const [material, setMaterial] = useState("all");
  const [gps, setGps] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () =>
      SAMPLE_RECORDS.filter(
        (record) =>
          (material === "all" || MATERIAL[record.key] === material) &&
          (gps === "all" || record.gps === gps) &&
          record.id.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [material, gps, search],
  );

  const columns: DataColumn<SampleRecord>[] = [
    { key: "id", header: translate("colRecord"), primary: true, cell: (row) => row.id },
    {
      key: "facility",
      header: translate("colFacility"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translateSamples(`${row.key}.facility`)}
        </span>
      ),
    },
    {
      key: "mass",
      header: translate("colMass"),
      cell: (row) => (
        <span className="text-primary font-bold">
          {translateSamples(`${row.key}.reviewerMass`)}
        </span>
      ),
    },
    {
      key: "gps",
      header: translate("colGps"),
      cell: (row) => <StatusBadge status={row.gps} />,
    },
    {
      key: "status",
      header: translate("colStatus"),
      cell: (row) => <StatusBadge status={row.reviewStatus} />,
    },
    {
      key: "actions",
      header: translate("colActions"),
      align: "end",
      cell: (row) => (
        <DeferredActionButton aria-label={translate("auditRecord", { id: row.id })}>
          {translate("audit")}
        </DeferredActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("reviewTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("awaiting")}
          value={translate("awaitingValue", { count: number(14) })}
        />
        <MetricCard
          label={translate("weight")}
          tone="success"
          value={translate("weightValue", {
            value: number(184.2),
          })}
        />
        <MetricCard
          label={translate("alerts")}
          tone="danger"
          value={translate("alertsValue", { count: number(2) })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterMaterial")}
          onChange={(event) => setMaterial(event.target.value)}
          options={[
            { value: "all", label: translate("allMaterials") },
            { value: "battery", label: translate("materialBattery") },
            { value: "glass", label: translate("materialGlass") },
            { value: "boards", label: translate("materialBoards") },
          ]}
          value={material}
        />
        <FilterControl
          label={translate("filterGps")}
          onChange={(event) => setGps(event.target.value)}
          options={[
            { value: "all", label: translate("gpsAll") },
            { value: "verified_gps", label: translate("gpsVerified") },
            { value: "unverified_gps", label: translate("gpsUnverified") },
          ]}
          value={gps}
        />
        <SearchInput
          className="min-w-48 flex-1 sm:ms-auto sm:max-w-xs"
          label={translate("search")}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={translate("search")}
          value={search}
        />
      </div>

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
    </div>
  );
}
