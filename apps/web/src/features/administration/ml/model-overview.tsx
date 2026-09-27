"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DefinitionList,
  DefinitionRow,
  MetricCard,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { AsyncPanel } from "@/features/shared/async-panel";
import { BarChart, type BarDatum } from "@/features/shared/bar-chart";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useModelConfiguration, useModelRegistry } from "@/hooks/use-administration";
import type { EwasteCategory } from "@scraptrace/contracts";
import type { CategoryMetricsSchema } from "@/services/domain/model-administration";
import type { z } from "zod";

interface MetricRow {
  readonly category: EwasteCategory;
  readonly metrics: z.infer<typeof CategoryMetricsSchema>;
}

/**
 * Model overview.
 *
 * Every figure comes from the registered artefact's own metadata. The task the model performs is
 * stated plainly: it assigns one category to one image. It is not an object detector, so the screen
 * shows no bounding boxes, no counts and no per-object output, and it says so.
 */
export function ModelOverview() {
  const translate = useTranslations("screens.mlModel");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const registryQuery = useModelRegistry();
  const configurationQuery = useModelConfiguration();

  const columns: DataColumn<MetricRow>[] = [
    {
      key: "category",
      header: translate("colCategory"),
      primary: true,
      cell: (row) => labels.category(row.category),
    },
    {
      key: "precision",
      header: translate("colPrecision"),
      cell: (row) => formats.percent(row.metrics.precision),
    },
    {
      key: "recall",
      header: translate("colRecall"),
      cell: (row) => formats.percent(row.metrics.recall),
    },
    { key: "f1", header: translate("colF1"), cell: (row) => formats.percent(row.metrics.f1) },
    {
      key: "support",
      header: translate("colSupport"),
      cell: (row) => formats.number(row.metrics.support, 0),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <AsyncPanel isEmpty={(entries) => entries.length === 0} query={registryQuery}>
        {(entries) => (
          <>
            {entries.map((entry) => {
              const metricRows: MetricRow[] = Object.entries(entry.per_category_metrics).map(
                ([category, metrics]) => ({ category: category as EwasteCategory, metrics }),
              );
              const f1Data: readonly BarDatum[] = metricRows.map((row) => ({
                key: row.category,
                label: labels.category(row.category),
                value: Number((row.metrics.f1 * 100).toFixed(1)),
                tone: row.metrics.f1 >= 0.8 ? ("primary" as const) : ("warning" as const),
              }));

              return (
                <div className="space-y-4" key={entry.model_version}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      label={translate("accuracy")}
                      tone="success"
                      value={formats.percent(entry.overall_accuracy)}
                    />
                    <MetricCard
                      label={translate("macroF1")}
                      tone="success"
                      value={formats.percent(entry.macro_f1)}
                    />
                    <MetricCard
                      label={translate("categories")}
                      value={formats.number(entry.supported_categories.length, 0)}
                    />
                    <MetricCard
                      label={translate("confidenceThreshold")}
                      value={
                        configurationQuery.data
                          ? formats.percent(configurationQuery.data.confidence_threshold)
                          : "—"
                      }
                    />
                  </div>

                  <Alert title={translate("taskTitle")} tone="info">
                    {translate("taskNotice")}
                  </Alert>

                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <SectionHeading as="h2">{translate("artefactHeading")}</SectionHeading>
                        <Badge
                          className={
                            entry.status === "active"
                              ? "bg-success-subtle text-success-strong"
                              : "bg-neutral-subtle text-muted-foreground"
                          }
                        >
                          {translate(`status.${entry.status}`)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DefinitionList>
                        <DefinitionRow term={translate("modelName")}>
                          <span className="font-mono text-xs">{entry.model_name}</span>
                        </DefinitionRow>
                        <DefinitionRow term={translate("modelVersion")}>
                          {entry.model_version}
                        </DefinitionRow>
                        <DefinitionRow term={translate("architecture")}>
                          <span className="font-mono text-xs">{entry.architecture}</span>
                        </DefinitionRow>
                        <DefinitionRow term={translate("task")}>
                          <span className="font-mono text-xs">{entry.task}</span>
                        </DefinitionRow>
                        <DefinitionRow term={translate("checkpoint")}>
                          <span className="font-mono text-xs">{entry.checkpoint_filename}</span>
                        </DefinitionRow>
                        <DefinitionRow
                          term={translate("checksum")}
                          tone={entry.checkpoint_sha256 ? "neutral" : "warning"}
                        >
                          <span className="font-mono text-[0.625rem] break-all">
                            {entry.checkpoint_sha256 ?? translate("checksumNotRecorded")}
                          </span>
                        </DefinitionRow>
                        <DefinitionRow term={translate("trainingData")}>
                          {entry.training_data_version}
                        </DefinitionRow>
                        <DefinitionRow term={translate("evaluationDate")}>
                          {entry.evaluation_date}
                        </DefinitionRow>
                        <DefinitionRow term={translate("lastConfigurationUpdate")}>
                          {configurationQuery.data
                            ? formats.dateTime(configurationQuery.data.updated_at)
                            : "—"}
                        </DefinitionRow>
                      </DefinitionList>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <SectionHeading as="h2">{translate("categoriesHeading")}</SectionHeading>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <DataTable
                        caption={translate("metricsCaption")}
                        columns={columns}
                        getRowId={(row) => row.category}
                        rows={metricRows}
                      />
                      <BarChart
                        data={f1Data}
                        fractionDigits={1}
                        summary={translate("f1ChartSummary", {
                          macro: formats.percent(entry.macro_f1),
                        })}
                        title={translate("f1ChartTitle")}
                        unit="%"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <SectionHeading as="h2">{translate("limitationsHeading")}</SectionHeading>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-inside list-disc space-y-1 text-xs leading-5">
                        {entry.known_limitations.map((limitation) => (
                          <li key={limitation}>{limitation}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {entry.metadata_conflicts.length > 0 ? (
                    <Alert title={translate("conflictTitle")} tone="warning">
                      <ul className="list-inside list-disc space-y-1">
                        {entry.metadata_conflicts.map((conflict) => (
                          <li key={conflict}>{conflict}</li>
                        ))}
                      </ul>
                    </Alert>
                  ) : null}
                </div>
              );
            })}

            <Alert title={translate("registryTitle")} tone="info">
              {translate("registryNotice", {
                count: formats.number(entries.length, 0),
              })}
            </Alert>
          </>
        )}
      </AsyncPanel>
    </div>
  );
}
