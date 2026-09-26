"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/choice-controls";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { DefinitionList, DefinitionRow, MetricCard, PageHeading } from "@/components/ui/content";
import { EvidencePlaceholder } from "@/components/ui/evidence-placeholder";
import { Field } from "@/components/ui/field";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { Select } from "@/components/ui/select";
import { useNumber } from "@/i18n/use-number";

const CATEGORIES = ["pcbHigh", "pcbLow", "batteries", "glass"] as const;

/**
 * Figma: DataMlReviewerShell. A committed correction is a reviewed candidate only; it never
 * retrains a model automatically (SRS, model-governance documents).
 */
export function ModelReview() {
  const translate = useTranslations("screens.ml");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("mlTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label={translate("accuracy")}
          tone="success"
          value={translate("accuracyValue", {
            value: number(94.2),
          })}
        />
        <MetricCard
          label={translate("tickets")}
          tone="warning"
          value={translate("ticketsValue", { count: number(12) })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader>
            <h2 className="text-primary-dark text-sm font-bold">{translate("imageTitle")}</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <EvidencePlaceholder label={translate("imagePlaceholder")} />
            <DefinitionList className="text-xs">
              <DefinitionRow term={translate("predicted")}>
                {translate("predictedValue")}
              </DefinitionRow>
              <DefinitionRow term={translate("confidence")} tone="success">
                {translate("confidenceValue", {
                  value: number(98.4),
                })}
              </DefinitionRow>
            </DefinitionList>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <h2 className="text-primary-dark text-sm font-bold">{translate("correctTitle")}</h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate>
              <Field label={translate("categoryLabel")}>
                {(control) => (
                  <Select defaultValue="pcbHigh" {...control}>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {translate(`categories.${category}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Checkbox label={translate("verifyGps")} />
              <DeferredActionButton block size="large">
                {translate("commit")}
              </DeferredActionButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
