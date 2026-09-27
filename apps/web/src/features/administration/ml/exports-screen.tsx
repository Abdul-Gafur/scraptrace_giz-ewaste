"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard, PageHeading, SectionHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { usePredictionFeedback } from "@/hooks/use-administration";
import { downloadCsv } from "@/hooks/use-programme";
import { buildCsv, buildExportFilename, type CsvColumn } from "@/services/domain/csv";
import { isCorrection, type PredictionFeedback } from "@/services/domain/model-administration";
import { todayCalendarDate } from "@/services/domain/time";

/**
 * Labelled-feedback export.
 *
 * The file carries model output, the confirmed label and review metadata. It carries no collector
 * identifier and no image content, so a dataset candidate list cannot become a way to distribute
 * personal data or evidence. Headings are stable English identifiers.
 */
export function MlExportsScreen() {
  const translate = useTranslations("screens.mlExports");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const query = usePredictionFeedback();
  const [state, setState] = useState("approved_for_training_dataset");

  const columns: readonly CsvColumn<PredictionFeedback>[] = useMemo(
    () => [
      { heading: "feedback_id", value: (row) => row.feedback_id },
      { heading: "recovery_record_id", value: (row) => row.recovery_record_id },
      { heading: "evidence_id", value: (row) => row.evidence_id },
      { heading: "model_name", value: (row) => row.model_name },
      { heading: "model_version", value: (row) => row.model_version },
      { heading: "predicted_category", value: (row) => row.predicted_category },
      { heading: "confidence", value: (row) => row.confidence.toFixed(4) },
      { heading: "low_confidence", value: (row) => (row.low_confidence ? "yes" : "no") },
      { heading: "confirmed_category", value: (row) => row.confirmed_category },
      { heading: "confirmation_source", value: (row) => row.confirmation_source },
      { heading: "is_correction", value: (row) => (isCorrection(row) ? "yes" : "no") },
      { heading: "correction_reason", value: (row) => row.correction_reason ?? "" },
      { heading: "feedback_state", value: (row) => row.feedback_state },
      { heading: "reviewed_at_utc", value: (row) => row.reviewed_at ?? "" },
      { heading: "created_at_utc", value: (row) => row.created_at },
    ],
    [],
  );

  const rows = useMemo(
    () => (query.data ?? []).filter((item) => state === "all" || item.feedback_state === state),
    [query.data, state],
  );

  const onDownload = () => {
    const filename = buildExportFilename("scraptrace", "model-feedback", todayCalendarDate());
    downloadCsv(filename, buildCsv(columns, rows));
    show({
      title: translate("exported", {
        rows: formats.number(rows.length, 0),
        filename,
      }),
      tone: "success",
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <Alert title={translate("privacyTitle")} tone="info">
        {translate("privacyNotice")}
      </Alert>

      <AsyncPanel query={query} skeletonRows={2}>
        {(feedback) => (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label={translate("totalStored")}
                value={formats.number(feedback.length, 0)}
              />
              <MetricCard
                label={translate("selectedRows")}
                tone="info"
                value={formats.number(rows.length, 0)}
              />
              <MetricCard label={translate("columns")} value={formats.number(columns.length, 0)} />
            </div>

            <FilterControl
              label={translate("filterState")}
              onChange={(event) => setState(event.target.value)}
              options={[
                { value: "all", label: translate("allStates") },
                ...[
                  "stored_for_review",
                  "approved_for_training_dataset",
                  "rejected_for_training",
                ].map((value) => ({ value, label: labels.feedbackState(value) })),
              ]}
              value={state}
            />

            <Card>
              <CardHeader>
                <SectionHeading as="h2">{translate("columnsHeading")}</SectionHeading>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-muted-foreground grid gap-1 font-mono text-xs sm:grid-cols-2">
                  {columns.map((column) => (
                    <li key={column.heading}>{column.heading}</li>
                  ))}
                </ul>
                <Button block disabled={rows.length === 0} onClick={onDownload} size="large">
                  <Download aria-hidden="true" className="size-5" />
                  {translate("download")}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </AsyncPanel>
    </div>
  );
}
