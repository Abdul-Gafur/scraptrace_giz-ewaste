"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/choice-controls";
import {
  DefinitionList,
  DefinitionRow,
  MetricCard,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { EvidencePlaceholder } from "@/components/ui/evidence-placeholder";
import { FilterControl } from "@/components/ui/filter-control";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidenceImage } from "@/features/shared/evidence-image";
import { useValueFormats } from "@/features/shared/formats";
import {
  useDecideFeedback,
  useModelConfiguration,
  usePredictionFeedback,
} from "@/hooks/use-administration";
import { useQuery } from "@tanstack/react-query";
import { isCorrection, type PredictionFeedback } from "@/services/domain/model-administration";
import { useServices } from "@/services/service-provider";

const STATE_CLASS: Record<string, string> = {
  stored_for_review: "bg-neutral-subtle text-muted-foreground",
  approved_for_training_dataset: "bg-success-subtle text-success-strong",
  rejected_for_training: "bg-danger-subtle text-danger",
};

/**
 * Prediction review (FR-VIS-006, FR-VIS-008, FR-VIS-009, BR-012).
 *
 * Every stored item keeps the original prediction, its confidence, the category a person
 * confirmed, the model version and the time. Approving an item marks it usable in a *future*
 * dataset release; it does not retrain, redeploy or otherwise change the active model, and the
 * screen states that.
 */
export function CorrectionQueue() {
  const translate = useTranslations("screens.mlCorrections");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const services = useServices();

  const feedbackQuery = usePredictionFeedback();
  const configurationQuery = useModelConfiguration();
  const decide = useDecideFeedback();

  const [state, setState] = useState("all");
  const [onlyCorrections, setOnlyCorrections] = useState(false);
  const [onlyLowConfidence, setOnlyLowConfidence] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const threshold = configurationQuery.data?.confidence_threshold ?? 0.4;
    return (feedbackQuery.data ?? []).filter(
      (item) =>
        (state === "all" || item.feedback_state === state) &&
        (!onlyCorrections || isCorrection(item)) &&
        (!onlyLowConfidence || item.low_confidence || item.confidence < threshold),
    );
  }, [configurationQuery.data, feedbackQuery.data, onlyCorrections, onlyLowConfidence, state]);

  const selected = rows.find((item) => item.feedback_id === selectedId) ?? rows[0] ?? null;

  const imageQuery = useQuery({
    queryKey: ["model", "feedback-image", selected?.evidence_id ?? "none"],
    enabled: Boolean(selected),
    queryFn: () => services.recoveryRecords.getEvidenceImage(selected?.evidence_id ?? ""),
  });

  const onDecide = (
    item: PredictionFeedback,
    nextState: "approved_for_training_dataset" | "rejected_for_training",
  ) => {
    decide.mutate(
      { feedbackId: item.feedback_id, state: nextState },
      {
        onSuccess: () => show({ title: translate(`decided.${nextState}`), tone: "success" }),
        onError: (error) => show({ title: safeMessage(error), tone: "warning" }),
      },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeading description={translate("description")}>{translatePages("mlTitle")}</PageHeading>

      <Alert title={translate("boundaryTitle")} tone="info">
        {translate("boundaryNotice")}
      </Alert>

      <AsyncPanel query={feedbackQuery}>
        {(feedback) => {
          const corrections = feedback.filter(isCorrection);
          const stored = feedback.filter((item) => item.feedback_state === "stored_for_review");
          const approved = feedback.filter(
            (item) => item.feedback_state === "approved_for_training_dataset",
          );

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={translate("storedCount")}
                  value={formats.number(feedback.length, 0)}
                />
                <MetricCard
                  label={translate("correctionCount")}
                  tone="warning"
                  value={formats.number(corrections.length, 0)}
                />
                <MetricCard
                  label={translate("awaitingReview")}
                  tone="info"
                  value={formats.number(stored.length, 0)}
                />
                <MetricCard
                  label={translate("approvedForDataset")}
                  tone="success"
                  value={formats.number(approved.length, 0)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
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
                <Checkbox
                  checked={onlyCorrections}
                  label={translate("onlyCorrections")}
                  onChange={(event) => setOnlyCorrections(event.target.checked)}
                />
                <Checkbox
                  checked={onlyLowConfidence}
                  label={translate("onlyLowConfidence")}
                  onChange={(event) => setOnlyLowConfidence(event.target.checked)}
                />
              </div>

              <p className="text-muted-foreground text-xs" role="status">
                {translate("resultCount", { count: formats.number(rows.length, 0) })}
              </p>

              {rows.length === 0 ? (
                <p className="bg-surface text-muted-foreground rounded-md border p-4 text-sm">
                  {translate("noResults")}
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                  <ul className="space-y-2">
                    {rows.map((item) => {
                      const active = selected?.feedback_id === item.feedback_id;
                      return (
                        <li key={item.feedback_id}>
                          <button
                            aria-current={active ? "true" : undefined}
                            className={`min-h-touch bg-surface hover:bg-surface-subtle focus-visible:outline-focus w-full rounded-md border p-3 text-start focus-visible:outline-[length:var(--focus-ring-width)] ${
                              active ? "border-primary border-2" : ""
                            }`}
                            onClick={() => setSelectedId(item.feedback_id)}
                            type="button"
                          >
                            <span className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-bold">
                                {labels.category(item.predicted_category)}
                              </span>
                              <Badge className={STATE_CLASS[item.feedback_state] ?? ""}>
                                {labels.feedbackState(item.feedback_state)}
                              </Badge>
                            </span>
                            <span className="text-muted-foreground mt-1 block text-xs">
                              {formats.percent(item.confidence)} ·{" "}
                              {formats.dateTime(item.created_at)}
                            </span>
                            {isCorrection(item) ? (
                              <span className="text-warning mt-1 block text-xs font-semibold">
                                {translate("correctedTo", {
                                  category: labels.category(item.confirmed_category),
                                })}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {selected ? (
                    <Card className="self-start">
                      <CardHeader>
                        <SectionHeading as="h2">{translate("detailHeading")}</SectionHeading>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {imageQuery.data ? (
                          <EvidenceImage
                            alt={translate("imageAlternative")}
                            className="max-h-56"
                            src={imageQuery.data}
                          />
                        ) : (
                          <EvidencePlaceholder label={translate("noImage")} />
                        )}
                        <DefinitionList className="text-xs">
                          <DefinitionRow term={translate("predicted")}>
                            {labels.category(selected.predicted_category)}
                          </DefinitionRow>
                          <DefinitionRow
                            term={translate("confidence")}
                            tone={selected.low_confidence ? "warning" : "success"}
                          >
                            {formats.percent(selected.confidence)}
                          </DefinitionRow>
                          <DefinitionRow term={translate("confirmed")}>
                            {labels.category(selected.confirmed_category)}
                          </DefinitionRow>
                          <DefinitionRow term={translate("confirmationSource")}>
                            {labels.confirmation(selected.confirmation_source)}
                          </DefinitionRow>
                          {selected.correction_reason ? (
                            <DefinitionRow term={translate("correctionReason")} tone="warning">
                              {selected.correction_reason}
                            </DefinitionRow>
                          ) : null}
                          <DefinitionRow term={translate("modelVersion")}>
                            {selected.model_name} {selected.model_version}
                          </DefinitionRow>
                          <DefinitionRow term={translate("recordedAt")}>
                            {formats.dateTime(selected.created_at)}
                          </DefinitionRow>
                          <DefinitionRow term={translate("reviewState")}>
                            {labels.feedbackState(selected.feedback_state)}
                          </DefinitionRow>
                          {selected.reviewed_at ? (
                            <DefinitionRow term={translate("reviewedAt")}>
                              {formats.dateTime(selected.reviewed_at)}
                            </DefinitionRow>
                          ) : null}
                        </DefinitionList>

                        {selected.feedback_state === "stored_for_review" ? (
                          <div className="flex flex-col gap-2">
                            <ConfirmAction
                              block
                              confirmLabel={translate("approveForDataset")}
                              description={translate("approveConfirmDescription")}
                              disabled={decide.isPending}
                              label={translate("approveForDataset")}
                              loading={decide.isPending}
                              onConfirm={() => onDecide(selected, "approved_for_training_dataset")}
                              title={translate("approveConfirmTitle")}
                            />
                            <Button
                              block
                              disabled={decide.isPending}
                              onClick={() => onDecide(selected, "rejected_for_training")}
                              variant="secondary"
                            >
                              {translate("rejectForDataset")}
                            </Button>
                          </div>
                        ) : (
                          <Alert title={translate("decidedTitle")} tone="info">
                            {translate("decidedNotice")}
                          </Alert>
                        )}
                        <p className="text-muted-foreground text-xs leading-5">
                          {translate("noRetrainingNotice")}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
