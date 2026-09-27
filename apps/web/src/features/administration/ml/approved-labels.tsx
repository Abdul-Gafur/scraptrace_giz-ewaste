"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Alert } from "@/components/ui/alert";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { BarChart, type BarDatum } from "@/features/shared/bar-chart";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { usePredictionFeedback } from "@/hooks/use-administration";
import { EwasteCategorySchema } from "@scraptrace/contracts";
import { isCorrection, type PredictionFeedback } from "@/services/domain/model-administration";

/**
 * Labels approved for a future dataset release (BR-012).
 *
 * These are candidates only. A dataset release is a separate, versioned, human-approved step, and
 * nothing on this screen changes the active model.
 */
export function ApprovedLabelsScreen() {
  const translate = useTranslations("screens.mlLabels");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = usePredictionFeedback();

  const rows = useMemo(
    () =>
      (query.data ?? []).filter((item) => item.feedback_state === "approved_for_training_dataset"),
    [query.data],
  );

  const columns: DataColumn<PredictionFeedback>[] = [
    {
      key: "confirmed",
      header: translate("colConfirmed"),
      primary: true,
      cell: (row) => labels.category(row.confirmed_category),
    },
    {
      key: "predicted",
      header: translate("colPredicted"),
      cell: (row) => labels.category(row.predicted_category),
    },
    {
      key: "confidence",
      header: translate("colConfidence"),
      cell: (row) => formats.percent(row.confidence),
    },
    {
      key: "correction",
      header: translate("colCorrection"),
      cell: (row) => translate(isCorrection(row) ? "yes" : "no"),
    },
    {
      key: "model",
      header: translate("colModel"),
      cell: (row) => `${row.model_name} ${row.model_version}`,
    },
    {
      key: "reviewed",
      header: translate("colReviewed"),
      cell: (row) => formats.dateTime(row.reviewed_at) ?? "—",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <Alert title={translate("boundaryTitle")} tone="info">
        {translate("boundaryNotice")}
      </Alert>

      <AsyncPanel isEmpty={() => rows.length === 0} query={query}>
        {() => {
          const byCategory: readonly BarDatum[] = EwasteCategorySchema.options
            .map((category) => ({
              key: category,
              label: labels.category(category),
              value: rows.filter((row) => row.confirmed_category === category).length,
            }))
            .filter((datum) => datum.value > 0);

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={translate("approvedCount")}
                  tone="success"
                  value={formats.number(rows.length, 0)}
                />
                <MetricCard
                  label={translate("correctionCount")}
                  tone="warning"
                  value={formats.number(rows.filter(isCorrection).length, 0)}
                />
                <MetricCard
                  label={translate("categoriesCovered")}
                  value={formats.number(byCategory.length, 0)}
                />
              </div>

              <BarChart
                data={byCategory}
                summary={translate("chartSummary", { count: formats.number(rows.length, 0) })}
                title={translate("chartTitle")}
              />

              <DataTable
                caption={translate("tableCaption")}
                columns={columns}
                getRowId={(row) => row.feedback_id}
                rows={rows}
              />
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
