"use client";

import {
  EwasteCategorySchema,
  ItemConditionSchema,
  type EwasteCategory,
  type HandoffPreview,
} from "@scraptrace/contracts";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, SectionHeading } from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidenceImage } from "@/features/shared/evidence-image";
import { EvidencePanel } from "@/features/shared/evidence-panel";
import { useValueFormats } from "@/features/shared/formats";
import { prepareImage, type AcceptedImage } from "@/features/shared/image-capture";
import { RecordIdentity } from "@/features/shared/record-identity";
import { useActingIdentity } from "@/hooks/use-identity";
import { useLocationNames, useProgramme, useReceivingLocations } from "@/hooks/use-reference";
import { useRecordEvidence } from "@/hooks/use-records";
import { weightDifferenceRatio } from "@/services/domain/flags";
import type { HandoffResponse } from "@/features/recycler/intake/types";
import type { PresentedCredential, RecordHandoffInput } from "@/services/ports/service-ports";

/**
 * Handoff confirmation (FR-HND-002 to FR-HND-007).
 *
 * The recycler sees the minimised preview of what the collector submitted before confirming
 * anything, confirms the category and condition independently, records a positive weight and a
 * non-negative final price, and attaches the handoff and scale photographs the transition
 * requires. The programme currency, the discrepancy threshold and the receiving locations come
 * from the API. Receipt is an explicit, confirmed action, and the button is disabled while the
 * call is in flight so a double tap cannot create a second handoff.
 */
export function HandoffForm({
  record,
  credential,
  onSubmit,
  pending,
  response,
}: {
  record: HandoffPreview;
  /** The credential presented at lookup, relayed unchanged into the handoff request. */
  credential: PresentedCredential;
  onSubmit: (input: RecordHandoffInput) => void;
  pending: boolean;
  response: HandoffResponse | null;
}) {
  const translate = useTranslations("screens.recyclerIntake");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const identity = useActingIdentity();
  const programmeQuery = useProgramme();
  const locationsQuery = useReceivingLocations();
  const locationName = useLocationNames();
  // Comparison photographs are readable only when the record is destined for this facility.
  const evidenceQuery = useRecordEvidence(record.destination ? record.record_id : undefined);

  const [category, setCategory] = useState<EwasteCategory>(record.category);
  const [condition, setCondition] = useState<z.infer<typeof ItemConditionSchema>>(record.condition);
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "g">("kg");
  const [price, setPrice] = useState("0");
  const [chosenLocationId, setLocationId] = useState<string | null>(null);
  const locations = locationsQuery.data ?? [];
  const locationId =
    chosenLocationId ??
    (locations.some((location) => location.location_id === record.destination?.location_id)
      ? (record.destination?.location_id ?? "")
      : (locations[0]?.location_id ?? ""));
  const [notes, setNotes] = useState("");
  const [handoffPhoto, setHandoffPhoto] = useState<AcceptedImage | null>(null);
  const [weightPhoto, setWeightPhoto] = useState<AcceptedImage | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const threshold = programmeQuery.data?.weight_discrepancy_threshold_percentage;
  const currency = programmeQuery.data?.currency;
  const parsedWeight = Number.parseFloat(weightValue);
  const ratio =
    Number.isFinite(parsedWeight) && parsedWeight > 0
      ? weightDifferenceRatio(record.approximate_weight, {
          value: parsedWeight,
          unit: weightUnit,
        })
      : null;
  const wouldFlag = ratio !== null && threshold !== undefined && ratio * 100 > threshold;

  const pickImage = async (
    file: File,
    set: (value: AcceptedImage | null) => void,
    field: string,
  ) => {
    const result = await prepareImage(file);
    if (!result.ok) {
      setErrors((current) => ({
        ...current,
        [field]: translate(`imageRejected.${result.reason}`),
      }));
      set(null);
      return;
    }
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    set(result);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      next["weight"] = translate("weightRequired");
    }
    const parsedPrice = Number.parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) next["price"] = translate("priceInvalid");
    if (!locationId) next["location"] = translate("locationRequired");
    if (!handoffPhoto) next["handoffPhoto"] = translate("handoffPhotoRequired");
    if (!weightPhoto) next["weightPhoto"] = translate("weightPhotoRequired");
    setErrors((current) => ({ ...current, ...next }));
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    setFormError(undefined);
    if (!validate() || !handoffPhoto || !weightPhoto) {
      setFormError(translate("fixErrors"));
      return;
    }
    if (!currency) {
      setFormError(translate("programmeUnavailable"));
      return;
    }
    onSubmit({
      recordId: record.record_id,
      collectorReference: record.collector,
      credential,
      confirmedCategory: category,
      confirmedCondition: condition,
      measuredWeight: { value: parsedWeight, unit: weightUnit },
      finalPriceAmount: Number.parseFloat(price),
      finalPriceCurrency: currency,
      receivingLocationId: locationId,
      evidence: {
        handoffPhoto: handoffPhoto.blob,
        ...(handoffPhoto.preview ? { handoffPhotoPreview: handoffPhoto.preview } : {}),
        weightPhoto: weightPhoto.blob,
        ...(weightPhoto.preview ? { weightPhotoPreview: weightPhoto.preview } : {}),
      },
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      offline: typeof navigator !== "undefined" && !navigator.onLine,
    });
  };

  const imageField = (
    field: "handoffPhoto" | "weightPhoto",
    value: AcceptedImage | null,
    set: (next: AcceptedImage | null) => void,
  ) => (
    <div className="space-y-2">
      <label className="border-primary bg-surface hover:bg-surface-subtle has-[:focus-visible]:outline-focus min-h-touch flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed p-3 text-sm font-bold has-[:focus-visible]:outline-[length:var(--focus-ring-width)]">
        {translate(value ? `${field}Replace` : `${field}Add`)}
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pickImage(file, set, field);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {value?.preview ? (
        <EvidenceImage
          alt={translate(`${field}Alternative`)}
          className="max-h-40"
          src={value.preview}
        />
      ) : null}
      {errors[field] ? <FormError title={errors[field]} /> : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("submittedHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          <RecordIdentity record={record} showSync={false} />
          <DefinitionList>
            <DefinitionRow term={translate("intendedDestination")}>
              {record.destination
                ? (locationName(record.destination.location_id) ?? translate("unknownLocation"))
                : translate("noDestination")}
            </DefinitionRow>
          </DefinitionList>
          {/* Comparison evidence only: the recycler sees no collector contact detail and no
              precise capture coordinate (FR-HND-002). */}
          {evidenceQuery.data ? (
            <EvidencePanel
              evidence={evidenceQuery.data.evidence.filter(
                (item) =>
                  item.evidence_type === "original_item_photo" ||
                  item.evidence_type === "additional_item_photo",
              )}
              images={evidenceQuery.data.images}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("confirmHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          <DefinitionList>
            <DefinitionRow term={translate("recyclerIdentity")}>
              <span className="font-mono text-xs">{identity.actorId}</span>
            </DefinitionRow>
          </DefinitionList>

          <Field label={translate("confirmedCategory")} required>
            {(control) => (
              <Select
                onChange={(event) => setCategory(event.target.value as EwasteCategory)}
                value={category}
                {...control}
              >
                {EwasteCategorySchema.options.map((value) => (
                  <option key={value} value={value}>
                    {labels.category(value)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {category !== record.category ? (
            <Alert title={translate("categoryChangedTitle")} tone="warning">
              {translate("categoryChanged")}
            </Alert>
          ) : null}

          <Field label={translate("confirmedCondition")} required>
            {(control) => (
              <Select
                onChange={(event) =>
                  setCondition(event.target.value as z.infer<typeof ItemConditionSchema>)
                }
                value={condition}
                {...control}
              >
                {ItemConditionSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {labels.condition(value)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field
              error={errors["weight"]}
              hint={
                record.approximate_weight
                  ? translate("declaredWeightHint", {
                      value: formats.weight(record.approximate_weight) ?? "",
                    })
                  : translate("noDeclaredWeight")
              }
              label={translate("receivedWeight")}
              required
            >
              {(control) => (
                <Input
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => setWeightValue(event.target.value)}
                  step="0.01"
                  type="number"
                  value={weightValue}
                  {...control}
                />
              )}
            </Field>
            <Field label={translate("weightUnit")} required>
              {(control) => (
                <Select
                  onChange={(event) => setWeightUnit(event.target.value as "kg" | "g")}
                  value={weightUnit}
                  {...control}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </Select>
              )}
            </Field>
          </div>

          {wouldFlag && ratio !== null ? (
            <Alert title={translate("discrepancyWarningTitle")} tone="warning">
              {translate("discrepancyWarning", {
                difference: formats.percent(ratio),
                threshold: formats.number(threshold ?? 0, 0),
              })}
            </Alert>
          ) : null}

          <Field
            error={errors["price"]}
            hint={translate("priceHint", { currency: currency ?? "—" })}
            label={translate("finalPrice")}
            required
          >
            {(control) => (
              <Input
                inputMode="decimal"
                min={0}
                onChange={(event) => setPrice(event.target.value)}
                step="0.01"
                type="number"
                value={price}
                {...control}
              />
            )}
          </Field>

          <Field error={errors["location"]} label={translate("receivingLocation")} required>
            {(control) => (
              <Select
                onChange={(event) => setLocationId(event.target.value)}
                value={locationId}
                {...control}
              >
                {locations.map((location) => (
                  <option key={location.location_id} value={location.location_id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field hint={translate("notesHint")} label={translate("notes")}>
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
              {translate("evidenceLegend")}
            </legend>
            <p className="text-muted-foreground text-xs leading-5">{translate("evidenceHint")}</p>
            {imageField("handoffPhoto", handoffPhoto, setHandoffPhoto)}
            {imageField("weightPhoto", weightPhoto, setWeightPhoto)}
          </fieldset>

          {formError ? <FormError title={formError} /> : null}
          {response?.outcome === "rejected" ? (
            <FormError title={translate("rejected")}>{response.message}</FormError>
          ) : null}

          <ConfirmAction
            block
            confirmLabel={translate("confirmReceipt")}
            description={translate("confirmDescription", {
              reference: record.human_reference,
              weight: Number.isFinite(parsedWeight)
                ? `${formats.number(parsedWeight, 2)} ${weightUnit}`
                : "—",
            })}
            disabled={pending}
            label={
              <>
                <CheckCircle2 aria-hidden="true" className="size-5" />
                {translate("confirmReceipt")}
              </>
            }
            loading={pending}
            onConfirm={submit}
            size="large"
            title={translate("confirmTitle")}
          />
          <p className="text-muted-foreground text-xs leading-5">
            {translate("idempotencyNotice")}
          </p>
          <p aria-live="polite" className="sr-only">
            {pending ? translate("submitting") : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
