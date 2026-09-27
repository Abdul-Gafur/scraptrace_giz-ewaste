"use client";

import {
  EwasteCategorySchema,
  type EwasteCategory,
  type VisionAppraisalResponseSchema,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import type { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";

type Appraisal = z.infer<typeof VisionAppraisalResponseSchema>;

/**
 * Category suggestion and confirmation (FR-VIS-004 to FR-VIS-007).
 *
 * The suggestion is presented as a suggestion: the score is shown in plain language, all seven
 * categories remain selectable, and the record cannot continue until a category is confirmed. A
 * low-confidence or failed prediction hides no option — it simply offers the full list and a
 * retake. Choosing a different category asks for a reason, which is stored alongside the original
 * prediction rather than replacing it.
 */
export function PredictionPanel({
  appraisal,
  selectedCategory,
  onSelectCategory,
  correctionReason,
  onCorrectionReasonChange,
  confidenceThreshold,
}: {
  appraisal: Appraisal;
  selectedCategory: EwasteCategory | "";
  onSelectCategory: (category: EwasteCategory | "") => void;
  correctionReason: string;
  onCorrectionReasonChange: (reason: string) => void;
  confidenceThreshold: number;
}) {
  const translate = useTranslations("screens.capture");
  const labels = useContractLabels();
  const formats = useValueFormats();

  const classified = appraisal.outcome === "classified";
  const suggested = classified ? appraisal.category : undefined;
  const isCorrection =
    Boolean(suggested) && selectedCategory !== "" && selectedCategory !== suggested;

  const confidenceBand = (score: number): "high" | "medium" | "low" => {
    if (score >= 0.75) return "high";
    return score >= confidenceThreshold ? "medium" : "low";
  };

  return (
    <div className="space-y-4">
      {classified ? (
        <div className="bg-surface space-y-2 rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{translate("suggestionHeading")}</p>
            <Badge>{appraisal.model_version}</Badge>
          </div>
          <p className="text-primary-dark text-lg font-bold">
            {labels.category(appraisal.category)}
          </p>
          <p className="text-muted-foreground text-xs leading-5">
            {translate(`confidence.${confidenceBand(appraisal.confidence)}`, {
              value: formats.percent(appraisal.confidence),
            })}
          </p>
          <p className="text-muted-foreground text-xs leading-5">{translate("suggestionNotice")}</p>
          <details>
            <summary className="text-muted-foreground min-h-touch cursor-pointer text-xs">
              {translate("allScores")}
            </summary>
            <ul className="mt-2 space-y-1">
              {[...appraisal.scores]
                .sort((first, second) => second.score - first.score)
                .map((score) => (
                  <li className="flex justify-between gap-3 text-xs" key={score.category}>
                    <span>{labels.category(score.category)}</span>
                    <span className="font-semibold">{formats.percent(score.score)}</span>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      ) : (
        <Alert
          title={translate(
            appraisal.reason === "low_confidence"
              ? "lowConfidenceTitle"
              : "unavailableSuggestionTitle",
          )}
          tone="warning"
        >
          {translate(
            appraisal.reason === "low_confidence" ? "lowConfidence" : "unavailableSuggestion",
          )}
        </Alert>
      )}

      <Field hint={translate("categoryHint")} label={translate("categoryLabel")} required>
        {(control) => (
          <Select
            onChange={(event) => onSelectCategory(event.target.value as EwasteCategory | "")}
            value={selectedCategory}
            {...control}
          >
            <option value="">{translate("categoryPlaceholder")}</option>
            {EwasteCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {labels.category(category)}
                {category === suggested ? ` — ${translate("suggestedSuffix")}` : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {isCorrection ? (
        <Field
          hint={translate("correctionHint")}
          label={translate("correctionReasonLabel")}
          required
        >
          {(control) => (
            <Input
              onChange={(event) => onCorrectionReasonChange(event.target.value)}
              value={correctionReason}
              {...control}
            />
          )}
        </Field>
      ) : null}
    </div>
  );
}
