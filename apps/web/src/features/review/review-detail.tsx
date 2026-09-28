"use client";

import {
  MANUAL_REVIEW_REASON,
  ReviewReasonCodeSchema,
  type EvidenceMetadata,
  type RecoveryRecord,
  type RecoveryRecordEvent,
  type ReviewCaseDetail,
  type ReviewReasonCode,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DefinitionList,
  DefinitionRow,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidencePanel } from "@/features/shared/evidence-panel";
import { FlagPanel } from "@/features/shared/flag-panel";
import { useValueFormats } from "@/features/shared/formats";
import { RecordIdentity } from "@/features/shared/record-identity";
import { RecordTimeline } from "@/features/shared/record-timeline";
import { useLocationNames } from "@/hooks/use-reference";
import {
  useEvidenceImages,
  useRecord,
  useRecordEvents,
  useRecordEvidence,
  useReviewCase,
  useSubmitReviewDecision,
} from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { REASON_CODES_BY_DECISION, toKilograms } from "@/services/domain/flags";
import { isTerminal } from "@/services/domain/records";

type Decision = "approve" | "reject" | "request_correction";

/**
 * Review detail and decision (FR-REV-004, FR-REV-005, FR-REV-007).
 *
 * The reviewer sees everything a decision needs in one view: why the record entered review, the
 * collector's submission, the vision result and any correction, the handoff evidence, the weight
 * difference, the processing detail and the full history. A decision needs its reason code and a
 * note; a correction request also needs the correction described. Once a terminal decision exists,
 * the view is read-only.
 *
 * The view is the API's atomic case-detail resource. A record without a review case is shown
 * read-only from the record resources, with no decision form.
 */
export function ReviewDetail({ recordId }: { recordId: string }) {
  const caseQuery = useReviewCase(recordId);
  return (
    <div className="max-w-3xl space-y-4">
      <AsyncPanel query={caseQuery}>
        {(detail) =>
          detail ? (
            <CaseView detail={detail} recordId={recordId} />
          ) : (
            <RecordWithoutCase recordId={recordId} />
          )
        }
      </AsyncPanel>
    </div>
  );
}

function CaseView({ detail, recordId }: { detail: ReviewCaseDetail; recordId: string }) {
  const images = useEvidenceImages(detail.evidence);
  return (
    <ReviewBody
      evidence={detail.evidence}
      images={images.data ?? {}}
      recordId={recordId}
      reviewCase={detail}
      record={detail.record}
      timeline={detail.timeline}
    />
  );
}

function RecordWithoutCase({ recordId }: { recordId: string }) {
  const recordQuery = useRecord(recordId);
  const eventsQuery = useRecordEvents(recordId);
  const evidenceQuery = useRecordEvidence(recordId);
  return (
    <AsyncPanel isEmpty={(record) => record === null} query={recordQuery}>
      {(record) =>
        record ? (
          <ReviewBody
            evidence={evidenceQuery.data?.evidence ?? []}
            images={evidenceQuery.data?.images ?? {}}
            recordId={recordId}
            reviewCase={null}
            record={record}
            timeline={eventsQuery.data ?? []}
          />
        ) : null
      }
    </AsyncPanel>
  );
}

function ReviewBody({
  recordId,
  record,
  evidence,
  images,
  timeline,
  reviewCase,
}: {
  recordId: string;
  record: RecoveryRecord;
  evidence: readonly EvidenceMetadata[];
  images: Record<string, string | null>;
  timeline: readonly RecoveryRecordEvent[];
  reviewCase: ReviewCaseDetail | null;
}) {
  const translate = useTranslations("screens.reviewDetail");
  const translateRecord = useTranslations("record");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();

  const decide = useSubmitReviewDecision();
  const locationName = useLocationNames();

  const [decision, setDecision] = useState<Decision>("approve");
  const [reasonCode, setReasonCode] = useState<ReviewReasonCode>(
    REASON_CODES_BY_DECISION.approve[0],
  );
  const [note, setNote] = useState("");
  const [correction, setCorrection] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const onDecisionChange = (next: Decision) => {
    setDecision(next);
    setReasonCode(REASON_CODES_BY_DECISION[next][0]);
  };

  const submit = () => {
    setFormError(undefined);
    const next: Record<string, string> = {};
    if (note.trim().length === 0) next["note"] = translate("noteRequired");
    if (decision === "request_correction" && correction.trim().length === 0) {
      next["correction"] = translate("correctionRequired");
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(translate("fixErrors"));
      return;
    }
    if (!reviewCase) return;
    const considered = evidence
      .filter((item) => item.evidence_type !== "reviewer_decision")
      .map((item) => item.evidence_id);
    decide.mutate(
      {
        recordId,
        decision,
        reasonCode,
        reviewerNote: note.trim(),
        ...(decision === "request_correction" ? { requestedCorrection: correction.trim() } : {}),
        reviewReasonCodes:
          reviewCase.case.flag_codes.length > 0
            ? reviewCase.case.flag_codes
            : [MANUAL_REVIEW_REASON],
        evidenceConsidered: considered,
        // The states the reviewer read; the API refuses a decision on a case that moved on.
        previousReviewState: reviewCase.case.status,
        previousRecordState: reviewCase.case.record_business_state,
      },
      {
        onSuccess: (response) => {
          show({
            title: translate(`decided.${response.resulting_record_state}`),
            tone: response.resulting_record_state === "rejected" ? "warning" : "success",
          });
          setNote("");
          setCorrection("");
        },
        onError: (error) => setFormError(safeMessage(error)),
      },
    );
  };

  const weightRow = (record: RecoveryRecord) => {
    if (!record.approximate_weight || !record.handoff) return null;
    const declared = toKilograms(record.approximate_weight);
    const measured = toKilograms(record.handoff.measured_weight);
    const ratio = declared > 0 ? (measured - declared) / declared : 0;
    return (
      <DefinitionRow
        term={translate("weightDifference")}
        tone={Math.abs(ratio) > 0.15 ? "warning" : "neutral"}
      >
        {formats.percent(ratio)}
      </DefinitionRow>
    );
  };

  const decided = isTerminal(record);
  const canDecide = reviewCase?.case.decision_eligible === true;
  const recovered = (record.processing?.material_entries ?? []).reduce(
    (total, entry) => total + toKilograms(entry.weight),
    0,
  );
  return (
    <>
      <PageHeading eyebrow={record.human_reference}>{labels.category(record.category)}</PageHeading>

      <FlagPanel flagCodes={record.review.flag_codes} />

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("whyHeading")}</SectionHeading>
        </CardHeader>
        <CardContent>
          <DefinitionList>
            <DefinitionRow term={translate("reviewState")}>
              {labels.reviewState(record.review.review_state)}
            </DefinitionRow>
            <DefinitionRow term={translate("recordState")}>
              {labels.recordKind(record.record_kind)} · {labels.handoffState(record.handoff_state)}{" "}
              · {labels.processingState(record.processing_state)}
            </DefinitionRow>
            {record.review.decision ? (
              <DefinitionRow term={translate("previousDecision")}>
                {labels.decision(record.review.decision)} ·{" "}
                {labels.reason(record.review.reason_code ?? "")}
              </DefinitionRow>
            ) : null}
            {record.review.reviewer_note ? (
              <DefinitionRow term={translate("previousNote")}>
                {record.review.reviewer_note}
              </DefinitionRow>
            ) : null}
            {record.review.requested_correction ? (
              <DefinitionRow term={translate("requestedCorrection")} tone="warning">
                {record.review.requested_correction}
              </DefinitionRow>
            ) : null}
            {record.review.decided_at ? (
              <DefinitionRow term={translate("decidedAt")}>
                {formats.dateTime(record.review.decided_at)}
              </DefinitionRow>
            ) : null}
          </DefinitionList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("recordHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          <RecordIdentity record={record} />
          <DefinitionList>
            {record.vision_result ? (
              <>
                <DefinitionRow term={translate("suggestedCategory")}>
                  {labels.category(record.vision_result.suggested_category)} ·{" "}
                  {formats.percent(record.vision_result.confidence)}
                </DefinitionRow>
                <DefinitionRow term={translate("modelVersion")}>
                  {record.vision_result.model_name} {record.vision_result.model_version}
                </DefinitionRow>
              </>
            ) : (
              <DefinitionRow term={translate("suggestedCategory")}>
                {translate("noPrediction")}
              </DefinitionRow>
            )}
            <DefinitionRow term={translate("confirmedCategory")}>
              {labels.category(record.category_confirmation.confirmed_category)} ·{" "}
              {labels.confirmation(record.category_confirmation.source)}
            </DefinitionRow>
            {record.category_confirmation.correction_reason ? (
              <DefinitionRow term={translate("correctionReason")} tone="warning">
                {record.category_confirmation.correction_reason}
              </DefinitionRow>
            ) : null}
            {record.handoff ? (
              <>
                <DefinitionRow term={translate("receivingLocation")}>
                  {locationName(record.handoff.receiving_location_id) ??
                    translate("unknownLocation")}
                </DefinitionRow>
                <DefinitionRow term={translate("recyclerActor")}>
                  <span className="font-mono text-xs">{record.handoff.recycler.actor_id}</span>
                </DefinitionRow>
                <DefinitionRow term={translate("declaredWeight")}>
                  {formats.weight(record.approximate_weight) ?? translate("notDeclared")}
                </DefinitionRow>
                <DefinitionRow term={translate("measuredWeight")}>
                  {formats.weight(record.handoff.measured_weight)}
                </DefinitionRow>
                {weightRow(record)}
                <DefinitionRow term={translate("handoffConfirmedCategory")}>
                  {labels.category(record.handoff.confirmed_category)}
                </DefinitionRow>
              </>
            ) : null}
            {record.processing ? (
              <>
                <DefinitionRow term={translate("processingMethod")}>
                  {labels.method(record.processing.method)}
                </DefinitionRow>
                <DefinitionRow term={translate("processingResult")}>
                  {record.processing.result}
                </DefinitionRow>
                <DefinitionRow term={translate("recoveredTotal")}>
                  {formats.kilograms(recovered)}
                </DefinitionRow>
              </>
            ) : null}
            <DefinitionRow term={translate("integrityDigest")}>
              <span className="font-mono text-[0.625rem] break-all">
                {record.integrity_digest ?? translate("noDigest")}
              </span>
            </DefinitionRow>
          </DefinitionList>
          {record.processing && record.processing.material_entries.length > 0 ? (
            <ul className="border-t pt-2">
              {record.processing.material_entries.map((entry) => (
                <li
                  className="flex justify-between gap-3 py-1 text-xs"
                  key={`${entry.material}-${entry.weight.value}`}
                >
                  <span>{entry.material}</span>
                  <span className="font-semibold">{formats.weight(entry.weight)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Alert title={translate("integrityNoticeTitle")} tone="info">
            {translate("integrityNotice")}
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("evidenceHeading")}</SectionHeading>
        </CardHeader>
        <CardContent>
          <EvidencePanel evidence={evidence} images={images} showCoordinates />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translateRecord("timeline")}</SectionHeading>
        </CardHeader>
        <CardContent>
          <RecordTimeline events={timeline} />
        </CardContent>
      </Card>

      {reviewCase && reviewCase.decisions.length > 0 ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("decisionsHeading")}</SectionHeading>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {reviewCase.decisions.map((entry) => (
                <li className="bg-surface rounded-md border px-4 py-2" key={entry.decision_id}>
                  <DefinitionList>
                    <DefinitionRow term={translate("previousDecision")}>
                      {labels.decision(entry.decision)} · {labels.reason(entry.reason_code)}
                    </DefinitionRow>
                    <DefinitionRow term={translate("previousNote")}>
                      {entry.reviewer_note}
                    </DefinitionRow>
                    {entry.requested_correction ? (
                      <DefinitionRow term={translate("requestedCorrection")} tone="warning">
                        {entry.requested_correction}
                      </DefinitionRow>
                    ) : null}
                    <DefinitionRow term={translate("decidedAt")}>
                      {formats.dateTime(entry.decision_timestamp)}
                    </DefinitionRow>
                  </DefinitionList>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {decided ? (
        <Alert title={translate("readOnlyTitle")} tone="info">
          {translate("readOnlyNotice")}
        </Alert>
      ) : canDecide ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("decisionHeading")}</SectionHeading>
            <p className="text-muted-foreground text-xs leading-5">{translate("decisionIntro")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-foreground text-xs font-semibold">
                {translate("decisionLabel")}
              </legend>
              {(["approve", "request_correction", "reject"] as const).map((value) => (
                <label
                  className="min-h-touch bg-surface has-[:focus-visible]:outline-focus flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:focus-visible]:outline-[length:var(--focus-ring-width)]"
                  key={value}
                >
                  <input
                    checked={decision === value}
                    className="mt-1"
                    name="decision"
                    onChange={() => onDecisionChange(value)}
                    type="radio"
                    value={value}
                  />
                  <span>
                    <span className="block text-sm font-bold">{labels.decision(value)}</span>
                    <span className="text-muted-foreground block text-xs">
                      {translate(`decisionHint.${value}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <Field label={translate("reasonLabel")} required>
              {(control) => (
                <Select
                  onChange={(event) =>
                    setReasonCode(ReviewReasonCodeSchema.parse(event.target.value))
                  }
                  value={reasonCode}
                  {...control}
                >
                  {REASON_CODES_BY_DECISION[decision].map((code) => (
                    <option key={code} value={code}>
                      {labels.reason(code)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              error={errors["note"]}
              hint={translate("noteHint")}
              label={translate("noteLabel")}
              required
            >
              {(control) => (
                <Input
                  maxLength={1000}
                  onChange={(event) => setNote(event.target.value)}
                  value={note}
                  {...control}
                />
              )}
            </Field>

            {decision === "request_correction" ? (
              <Field
                error={errors["correction"]}
                hint={translate("correctionHint")}
                label={translate("correctionLabel")}
                required
              >
                {(control) => (
                  <Input
                    maxLength={1000}
                    onChange={(event) => setCorrection(event.target.value)}
                    value={correction}
                    {...control}
                  />
                )}
              </Field>
            ) : null}

            {formError ? <FormError title={formError} /> : null}

            <ConfirmAction
              block
              confirmLabel={translate("submitDecision")}
              description={translate("confirmDescription", {
                decision: labels.decision(decision),
                reference: record.human_reference,
              })}
              destructive={decision === "reject"}
              disabled={decide.isPending}
              label={translate("submitDecision")}
              loading={decide.isPending}
              onConfirm={submit}
              size="large"
              title={translate("confirmTitle")}
              variant={decision === "reject" ? "destructive" : "primary"}
            />
          </CardContent>
        </Card>
      ) : (
        <Alert title={translate("notReviewableTitle")} tone="info">
          {translate("notReviewableNotice")}
        </Alert>
      )}

      <Link className={buttonVariants({ variant: "secondary" })} href="/review/queue">
        {translate("backToQueue")}
      </Link>
    </>
  );
}
