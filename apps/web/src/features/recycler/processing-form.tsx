"use client";

import { ProcessingRequestSchema } from "@scraptrace/contracts";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DefinitionList,
  DefinitionRow,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidenceImage } from "@/features/shared/evidence-image";
import { FlagPanel } from "@/features/shared/flag-panel";
import { useValueFormats } from "@/features/shared/formats";
import { prepareImage, type AcceptedImage } from "@/features/shared/image-capture";
import { RecordIdentity } from "@/features/shared/record-identity";
import { useRecord, useSubmitProcessing } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";
import { isTerminal } from "@/services/domain/records";
import { nowUtc } from "@/services/domain/time";

interface MaterialRow {
  readonly id: string;
  material: string;
  value: string;
  unit: "kg" | "g";
}

const PROCESSING_METHODS = ProcessingRequestSchema.shape.processing_method.options;

const newRow = (): MaterialRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  material: "",
  value: "",
  unit: "kg",
});

/**
 * Processing record (FR-REV-001, FR-REV-002, FR-REV-007).
 *
 * Material rows can be added, edited and removed until submission. On submission the record moves
 * through the contract transitions: an unflagged record completes and becomes approved, while a
 * flagged record goes to review. A record that already holds a final decision is read-only.
 */
export function ProcessingForm({ recordId }: { recordId: string }) {
  const translate = useTranslations("screens.recyclerProcessing");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const recordQuery = useRecord(recordId);
  const submit = useSubmitProcessing();

  const [method, setMethod] = useState<(typeof PROCESSING_METHODS)[number]>("material_recovery");
  const [notes, setNotes] = useState("");
  const [processedAt, setProcessedAt] = useState(() => nowUtc().slice(0, 16));
  const [rows, setRows] = useState<readonly MaterialRow[]>([newRow()]);
  const [evidence, setEvidence] = useState<AcceptedImage | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<
    { kind: "recorded" } | { kind: "review"; flagCodes: readonly string[] } | null
  >(null);

  const totalKg = rows.reduce((total, row) => {
    const value = Number.parseFloat(row.value);
    return Number.isFinite(value) && value > 0
      ? total + toKilograms({ value, unit: row.unit })
      : total;
  }, 0);

  const updateRow = (id: string, patch: Partial<MaterialRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const pickEvidence = async (file: File) => {
    const result = await prepareImage(file);
    if (!result.ok) {
      setErrors((current) => ({
        ...current,
        evidence: translate(`imageRejected.${result.reason}`),
      }));
      return;
    }
    setErrors((current) => {
      const next = { ...current };
      delete next["evidence"];
      return next;
    });
    setEvidence(result);
  };

  const onSubmit = () => {
    setFormError(undefined);
    const next: Record<string, string> = {};
    if (notes.trim().length === 0) next["notes"] = translate("notesRequired");
    if (!evidence) next["evidence"] = translate("evidenceRequired");
    const filled = rows.filter(
      (row) => row.material.trim().length > 0 || row.value.trim().length > 0,
    );
    if (method === "material_recovery" && filled.length === 0) {
      next["materials"] = translate("materialsRequired");
    }
    if (
      filled.some((row) => {
        const value = Number.parseFloat(row.value);
        return row.material.trim().length === 0 || !Number.isFinite(value) || value <= 0;
      })
    ) {
      next["materials"] = translate("materialsInvalid");
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !evidence) {
      setFormError(translate("fixErrors"));
      return;
    }

    submit.mutate(
      {
        recordId,
        method,
        materialEntries: filled.map((row) => ({
          material: row.material.trim(),
          weight: { value: Number.parseFloat(row.value), unit: row.unit },
        })),
        processedAt: new Date(processedAt).toISOString(),
        notes: notes.trim(),
        completionEvidence: evidence.blob,
        ...(evidence.preview ? { completionEvidencePreview: evidence.preview } : {}),
        offline: false,
      },
      {
        onSuccess: (response) => {
          if (response.outcome === "processing_recorded") {
            setOutcome({ kind: "recorded" });
            show({ title: translate("recordedToast"), tone: "success" });
          } else if (response.outcome === "review_required") {
            setOutcome({ kind: "review", flagCodes: response.flag_codes });
            show({ title: translate("reviewToast"), tone: "warning" });
          } else {
            setFormError(response.message);
          }
        },
        onError: (error) => setFormError(safeMessage(error)),
      },
    );
  };

  return (
    <div className="max-w-2xl space-y-4">
      <AsyncPanel isEmpty={(record) => record === null} query={recordQuery}>
        {(record) => {
          if (!record) return null;
          const terminal = isTerminal(record);
          const alreadyProcessed = record.processing !== undefined;

          if (outcome) {
            return (
              <>
                <PageHeading eyebrow={record.human_reference}>{translate("title")}</PageHeading>
                {outcome.kind === "recorded" ? (
                  <Alert title={translate("completeTitle")} tone="success">
                    {translate("completeNotice")}
                  </Alert>
                ) : (
                  <>
                    <Alert title={translate("reviewTitle")} tone="warning">
                      {translate("reviewNotice")}
                    </Alert>
                    <FlagPanel flagCodes={outcome.flagCodes} />
                  </>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    className={buttonVariants({ block: true })}
                    href={`/recycler/records/${recordId}`}
                  >
                    {translate("openRecord")}
                  </Link>
                  <Link
                    className={buttonVariants({ variant: "secondary", block: true })}
                    href="/recycler/intake"
                  >
                    {translate("backToIntake")}
                  </Link>
                </div>
              </>
            );
          }

          return (
            <>
              <PageHeading eyebrow={record.human_reference}>{translate("title")}</PageHeading>

              <Card>
                <CardHeader>
                  <SectionHeading as="h2">{translate("recordHeading")}</SectionHeading>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RecordIdentity record={record} showSync={false} />
                  {record.handoff ? (
                    <DefinitionList>
                      <DefinitionRow term={translate("receivedWeight")} tone="success">
                        {formats.weight(record.handoff.measured_weight)}
                      </DefinitionRow>
                    </DefinitionList>
                  ) : null}
                  <FlagPanel flagCodes={record.review.flag_codes} />
                </CardContent>
              </Card>

              {terminal ? (
                <Alert title={translate("terminalTitle")} tone="info">
                  {translate("terminalNotice")}
                </Alert>
              ) : alreadyProcessed ? (
                <Alert title={translate("alreadyRecordedTitle")} tone="info">
                  {translate("alreadyRecordedNotice")}
                </Alert>
              ) : record.business_state !== "received" ? (
                <Alert title={translate("notReceivedTitle")} tone="warning">
                  {translate("notReceivedNotice")}
                </Alert>
              ) : (
                <Card>
                  <CardHeader>
                    <SectionHeading as="h2">{translate("detailsHeading")}</SectionHeading>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field hint={translate("methodHint")} label={translate("method")} required>
                      {(control) => (
                        <Select
                          onChange={(event) =>
                            setMethod(event.target.value as (typeof PROCESSING_METHODS)[number])
                          }
                          value={method}
                          {...control}
                        >
                          {PROCESSING_METHODS.map((value) => (
                            <option key={value} value={value}>
                              {labels.method(value)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>

                    <Field label={translate("processedAt")} required>
                      {(control) => (
                        <Input
                          onChange={(event) => setProcessedAt(event.target.value)}
                          type="datetime-local"
                          value={processedAt}
                          {...control}
                        />
                      )}
                    </Field>

                    <Field
                      error={errors["notes"]}
                      hint={translate("notesHint")}
                      label={translate("notes")}
                      required
                    >
                      {(control) => (
                        <Input
                          maxLength={1000}
                          onChange={(event) => setNotes(event.target.value)}
                          value={notes}
                          {...control}
                        />
                      )}
                    </Field>

                    <fieldset className="space-y-3">
                      <legend className="text-foreground text-xs font-semibold">
                        {translate("materialsLegend")}
                      </legend>
                      <p className="text-muted-foreground text-xs leading-5">
                        {translate("materialsHint")}
                      </p>
                      <ul className="space-y-3">
                        {rows.map((row, index) => (
                          <li
                            className="bg-surface-subtle grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,auto)_auto] sm:items-end"
                            key={row.id}
                          >
                            <Field label={translate("materialName", { index: index + 1 })}>
                              {(control) => (
                                <Input
                                  onChange={(event) =>
                                    updateRow(row.id, { material: event.target.value })
                                  }
                                  value={row.material}
                                  {...control}
                                />
                              )}
                            </Field>
                            <Field label={translate("materialWeight", { index: index + 1 })}>
                              {(control) => (
                                <Input
                                  inputMode="decimal"
                                  min={0}
                                  onChange={(event) =>
                                    updateRow(row.id, { value: event.target.value })
                                  }
                                  step="0.01"
                                  type="number"
                                  value={row.value}
                                  {...control}
                                />
                              )}
                            </Field>
                            <Field label={translate("materialUnit", { index: index + 1 })}>
                              {(control) => (
                                <Select
                                  onChange={(event) =>
                                    updateRow(row.id, { unit: event.target.value as "kg" | "g" })
                                  }
                                  value={row.unit}
                                  {...control}
                                >
                                  <option value="kg">kg</option>
                                  <option value="g">g</option>
                                </Select>
                              )}
                            </Field>
                            <IconButton
                              disabled={rows.length === 1}
                              icon={Trash2}
                              label={translate("removeMaterial", { index: index + 1 })}
                              onClick={() =>
                                setRows((current) =>
                                  current.filter((candidate) => candidate.id !== row.id),
                                )
                              }
                              variant="destructiveOutline"
                            />
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => setRows((current) => [...current, newRow()])}
                        variant="secondary"
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        {translate("addMaterial")}
                      </Button>
                      {errors["materials"] ? <FormError title={errors["materials"]} /> : null}
                      <p className="text-sm font-bold" role="status">
                        {translate("totalRecovered", { value: formats.kilograms(totalKg) })}
                      </p>
                      {record.handoff && totalKg > toKilograms(record.handoff.measured_weight) ? (
                        <Alert title={translate("overWeightTitle")} tone="warning">
                          {translate("overWeightNotice")}
                        </Alert>
                      ) : null}
                    </fieldset>

                    <div className="space-y-2">
                      <label className="border-primary bg-surface hover:bg-surface-subtle has-[:focus-visible]:outline-focus min-h-touch flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed p-3 text-sm font-bold has-[:focus-visible]:outline-[length:var(--focus-ring-width)]">
                        {translate(evidence ? "replaceEvidence" : "addEvidence")}
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void pickEvidence(file);
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                      {evidence?.preview ? (
                        <EvidenceImage
                          alt={translate("evidenceAlternative")}
                          className="max-h-40"
                          src={evidence.preview}
                        />
                      ) : null}
                      {errors["evidence"] ? <FormError title={errors["evidence"]} /> : null}
                    </div>

                    {formError ? <FormError title={formError} /> : null}

                    <ConfirmAction
                      block
                      confirmLabel={translate("submit")}
                      description={translate("confirmDescription", {
                        reference: record.human_reference,
                        total: formats.kilograms(totalKg),
                      })}
                      disabled={submit.isPending}
                      label={translate("submit")}
                      loading={submit.isPending}
                      onConfirm={onSubmit}
                      size="large"
                      title={translate("confirmTitle")}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
