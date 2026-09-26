"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import { PageHeading, SectionLabel } from "@/components/ui/content";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const CATEGORY_KEYS = ["batteries", "screens", "boards", "appliances"] as const;
const REPORTS = ["recoverySummary", "verifiedOutcomes", "handoff"] as const;

/**
 * No Figma frame. `ReportingFiltersSchema` defines the range, category and area a report may
 * be scoped by; `ReportingSummarySchema` keeps verified weight tied to approved_and_completed
 * only. Generating a report needs the reporting service, so the action is deferred.
 */
export function SystemReports() {
  const translate = useTranslations("screens.reports");
  const translatePages = useTranslations("pages");
  const translateCategories = useTranslations("samples.categories");
  const [category, setCategory] = useState("all");

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("reportsTitle")}</PageHeading>

      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3 sm:pt-5">
          <Field label={translate("rangeFrom")}>
            {(control) => <Input defaultValue="2026-07-01" type="date" {...control} />}
          </Field>
          <Field label={translate("rangeTo")}>
            {(control) => <Input defaultValue="2026-09-30" type="date" {...control} />}
          </Field>
          <Field label={translate("filterCategory")}>
            {(control) => (
              <Select
                onChange={(event) => setCategory(event.target.value)}
                value={category}
                {...control}
              >
                <option value="all">{translate("categoryAll")}</option>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {translateCategories(key)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardContent>
      </Card>

      <section aria-labelledby="reports-heading" className="space-y-2">
        <SectionLabel>
          <span id="reports-heading">{translate("heading")}</span>
        </SectionLabel>
        <ul className="grid gap-3 lg:grid-cols-3">
          {REPORTS.map((report) => (
            <li key={report}>
              <Card className="flex h-full flex-col">
                <CardHeader className="flex-1">
                  <h3 className="text-primary-dark text-sm font-bold">
                    {translate(`${report}Title`)}
                  </h3>
                  <p className="text-muted-foreground text-xs leading-5">
                    {translate(`${report}Text`)}
                  </p>
                </CardHeader>
                <CardContent>
                  <DeferredActionButton
                    aria-label={translate("generateReport", {
                      name: translate(`${report}Title`),
                    })}
                    block
                    variant="secondary"
                  >
                    {translate("generate")}
                  </DeferredActionButton>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <InfoPanel as="h2" title={translate("separationTitle")} tone="info">
        {translate("separationText")}
      </InfoPanel>
    </div>
  );
}
