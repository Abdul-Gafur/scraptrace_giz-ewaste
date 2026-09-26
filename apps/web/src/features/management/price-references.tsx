import { useTranslations } from "next-intl";

import { InfoPanel } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_PRICES, type SamplePriceReference } from "../samples";

const SOURCE_LABEL = {
  nationalIndex: "sourceNationalIndex",
  regionalSurvey: "sourceRegionalSurvey",
} as const satisfies Record<SamplePriceReference["sourceKey"], string>;

/**
 * No Figma frame. `PriceEstimateSchema` treats a price as indicative and never as an offer, so
 * the warning leads the screen and every figure keeps its source and its date.
 */
export function PriceReferences() {
  const translate = useTranslations("screens.prices");
  const translatePages = useTranslations("pages");
  const translateMaterials = useTranslations("samples.materials");
  const number = useNumber();
  const date = useDate();

  const columns: DataColumn<SamplePriceReference>[] = [
    {
      key: "material",
      header: translate("colMaterial"),
      primary: true,
      cell: (row) => translateMaterials(row.key),
    },
    {
      key: "price",
      header: translate("colPrice"),
      cell: (row) => (
        <span className="text-warning font-bold">
          {translate("perKg", { value: number(row.pricePerKg, 2) })}
        </span>
      ),
    },
    {
      key: "source",
      header: translate("colSource"),
      cell: (row) => (
        <span className="text-muted-foreground font-normal">
          {translate(SOURCE_LABEL[row.sourceKey])}
        </span>
      ),
    },
    {
      key: "updated",
      header: translate("colUpdated"),
      cell: (row) => <span className="font-normal">{date(row.updatedOn)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("pricesTitle")}</PageHeading>
      <SampleDataNote />

      <InfoPanel as="h2" title={translate("indicativeTitle")} tone="warning">
        {translate("indicativeText")}
      </InfoPanel>

      <DataTable
        caption={translate("tableCaption")}
        columns={columns}
        getRowId={(row) => row.key}
        rows={SAMPLE_PRICES}
      />
    </div>
  );
}
