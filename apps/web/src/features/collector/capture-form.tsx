"use client";

import {
  EWASTE_CATEGORIES,
  ItemConditionSchema,
  type EwasteCategory,
  type ItemCondition,
  type SupportedLanguage,
} from "@scraptrace/contracts";
import { Camera, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { useOnlineStatus } from "@/components/feedback/connectivity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";
import {
  useNearbyLocations,
  usePriceEstimate,
  useProgrammeMutation,
  useSafetyGuidance,
} from "@/services/queries";
import { EvidenceIdSchema } from "@scraptrace/contracts";
import type { CaptureDraftInput } from "@/services/ports/service-ports";
import type { VisionAppraisalResponse } from "@scraptrace/contracts";

import { SafetyGuidancePanel } from "./safety-guidance-panel";

const CONDITIONS = ItemConditionSchema.options;

/**
 * Figma: mobile-collector-ar, extended into the whole capture journey: photograph, a suggestion
 * from the demonstration classifier, the person's confirmation or correction, approved safety
 * guidance, an indicative estimate, a destination, and the record itself.
 *
 * The suggestion never decides anything. `category_confirmation.source` records whether the
 * person accepted the prediction, corrected it, or chose without one (SRS, ADR-003).
 */
export function CaptureForm() {
  const translate = useTranslations("screens.capture");
  const translateCategories = useTranslations("categories");
  const translateConditions = useTranslations("conditions");
  const translatePages = useTranslations("pages");
  const locale = useLocale() as SupportedLanguage;
  const online = useOnlineStatus();
  const number = useNumber();
  const { show } = useToast();

  const [evidenceId, setEvidenceId] = useState<string | undefined>();
  const [preview, setPreview] = useState<string | undefined>();
  const [vision, setVision] = useState<VisionAppraisalResponse | undefined>();
  const [category, setCategory] = useState<EwasteCategory | "">("");
  const [condition, setCondition] = useState<ItemCondition>("unknown");
  const [itemCount, setItemCount] = useState("1");
  const [weight, setWeight] = useState("");
  const [area, setArea] = useState("");
  const [coordinates, setCoordinates] = useState<
    { latitude: number; longitude: number; accuracyMetres?: number } | undefined
  >();
  const [destination, setDestination] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ id: string; reference: string } | undefined>();

  const suggested = vision?.outcome === "classified" ? vision.category : undefined;
  const chosenCategory = category === "" ? undefined : category;
  const weightValue = Number.parseFloat(weight);

  const guidance = useSafetyGuidance(chosenCategory, locale);
  const estimate = usePriceEstimate({
    category: chosenCategory,
    condition,
    itemCount: Number.parseInt(itemCount, 10) || 1,
    ...(Number.isFinite(weightValue) && weightValue > 0
      ? { approximateWeightKg: weightValue }
      : {}),
  });
  const nearby = useNearbyLocations({
    categories: chosenCategory ? [chosenCategory] : [],
    radiusKm: 25,
    offline: !online,
  });
  const locations = nearby.data?.outcome === "results" ? nearby.data.locations : [];

  const storePhotograph = useProgrammeMutation((services, file: File) =>
    services.evidence.store(file),
  );
  const appraise = useProgrammeMutation((services, id: string) =>
    services.vision.appraise({ evidence_id: EvidenceIdSchema.parse(id) }),
  );
  const createRecord = useProgrammeMutation((services, input: CaptureDraftInput) =>
    services.recoveryRecords.create(input),
  );
  const publish = useProgrammeMutation((services, recordId: string) =>
    services.recoveryRecords.submit(recordId),
  );

  const onPhotograph = async (files: readonly File[]) => {
    const file = files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const storedId = await storePhotograph.mutateAsync(file);
    setEvidenceId(storedId);
    setErrors((current) => {
      const { photograph, ...rest } = current;
      void photograph;
      return rest;
    });
    const appraisal = await appraise.mutateAsync(storedId);
    setVision(appraisal);
    if (appraisal.outcome === "classified" && category === "") setCategory(appraisal.category);
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!evidenceId) next["photograph"] = translate("photographRequired");
    if (!chosenCategory) next["category"] = translate("categoryRequired");
    if (area.trim().length === 0) next["area"] = translate("areaRequired");
    if (chosenCategory === "mixed_scrap" && !(weightValue > 0)) {
      next["weight"] = translate("weightRequiredForBatch");
    }
    if (
      suggested &&
      chosenCategory &&
      chosenCategory !== suggested &&
      correctionReason.trim().length === 0
    ) {
      next["correction"] = translate("correctionReasonRequired");
    }
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>, publishAfter: boolean) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !evidenceId || !chosenCategory) return;

    let record;
    try {
      record = await createRecord.mutateAsync({
        category: chosenCategory,
        condition,
        itemCount: Number.parseInt(itemCount, 10) || 1,
        ...(Number.isFinite(weightValue) && weightValue > 0
          ? { approximateWeightKg: weightValue }
          : {}),
        evidenceId,
        areaLabel: area.trim(),
        countryCode: "GH",
        ...(coordinates ? { coordinates } : {}),
        ...(destination ? { destinationLocationId: destination } : {}),
        confirmationSource: suggested
          ? chosenCategory === suggested
            ? "accepted_prediction"
            : "human_correction"
          : "manual_selection",
        ...(correctionReason.trim() ? { correctionReason: correctionReason.trim() } : {}),
        ...(estimate.data ? { estimate: estimate.data } : {}),
        ...(guidance.data?.outcome === "approved_guidance"
          ? {
              safetyGuide: {
                card_id: guidance.data.safety_card_id,
                card_version: guidance.data.safety_card_version,
                category: chosenCategory,
                language: locale,
                approval_date: guidance.data.approval_date,
                review_date: guidance.data.review_date,
                source_references: guidance.data.source_references,
              },
            }
          : {}),
      });
      if (publishAfter) await publish.mutateAsync(record.record_id);
    } catch (error) {
      // A record that cannot be saved must say so: silence would look like success.
      show({
        title: translate("saveFailed"),
        ...(error instanceof Error ? { description: error.message } : {}),
        tone: "danger",
      });
      return;
    }
    setCreated({ id: record.record_id, reference: record.human_reference });
    show({
      title: publishAfter ? translate("publishedTitle") : translate("savedTitle"),
      description: record.human_reference,
      tone: "success",
    });
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      show({ title: translate("locationUnavailable"), tone: "warning" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          ...(position.coords.accuracy ? { accuracyMetres: position.coords.accuracy } : {}),
        });
        show({ title: translate("locationCaptured"), tone: "success" });
      },
      () => show({ title: translate("locationDenied"), tone: "warning" }),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  if (created) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeading visuallyHiddenBelowDesktop>{translatePages("captureTitle")}</PageHeading>
        <InfoPanel as="h2" title={translate("recordedTitle")} tone="success">
          <p>{translate("recordedText", { reference: created.reference })}</p>
        </InfoPanel>
        <div className="flex flex-col gap-2">
          <Link
            className="text-info text-sm font-bold underline-offset-2 hover:underline"
            href={`/collector/records/${created.id}`}
          >
            {translate("openRecord")}
          </Link>
          <Button
            onClick={() => {
              setCreated(undefined);
              setEvidenceId(undefined);
              setPreview(undefined);
              setVision(undefined);
              setCategory("");
              setWeight("");
              setCorrectionReason("");
            }}
            size="large"
            variant="secondary"
          >
            {translate("captureAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl space-y-5"
      noValidate
      onSubmit={(event) => void onSubmit(event, true)}
    >
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("captureTitle")}</PageHeading>

      <section aria-labelledby="capture-photograph" className="space-y-2">
        <SectionLabel>
          <span id="capture-photograph">{translate("photographHeading")}</span>
        </SectionLabel>
        <FileUpload
          accept="image/*"
          capture="environment"
          hint={translate("photographHint")}
          label={translate("photographLabel")}
          onFilesSelected={(files) => void onPhotograph(files)}
        />
        {errors["photograph"] ? (
          <p className="text-danger text-xs font-semibold" role="alert">
            {errors["photograph"]}
          </p>
        ) : null}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never a remote asset
          <img
            alt={translate("photographPreview")}
            className="max-h-56 w-full rounded-sm border object-cover"
            src={preview}
          />
        ) : null}
        {appraise.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner />
            {translate("classifying")}
          </p>
        ) : null}
        {vision?.outcome === "classified" ? (
          <InfoPanel as="h3" title={translate("suggestionTitle")} tone="info">
            <DefinitionList className="text-xs">
              <DefinitionRow term={translate("suggestedCategory")}>
                {translateCategories(vision.category)}
              </DefinitionRow>
              <DefinitionRow term={translate("confidence")}>
                {translate("confidenceValue", { value: number(vision.confidence * 100) })}
              </DefinitionRow>
              <DefinitionRow term={translate("model")}>
                {vision.model_name} {vision.model_version}
              </DefinitionRow>
            </DefinitionList>
            <p className="mt-2">{translate("suggestionNote")}</p>
          </InfoPanel>
        ) : null}
        {vision?.outcome === "unable_to_classify" ? (
          <InfoPanel as="h3" title={translate("noSuggestionTitle")} tone="warning">
            {translate("noSuggestionText")}
          </InfoPanel>
        ) : null}
      </section>

      <section aria-labelledby="capture-item" className="space-y-3">
        <SectionLabel>
          <span id="capture-item">{translate("itemHeading")}</span>
        </SectionLabel>
        <Field error={errors["category"]} label={translate("categoryLabel")} required>
          {(control) => (
            <Select
              onChange={(event) => setCategory(event.target.value as EwasteCategory)}
              value={category}
              {...control}
            >
              <option value="">{translate("categoryPlaceholder")}</option>
              {EWASTE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {translateCategories(option)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {suggested && chosenCategory && chosenCategory !== suggested ? (
          <Field
            error={errors["correction"]}
            hint={translate("correctionHint")}
            label={translate("correctionLabel")}
            required
          >
            {(control) => (
              <Input
                onChange={(event) => setCorrectionReason(event.target.value)}
                value={correctionReason}
                {...control}
              />
            )}
          </Field>
        ) : null}
        <Field label={translate("conditionLabel")}>
          {(control) => (
            <Select
              onChange={(event) => setCondition(event.target.value as ItemCondition)}
              value={condition}
              {...control}
            >
              {CONDITIONS.map((option) => (
                <option key={option} value={option}>
                  {translateConditions(option)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={translate("itemCountLabel")}>
            {(control) => (
              <Input
                inputMode="numeric"
                min={1}
                onChange={(event) => setItemCount(event.target.value)}
                type="number"
                value={itemCount}
                {...control}
              />
            )}
          </Field>
          <Field
            error={errors["weight"]}
            hint={translate("weightHint")}
            label={translate("weightLabel")}
          >
            {(control) => (
              <Input
                inputMode="decimal"
                min={0}
                onChange={(event) => setWeight(event.target.value)}
                step="0.1"
                type="number"
                value={weight}
                {...control}
              />
            )}
          </Field>
        </div>
      </section>

      {chosenCategory ? <SafetyGuidancePanel category={chosenCategory} /> : null}

      {estimate.data ? (
        <Card>
          <CardHeader>
            <h2 className="text-warning text-sm font-bold">{translate("estimateTitle")}</h2>
          </CardHeader>
          <CardContent>
            <p className="text-warning text-lg font-extrabold">
              {translate("estimateRange", {
                minimum: number(estimate.data.minimum_amount, 2),
                maximum: number(estimate.data.maximum_amount, 2),
                currency: estimate.data.currency,
              })}
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-5">
              {estimate.data.disclaimer}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="capture-place" className="space-y-3">
        <SectionLabel>
          <span id="capture-place">{translate("placeHeading")}</span>
        </SectionLabel>
        <Field
          error={errors["area"]}
          hint={translate("areaHint")}
          label={translate("areaLabel")}
          required
        >
          {(control) => (
            <Input onChange={(event) => setArea(event.target.value)} value={area} {...control} />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={useMyLocation} variant="secondary">
            <MapPin aria-hidden="true" className="size-4" />
            {translate("useLocation")}
          </Button>
          {coordinates ? (
            <span className="text-primary text-xs font-bold">{translate("locationAttached")}</span>
          ) : null}
        </div>
        <Field hint={translate("destinationHint")} label={translate("destinationLabel")}>
          {(control) => (
            <Select
              onChange={(event) => setDestination(event.target.value)}
              value={destination}
              {...control}
            >
              <option value="">{translate("destinationPlaceholder")}</option>
              {locations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </section>

      {Object.keys(errors).length > 0 ? (
        <FormError title={translate("incompleteTitle")}>
          <ul className="list-inside list-disc">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </FormError>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          block
          loading={createRecord.isPending || publish.isPending}
          size="large"
          type="submit"
        >
          <Camera aria-hidden="true" className="size-5" />
          {translate("submit")}
        </Button>
        <Button
          block
          loading={createRecord.isPending}
          onClick={(event) => void onSubmit(event as unknown as FormEvent<HTMLFormElement>, false)}
          size="large"
          variant="secondary"
        >
          {translate("saveDraft")}
        </Button>
        {!online ? (
          <p className="text-muted-foreground text-xs leading-5">{translate("offlineNote")}</p>
        ) : null}
      </div>
    </form>
  );
}
