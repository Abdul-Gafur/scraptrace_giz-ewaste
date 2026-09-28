"use client";

import type { HandoffPreview } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DefinitionList,
  DefinitionRow,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { useToast } from "@/components/ui/toast";
import { useSafeErrorMessage } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { FlagPanel } from "@/features/shared/flag-panel";
import { useValueFormats } from "@/features/shared/formats";
import { QrScanner } from "@/features/shared/qr-scanner";
import { useConfirmHandoff, useLookupForHandoff, useRecord } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import type { HandoffLookupResult, RecordHandoffInput } from "@/services/ports/service-ports";

import { HandoffForm } from "./intake/handoff-form";
import type { HandoffResponse } from "./intake/types";

/**
 * Recycler intake (FR-HND-001).
 *
 * A scan, a decoded image or a typed manual transfer code all reach the same lookup. Every
 * outcome the lookup can return has its own state: not found, not yet published for handoff,
 * already received, belonging to another facility, or an unsupported contract version. A record
 * already received shows its first receipt instead of offering to record a second one. The
 * lookup returns a minimised preview and never a credential; the handoff carries the credential
 * the recycler presented (ADR-009).
 */
export function IntakeScreen() {
  const translate = useTranslations("screens.recyclerIntake");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();

  const lookup = useLookupForHandoff();
  const confirm = useConfirmHandoff();
  const [result, setResult] = useState<HandoffLookupResult | null>(null);
  const [response, setResponse] = useState<HandoffResponse | null>(null);
  const [lookupError, setLookupError] = useState<string | undefined>();

  const onScanned = (value: string) => {
    setLookupError(undefined);
    setResponse(null);
    lookup.mutate(value, {
      onSuccess: setResult,
      onError: (error) => {
        setResult(null);
        setLookupError(safeMessage(error));
      },
    });
  };

  const onConfirm = (input: RecordHandoffInput) => {
    confirm.mutate(input, {
      onSuccess: (outcome) => {
        setResponse(outcome);
        if (outcome.outcome === "accepted") {
          show({ title: translate("acceptedToast"), tone: "success" });
        } else if (outcome.outcome === "discrepancy") {
          show({ title: translate("discrepancyToast"), tone: "warning" });
        } else if (outcome.outcome === "duplicate_scan") {
          show({ title: translate("duplicateToast"), tone: "info" });
        } else {
          show({ title: translate("rejectedToast"), tone: "warning" });
        }
      },
      onError: (error) => show({ title: safeMessage(error), tone: "warning" }),
    });
  };

  const reset = () => {
    setResult(null);
    setResponse(null);
  };

  const recordSummary = (record: HandoffPreview) => (
    <DefinitionList>
      <DefinitionRow term={translate("reference")}>
        <span className="font-mono">{record.human_reference}</span>
      </DefinitionRow>
      <DefinitionRow term={translate("category")}>{labels.category(record.category)}</DefinitionRow>
      <DefinitionRow term={translate("state")}>
        {labels.handoffState(record.handoff_state)}
      </DefinitionRow>
    </DefinitionList>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("recyclerTitle")}</PageHeading>

      {result === null ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("scanTitle")}</SectionHeading>
            <p className="text-muted-foreground text-xs leading-5">{translate("scanText")}</p>
          </CardHeader>
          <CardContent>
            <QrScanner busy={lookup.isPending} onResult={onScanned} />
            {lookup.isPending ? (
              <p aria-live="polite" className="text-muted-foreground mt-3 text-xs">
                {translate("lookingUp")}
              </p>
            ) : null}
            {lookupError ? (
              <Alert className="mt-3" title={translate("lookupFailedTitle")} tone="warning">
                {lookupError}
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {result?.outcome === "not_found" ? (
        <Alert title={translate("notFoundTitle")} tone="warning">
          {translate("notFound")}
        </Alert>
      ) : null}

      {result?.outcome === "unsupported_contract_version" ? (
        <Alert title={translate("unsupportedVersionTitle")} tone="warning">
          {translate("unsupportedVersion")}
        </Alert>
      ) : null}

      {result?.outcome === "not_ready" ? (
        <Alert title={translate("notReadyTitle")} tone="info">
          <p>{translate("notReady")}</p>
          <div className="mt-2">{recordSummary(result.record)}</div>
        </Alert>
      ) : null}

      {result?.outcome === "other_facility" ? (
        <Alert title={translate("otherFacilityTitle")} tone="warning">
          {translate("otherFacility")}
        </Alert>
      ) : null}

      {result?.outcome === "already_received" ? (
        <AlreadyReceived
          onReset={reset}
          receivedAt={result.receivedAt}
          summary={recordSummary(result.record)}
          recordId={result.record.record_id}
        />
      ) : null}

      {result?.outcome === "ready" && response === null ? (
        <HandoffForm
          credential={result.credential}
          onSubmit={onConfirm}
          pending={confirm.isPending}
          record={result.record}
          response={response}
        />
      ) : null}

      {response?.outcome === "accepted" ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("acceptedTitle")}</SectionHeading>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert title={translate("acceptedNoticeTitle")} tone="success">
              {translate("acceptedNotice")}
            </Alert>
            <p className="text-muted-foreground text-xs">
              {translate("receivedAt", {
                when: formats.dateTime(response.received_at) ?? "",
              })}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                className={buttonVariants({ block: true })}
                href={`/recycler/records/${response.recovery_record_id}/processing`}
              >
                {translate("recordProcessing")}
              </Link>
              <button
                className={buttonVariants({ variant: "secondary", block: true })}
                onClick={reset}
                type="button"
              >
                {translate("scanAnother")}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {response?.outcome === "discrepancy" ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("discrepancyTitle")}</SectionHeading>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert title={translate("flaggedTitle")} tone="warning">
              {translate("flaggedNotice")}
            </Alert>
            <FlagPanel flagCodes={response.flag_codes} />
            <p className="text-muted-foreground text-xs leading-5">
              {translate("flaggedNextStep")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                className={buttonVariants({ block: true })}
                href={
                  result?.outcome === "ready"
                    ? `/recycler/records/${result.record.record_id}/processing`
                    : "/recycler/records"
                }
              >
                {translate("recordProcessing")}
              </Link>
              <button
                className={buttonVariants({ variant: "secondary", block: true })}
                onClick={reset}
                type="button"
              >
                {translate("scanAnother")}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {response?.outcome === "duplicate_scan" ? (
        <Alert title={translate("duplicateTitle")} tone="info">
          <p>{translate("duplicateNotice")}</p>
          <p className="mt-1">
            {translate("originalReceivedAt")}: {formats.dateTime(response.original_received_at)}
          </p>
          <p className="mt-1">
            {translate("originalOutcome")}:{" "}
            {translate(`originalOutcomes.${response.original_logical_result}`)}
          </p>
          <button
            className={buttonVariants({ variant: "secondary", block: true, className: "mt-3" })}
            onClick={reset}
            type="button"
          >
            {translate("scanAnother")}
          </button>
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * A second scan of a received record: the first receipt is shown, never overwritten. The full
 * record is read only if this recycler's facility received it; the preview is enough otherwise.
 */
function AlreadyReceived({
  recordId,
  receivedAt,
  summary,
  onReset,
}: {
  readonly recordId: string;
  readonly receivedAt: string;
  readonly summary: ReactNode;
  readonly onReset: () => void;
}) {
  const translate = useTranslations("screens.recyclerIntake");
  const formats = useValueFormats();
  const recordQuery = useRecord(recordId);
  const handoff = recordQuery.data?.handoff;
  return (
    <Card>
      <CardHeader>
        <SectionHeading as="h2">{translate("alreadyReceivedTitle")}</SectionHeading>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert title={translate("alreadyReceivedNoticeTitle")} tone="info">
          {translate("alreadyReceivedNotice")}
        </Alert>
        {summary}
        <DefinitionList>
          <DefinitionRow term={translate("originalReceivedAt")}>
            {formats.dateTime(receivedAt)}
          </DefinitionRow>
          {handoff ? (
            <DefinitionRow term={translate("originalWeight")}>
              {formats.weight(handoff.measured_weight)}
            </DefinitionRow>
          ) : null}
        </DefinitionList>
        {recordQuery.data ? <FlagPanel flagCodes={recordQuery.data.review.flag_codes} /> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className={buttonVariants({ block: true })} href={`/recycler/records/${recordId}`}>
            {translate("openRecord")}
          </Link>
          <button
            className={buttonVariants({ variant: "secondary", block: true })}
            onClick={onReset}
            type="button"
          >
            {translate("scanAnother")}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
