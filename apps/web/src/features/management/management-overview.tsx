"use client";

import { EwasteCategorySchema, RecoveryRecordStateSchema } from "@scraptrace/contracts";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricCard, PageHeading, SectionHeading } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { BarChart, type BarDatum } from "@/features/shared/bar-chart";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { useProgrammeSettings } from "@/hooks/use-programme";
import { toKilograms } from "@/services/domain/flags";
import {
  countByCategory,
  countByState,
  dailyTrend,
  participatingLocationIds,
  verifiedRecoveredMaterialKilograms,
  verifiedWeightKilograms,
} from "@/services/domain/records";
import { findLocationName } from "@/services/local/location-directory";

/**
 * Programme dashboard (FR-DSH-003 to FR-DSH-005, BR-010).
 *
 * Every figure is derived from the shared records. Verified recovery counts only records in
 * `approved_and_completed`; a separate panel shows everything still moving through the journey, so
 * an in-progress record is never presented as verified recycling. Charts carry text values, an
 * accessible summary, the unit and an empty state.
 */
export function ManagementOverview() {
  const translate = useTranslations("screens.manager");
  const translatePages = useTranslations("pages");
  const translateStatus = useTranslations("status");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOperationalRecords();
  const settingsQuery = useProgrammeSettings();

  return (
    <div className="space-y-5">
      <PageHeading
        {...(settingsQuery.data ? { description: settingsQuery.data.programme_name } : {})}
      >
        {translatePages("managementTitle")}
      </PageHeading>

      <AsyncPanel query={query}>
        {(records) => {
          const counts = countByState(records);
          const verifiedWeight = verifiedWeightKilograms(records);
          const recoveredWeight = verifiedRecoveredMaterialKilograms(records);
          const categories = countByCategory(records);
          const facilities = participatingLocationIds(records);
          const flagged = records.filter((record) => record.review.flag_codes.length > 0);
          const trend = dailyTrend(records);

          const stateData: readonly BarDatum[] = RecoveryRecordStateSchema.options
            .map((state) => ({
              key: state,
              label: translateStatus(state),
              value: counts[state],
              tone:
                state === "approved_and_completed"
                  ? ("primary" as const)
                  : state === "rejected"
                    ? ("danger" as const)
                    : state === "under_review"
                      ? ("warning" as const)
                      : ("info" as const),
            }))
            .filter((datum) => datum.value > 0);

          const categoryData: readonly BarDatum[] = EwasteCategorySchema.options
            .map((category) => ({
              key: category,
              label: labels.category(category),
              value: categories.get(category) ?? 0,
            }))
            .filter((datum) => datum.value > 0);

          const weightByCategory: readonly BarDatum[] = EwasteCategorySchema.options
            .map((category) => ({
              key: category,
              label: labels.category(category),
              value: records
                .filter(
                  (record) =>
                    record.category === category &&
                    record.business_state === "approved_and_completed",
                )
                .reduce(
                  (total, record) =>
                    record.handoff ? total + toKilograms(record.handoff.measured_weight) : total,
                  0,
                ),
            }))
            .filter((datum) => datum.value > 0);

          const trendData: readonly BarDatum[] = trend.map((point) => ({
            key: point.calendarDate,
            label: formats.date(`${point.calendarDate}T00:00:00.000Z`) ?? point.calendarDate,
            value: point.submitted,
          }));

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={translate("totalRecords")}
                  value={formats.number(records.length, 0)}
                />
                <MetricCard
                  label={translate("verifiedRecords")}
                  tone="success"
                  value={formats.number(counts.approved_and_completed, 0)}
                />
                <MetricCard
                  label={translate("verifiedWeight")}
                  tone="success"
                  value={formats.kilograms(verifiedWeight)}
                />
                <MetricCard
                  label={translate("underReview")}
                  tone="warning"
                  value={formats.number(counts.under_review, 0)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={translate("submitted")}
                  value={formats.number(counts.submitted + counts.awaiting_handoff, 0)}
                />
                <MetricCard
                  label={translate("received")}
                  value={formats.number(counts.received, 0)}
                />
                <MetricCard
                  label={translate("processingRecorded")}
                  value={formats.number(counts.processing_recorded + counts.completed, 0)}
                />
                <MetricCard
                  label={translate("rejected")}
                  tone="danger"
                  value={formats.number(counts.rejected, 0)}
                />
              </div>

              <Card>
                <CardHeader>
                  <h2 className="text-primary flex items-center gap-2 text-lg font-bold">
                    <BadgeCheck aria-hidden="true" className="size-5" />
                    {translate("verifiedTitle")}
                  </h2>
                  <p className="text-muted-foreground text-xs leading-5">
                    {translate("verifiedText")}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label={translate("verifiedMeasuredWeight")}
                    tone="success"
                    value={formats.kilograms(verifiedWeight)}
                  />
                  <MetricCard
                    label={translate("verifiedRecoveredMaterial")}
                    tone="success"
                    value={formats.kilograms(recoveredWeight)}
                  />
                  <MetricCard
                    label={translate("participatingFacilities")}
                    value={formats.number(facilities.length, 0)}
                  />
                </CardContent>
              </Card>

              {flagged.length > 0 ? (
                <Alert title={translate("discrepancyTitle")} tone="warning">
                  {translate("discrepancyNotice", {
                    count: formats.number(flagged.length, 0),
                  })}
                </Alert>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardContent className="pt-4">
                    <BarChart
                      data={stateData}
                      summary={translate("stateChartSummary", {
                        total: formats.number(records.length, 0),
                      })}
                      title={translate("stateChartTitle")}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <BarChart
                      data={categoryData}
                      summary={translate("categoryChartSummary", {
                        count: formats.number(categoryData.length, 0),
                      })}
                      title={translate("categoryChartTitle")}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <BarChart
                      data={weightByCategory}
                      fractionDigits={2}
                      summary={translate("weightChartSummary", {
                        total: formats.kilograms(verifiedWeight),
                      })}
                      title={translate("weightChartTitle")}
                      unit="kg"
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <BarChart
                      data={trendData}
                      summary={translate("trendChartSummary", {
                        days: formats.number(trendData.length, 0),
                      })}
                      title={translate("trendChartTitle")}
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <SectionHeading as="h2">{translate("facilitiesTitle")}</SectionHeading>
                </CardHeader>
                <CardContent>
                  {facilities.length === 0 ? (
                    <p className="text-muted-foreground text-xs">{translate("noFacilities")}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {facilities.map((id) => (
                        <li className="flex justify-between gap-3" key={id}>
                          <span>{findLocationName(id) ?? id}</span>
                          <span className="text-muted-foreground text-xs">
                            {formats.number(
                              records.filter(
                                (record) => record.handoff?.receiving_location_id === id,
                              ).length,
                              0,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <p className="text-muted-foreground text-xs leading-5">
                {translate("definitionsNotice")}
              </p>
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
