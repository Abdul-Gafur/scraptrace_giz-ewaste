"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { RecordStatus } from "@/components/ui/record-status";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";
import { useProgrammeMutation, useRecord, useRecordEvents } from "@/services/queries";

import { EvidenceImage } from "./evidence-image";
import { TransferCode } from "./transfer-code";

/**
 * One record's whole journey: what was captured, what the classifier suggested, what the person
 * confirmed, where it went, what was measured, and every recorded decision. Nothing here is
 * editable — a record changes only through the transitions its services expose.
 */
export function RecordDetail({ recordId }: { recordId: string }) {
  const translate = useTranslations("record");
  const translateCategories = useTranslations("categories");
  const translateConditions = useTranslations("conditions");
  const translateEvents = useTranslations("screens.events");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const date = useDate();
  const { show } = useToast();
  const { data: record, isPending } = useRecord(recordId);
  const { data: events } = useRecordEvents();

  const publish = useProgrammeMutation((services, id: string) =>
    services.recoveryRecords.submit(id),
  );

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!record) return <EmptyState />;

  const recordEvents = (events ?? []).filter((entry) => entry.recovery_record_id === recordId);
  const weight = record.handoff?.measured_weight ?? record.approximate_weight;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading description={record.human_reference}>
        {translatePages("recordDetailTitle")}
      </PageHeading>

      <RecordStatus
        gps={record.capture_location ? "verified_gps" : "unverified_gps"}
        state={record.business_state}
        synchronization={record.sync.sync_state}
      />

      <EvidenceImage
        evidenceId={record.original_image_evidence_id}
        label={translate("photographLabel")}
      />

      <Card>
        <CardHeader>
          <h2 className="text-primary-dark text-sm font-bold">{translate("whatHeading")}</h2>
        </CardHeader>
        <CardContent>
          <DefinitionList className="text-sm">
            <DefinitionRow term={translate("category")}>
              {translateCategories(record.category)}
            </DefinitionRow>
            <DefinitionRow term={translate("condition")}>
              {translateConditions(record.condition)}
            </DefinitionRow>
            {weight ? (
              <DefinitionRow term={translate("weight")}>
                {translate("weightValue", { value: number(weight.value, 1), unit: weight.unit })}
              </DefinitionRow>
            ) : null}
            <DefinitionRow term={translate("capturedAt")}>
              {date(record.captured_at.slice(0, 10))}
            </DefinitionRow>
            <DefinitionRow term={translate("area")}>{record.approximate_area.label}</DefinitionRow>
            <DefinitionRow term={translate("confirmationSource")}>
              {translate(`sources.${record.category_confirmation.source}`)}
            </DefinitionRow>
          </DefinitionList>
        </CardContent>
      </Card>

      {record.estimated_price ? (
        <InfoPanel as="h2" title={translate("estimateHeading")} tone="warning">
          <p className="text-base font-extrabold">
            {translate("estimateRange", {
              minimum: number(record.estimated_price.minimum_amount, 2),
              maximum: number(record.estimated_price.maximum_amount, 2),
              currency: record.estimated_price.currency,
            })}
          </p>
          <p className="mt-1">{record.estimated_price.disclaimer}</p>
        </InfoPanel>
      ) : null}

      {record.handoff ? (
        <Card>
          <CardHeader>
            <h2 className="text-primary text-sm font-bold">{translate("handoffHeading")}</h2>
          </CardHeader>
          <CardContent>
            <DefinitionList className="text-sm">
              <DefinitionRow term={translate("measuredWeight")} tone="success">
                {translate("weightValue", {
                  value: number(record.handoff.measured_weight.value, 1),
                  unit: record.handoff.measured_weight.unit,
                })}
              </DefinitionRow>
              <DefinitionRow term={translate("finalPrice")}>
                {translate("amount", {
                  value: number(record.handoff.final_price.amount, 2),
                  currency: record.handoff.final_price.currency,
                })}
              </DefinitionRow>
              <DefinitionRow term={translate("receivedAt")}>
                {date(record.handoff.server_received_at.slice(0, 10))}
              </DefinitionRow>
            </DefinitionList>
          </CardContent>
        </Card>
      ) : null}

      {record.review.decision ? (
        <InfoPanel
          as="h2"
          title={translate("decisionHeading")}
          tone={record.review.decision === "approve" ? "success" : "danger"}
        >
          <DefinitionList className="text-xs">
            <DefinitionRow term={translate("decision")}>
              {translate(`decisions.${record.review.decision}`)}
            </DefinitionRow>
            <DefinitionRow term={translate("reasonCode")}>
              {record.review.reason_code ?? ""}
            </DefinitionRow>
          </DefinitionList>
        </InfoPanel>
      ) : null}

      {record.business_state === "draft" ? (
        <Button
          block
          loading={publish.isPending}
          onClick={async () => {
            await publish.mutateAsync(record.record_id);
            show({ title: translate("published"), tone: "success" });
          }}
          size="large"
        >
          {translate("publishAction")}
        </Button>
      ) : (
        <TransferCode record={record} />
      )}

      <section aria-labelledby="record-history" className="space-y-2">
        <SectionLabel>
          <span id="record-history">{translate("historyHeading")}</span>
        </SectionLabel>
        {recordEvents.length > 0 ? (
          <ol className="bg-surface divide-y rounded-md border">
            {recordEvents.map((entry) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                key={entry.event_id}
              >
                <span className="font-semibold">{translateEvents(entry.event_type)}</span>
                <span className="text-muted-foreground">
                  {date(entry.occurred_at.slice(0, 10))}
                </span>
                <StatusBadge status={entry.resulting_state} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-xs">{translate("noHistory")}</p>
        )}
      </section>
    </div>
  );
}
