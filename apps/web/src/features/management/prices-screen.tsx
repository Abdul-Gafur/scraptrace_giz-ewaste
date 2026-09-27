"use client";

import { EwasteCategorySchema, ItemConditionSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { PageHeading, SectionHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useProgrammeSettings } from "@/hooks/use-programme";
import {
  PRICE_REFERENCE_EFFECTIVE_DATE,
  PRICE_REFERENCE_SOURCE,
  buildPriceEstimate,
} from "@/services/local/price-reference";

interface PriceRow {
  readonly category: string;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly basis: string;
}

/**
 * Indicative price reference (FR-PRI-004, FR-PRI-005).
 *
 * The table is generated from the same reference data the estimate uses, at the selected
 * condition, so the screen and an estimate can never disagree. A category with no current entry
 * shows as unavailable rather than carrying an invented figure.
 */
export function PricesScreen() {
  const translate = useTranslations("screens.prices");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const settingsQuery = useProgrammeSettings();
  const [condition, setCondition] = useState<string>("working");
  const currency = settingsQuery.data?.currency ?? "GHS";

  const rows: readonly PriceRow[] = EwasteCategorySchema.options.map((category) => {
    const estimate = buildPriceEstimate({
      category,
      condition: condition as Parameters<typeof buildPriceEstimate>[0]["condition"],
      itemCount: 1,
      // Mixed scrap is priced per kilogram, so the table shows the rate for one kilogram.
      ...(category === "mixed_scrap" ? { approximateWeightKg: 1 } : {}),
      currency,
    });
    return {
      category,
      minimum: estimate?.minimum_amount ?? null,
      maximum: estimate?.maximum_amount ?? null,
      basis: estimate?.basis ?? translate("unavailable"),
    };
  });

  const columns: DataColumn<PriceRow>[] = [
    {
      key: "category",
      header: translate("colCategory"),
      primary: true,
      cell: (row) => labels.category(row.category as Parameters<typeof labels.category>[0]),
    },
    {
      key: "minimum",
      header: translate("colMinimum"),
      cell: (row) =>
        row.minimum === null ? translate("unavailable") : formats.currency(row.minimum, currency),
    },
    {
      key: "maximum",
      header: translate("colMaximum"),
      cell: (row) =>
        row.maximum === null ? translate("unavailable") : formats.currency(row.maximum, currency),
    },
    {
      key: "basis",
      header: translate("colBasis"),
      cell: (row) => <span className="text-muted-foreground font-normal">{row.basis}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <FilterControl
        label={translate("filterCondition")}
        onChange={(event) => setCondition(event.target.value)}
        options={ItemConditionSchema.options.map((value) => ({
          value,
          label: labels.condition(value),
        }))}
        value={condition}
      />

      <DataTable
        caption={translate("tableCaption")}
        columns={columns}
        getRowId={(row) => row.category}
        rows={rows}
      />

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("metadataHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <p>{translate("effectiveDate", { date: PRICE_REFERENCE_EFFECTIVE_DATE })}</p>
          <p>{translate("source", { source: PRICE_REFERENCE_SOURCE })}</p>
          <p>{translate("unitNotice", { currency })}</p>
        </CardContent>
      </Card>

      <Alert title={translate("disclaimerTitle")} tone="warning">
        {translate("disclaimer")}
      </Alert>
    </div>
  );
}
