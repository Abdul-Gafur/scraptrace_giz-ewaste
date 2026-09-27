"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeading } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { ALL_DIRECTORY_LOCATIONS } from "@/services/local/location-directory";

type DirectoryRow = (typeof ALL_DIRECTORY_LOCATIONS)[number] & {
  readonly recordCount: number;
  readonly receivedKg: number;
};

/**
 * Recovery locations (FR-LOC-001, FR-LOC-004, BR-006).
 *
 * The verification state and its date are shown for every profile, and the verified badge appears
 * only for a manager-reviewed profile. Record counts come from the shared repository.
 */
export function ManagementLocationsScreen() {
  const translate = useTranslations("screens.managementLocations");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOperationalRecords();

  const columns: DataColumn<DirectoryRow>[] = [
    { key: "name", header: translate("colName"), primary: true, cell: (row) => row.name },
    {
      key: "type",
      header: translate("colType"),
      cell: (row) => labels.facilityType(row.facility_type),
    },
    {
      key: "verification",
      header: translate("colVerification"),
      cell: (row) =>
        row.verification_status === "programme_verified" ? (
          <Badge className="bg-success-subtle text-success-strong">
            {labels.verification(row.verification_status)}
          </Badge>
        ) : (
          <Badge className="bg-neutral-subtle text-muted-foreground">
            {labels.verification(row.verification_status)}
          </Badge>
        ),
    },
    {
      key: "verifiedOn",
      header: translate("colVerifiedOn"),
      cell: (row) => row.verification_date ?? "—",
    },
    {
      key: "categories",
      header: translate("colCategories"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {row.accepted_categories.map((value) => labels.category(value)).join(", ")}
        </span>
      ),
    },
    {
      key: "records",
      header: translate("colRecords"),
      cell: (row) => formats.number(row.recordCount, 0),
    },
    {
      key: "received",
      header: translate("colReceived"),
      cell: (row) => formats.kilograms(row.receivedKg),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>
      <AsyncPanel query={query} skeletonRows={2}>
        {(records) => {
          const rows: DirectoryRow[] = ALL_DIRECTORY_LOCATIONS.map((entry) => {
            const matching = records.filter(
              (record) => record.handoff?.receiving_location_id === entry.location_id,
            );
            return {
              ...entry,
              recordCount: matching.length,
              receivedKg: matching.reduce(
                (total, record) =>
                  record.handoff
                    ? total +
                      (record.handoff.measured_weight.unit === "kg"
                        ? record.handoff.measured_weight.value
                        : record.handoff.measured_weight.value / 1000)
                    : total,
                0,
              ),
            };
          });
          return (
            <DataTable
              caption={translate("tableCaption")}
              columns={columns}
              getRowId={(row) => row.location_id}
              rows={rows}
            />
          );
        }}
      </AsyncPanel>
      <p className="text-muted-foreground text-xs leading-5">{translate("badgeNotice")}</p>
    </div>
  );
}
