import { useTranslations } from "next-intl";

import { InfoPanel } from "@/components/ui/card";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_DIRECTORY, type SampleDirectoryEntry } from "../samples";

/**
 * No Figma frame. The manager's view of the same directory the collector searches:
 * `ParticipatingLocationSchema` ties a location's verification status to its last review, so
 * both are shown together and an expiring entry is visible before it stops receiving records.
 */
export function RecoveryLocations() {
  const translate = useTranslations("screens.recoveryLocations");
  const translateTypes = useTranslations("screens.facilityTypes");
  const translateWorkflow = useTranslations("screens.workflow");
  const translatePages = useTranslations("pages");
  const translateSamples = useTranslations("samples.locations");
  const number = useNumber();
  const date = useDate();

  const verified = SAMPLE_DIRECTORY.filter((entry) => entry.verified).length;
  const records = SAMPLE_DIRECTORY.reduce((total, entry) => total + entry.records, 0);

  const columns: DataColumn<SampleDirectoryEntry>[] = [
    {
      key: "name",
      header: translate("colName"),
      primary: true,
      cell: (row) => translateSamples(`${row.key}.name`),
    },
    {
      key: "type",
      header: translate("colType"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">{translateTypes(row.type)}</span>
      ),
    },
    {
      key: "verification",
      header: translate("colVerification"),
      cell: (row) => (
        <ToneBadge tone={row.verified ? "success" : "neutral"}>
          {translateWorkflow(row.verified ? "verified" : "unverified")}
        </ToneBadge>
      ),
    },
    {
      key: "records",
      header: translate("colRecords"),
      cell: (row) => <span className="text-primary font-bold">{number(row.records)}</span>,
    },
    {
      key: "reviewed",
      header: translate("colReviewed"),
      cell: (row) => <span className="font-normal">{date(row.reviewedOn)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("recoveryLocationsTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("verifiedCount")}
          tone="success"
          value={translate("verifiedValue", { count: number(verified) })}
        />
        <MetricCard
          label={translate("unverifiedCount")}
          tone="warning"
          value={translate("unverifiedValue", {
            count: number(SAMPLE_DIRECTORY.length - verified),
          })}
        />
        <MetricCard
          label={translate("recordsRouted")}
          value={translate("recordsValue", { count: number(records) })}
        />
      </div>

      <DataTable
        caption={translate("tableCaption")}
        columns={columns}
        getRowId={(row) => row.key}
        rows={SAMPLE_DIRECTORY}
      />

      <InfoPanel as="h2" title={translate("reviewTitle")} tone="warning">
        {translate("reviewText")}
      </InfoPanel>
    </div>
  );
}
