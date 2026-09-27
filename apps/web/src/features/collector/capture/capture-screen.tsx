"use client";

import {
  EwasteCategorySchema,
  ItemConditionSchema,
  type EwasteCategory,
  type SupportedLanguage,
  type VisionAppraisalResponseSchema,
  type VisionResult,
} from "@scraptrace/contracts";
import { Camera, CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading, SectionHeading } from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidenceImage } from "@/features/shared/evidence-image";
import { useSafeErrorMessage } from "@/features/shared/async-panel";
import { useValueFormats } from "@/features/shared/formats";
import { prepareImage, type AcceptedImage } from "@/features/shared/image-capture";
import { useCreateDraft, useSubmitRecord } from "@/hooks/use-records";
import { useProgrammeSettings } from "@/hooks/use-programme";
import { useModelConfiguration } from "@/hooks/use-administration";
import { Link, useRouter } from "@/i18n/navigation";
import { newEvidenceId, newUuid } from "@/services/domain/identifiers";
import { ALL_DIRECTORY_LOCATIONS } from "@/services/local/location-directory";
import { useServices } from "@/services/service-provider";

import { PredictionPanel } from "./prediction-panel";
import { SafetyGuidePanel } from "./safety-guide-panel";

type Appraisal = z.infer<typeof VisionAppraisalResponseSchema>;

const AREA_LABELS = ["Greater Accra", "Ashanti Region", "Northern Region"] as const;

/**
 * Collector capture and submission (FR-VIS-001 to FR-VIS-007, FR-REC-001, FR-REC-002).
 *
 * The screen follows the order the journey requires: accept a photograph, review and confirm the
 * category, record the details the contract needs, read approved safety guidance, and only then
 * save and submit. Camera and location are requested when the related control is used, never on
 * load.
 */
export function CaptureForm() {
  const translate = useTranslations("screens.capture");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const locale = useLocale() as SupportedLanguage;
  const router = useRouter();
  const { show } = useToast();
  const services = useServices();
  const safeMessage = useSafeErrorMessage();

  const settingsQuery = useProgrammeSettings();
  const configurationQuery = useModelConfiguration();
  const createDraft = useCreateDraft();
  const submitRecord = useSubmitRecord();

  const [image, setImage] = useState<AcceptedImage | null>(null);
  const [imageError, setImageError] = useState<string | undefined>();
  const [appraising, setAppraising] = useState(false);
  const [appraisal, setAppraisal] = useState<Appraisal | null>(null);
  const [category, setCategory] = useState<EwasteCategory | "">("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [condition, setCondition] = useState<z.infer<typeof ItemConditionSchema>>("unknown");
  const [itemCount, setItemCount] = useState("1");
  const [weight, setWeight] = useState("");
  const [areaLabel, setAreaLabel] = useState<string>(AREA_LABELS[0]);
  const [destination, setDestination] = useState("");
  const [coordinates, setCoordinates] = useState<
    { latitude: number; longitude: number } | undefined
  >();
  const [locationNotice, setLocationNotice] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isBatch = category === "mixed_scrap";
  const weightRequired = isBatch;
  const threshold = configurationQuery.data?.confidence_threshold ?? 0.4;

  const onFileChange = async (file: File) => {
    setImageError(undefined);
    setAppraisal(null);
    setCategory("");
    const result = await prepareImage(file);
    if (!result.ok) {
      setImage(null);
      setImageError(translate(`imageRejected.${result.reason}`));
      return;
    }
    setImage(result);
    setAppraising(true);
    try {
      const response = await services.vision.appraise({
        evidence_id: newEvidenceId(),
        image: result.blob,
        price_estimation_inputs: { condition },
      });
      setAppraisal(response);
      if (response.outcome === "classified") setCategory(response.category);
    } catch (error) {
      show({ title: safeMessage(error), tone: "warning" });
    } finally {
      setAppraising(false);
    }
  };

  const requestLocation = () => {
    setLocationNotice(undefined);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationNotice(translate("locationUnsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationNotice(translate("locationCaptured"));
      },
      () => setLocationNotice(translate("locationDenied")),
      { timeout: 10_000 },
    );
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!image) errors["image"] = translate("imageRequired");
    if (category === "") errors["category"] = translate("categoryRequired");
    if (
      appraisal?.outcome === "classified" &&
      category !== "" &&
      category !== appraisal.category &&
      correctionReason.trim().length === 0
    ) {
      errors["correctionReason"] = translate("correctionRequired");
    }
    const parsedWeight = Number.parseFloat(weight);
    if (weightRequired && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      errors["weight"] = translate("weightRequired");
    }
    if (weight.trim().length > 0 && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      errors["weight"] = translate("weightInvalid");
    }
    const parsedCount = Number.parseInt(itemCount, 10);
    if (!isBatch && (!Number.isInteger(parsedCount) || parsedCount < 1)) {
      errors["itemCount"] = translate("countInvalid");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async () => {
    setFormError(undefined);
    if (!validate() || !image || category === "") {
      setFormError(translate("fixErrors"));
      return;
    }
    const parsedWeight = Number.parseFloat(weight);
    const parsedCount = Number.parseInt(itemCount, 10);
    const visionResult: VisionResult | undefined =
      appraisal?.outcome === "classified"
        ? {
            prediction_id: newUuid(),
            model_name: appraisal.model_name,
            model_version: appraisal.model_version,
            inferred_at: appraisal.inferred_at,
            scores: appraisal.scores,
            suggested_category: appraisal.category,
            confidence: appraisal.confidence,
            low_confidence: appraisal.confidence < threshold,
          }
        : undefined;

    try {
      const draft = await createDraft.mutateAsync({
        category,
        language: locale,
        condition,
        ...(isBatch ? {} : { itemCount: parsedCount }),
        ...(Number.isFinite(parsedWeight) && parsedWeight > 0
          ? { approximateWeight: { value: parsedWeight, unit: "kg" as const } }
          : {}),
        areaLabel,
        administrativeArea: areaLabel,
        ...(coordinates
          ? {
              captureLocation: {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                source: "device" as const,
              },
            }
          : {}),
        ...(visionResult ? { visionResult } : {}),
        confirmationSource:
          visionResult === undefined
            ? "manual_selection"
            : visionResult.suggested_category === category
              ? "accepted_prediction"
              : "human_correction",
        ...(correctionReason.trim().length > 0
          ? { correctionReason: correctionReason.trim() }
          : {}),
        image: image.blob,
        ...(image.preview ? { imagePreview: image.preview } : {}),
        offline: false,
        ...(destination ? { destinationLocationId: destination } : {}),
      });
      const result = await submitRecord.mutateAsync(draft.record_id);
      show({
        title: translate(result.outcome === "duplicate_image" ? "submittedWithFlag" : "submitted", {
          reference: draft.human_reference,
        }),
        tone: result.outcome === "duplicate_image" ? "warning" : "success",
      });
      router.push(`/collector/records/${draft.record_id}`);
    } catch (error) {
      setFormError(safeMessage(error));
    }
  };

  const busy = createDraft.isPending || submitRecord.isPending;
  const compatibleDestinations = ALL_DIRECTORY_LOCATIONS.filter(
    (entry) =>
      category === "" ||
      entry.accepted_categories.includes(category) ||
      (settingsQuery.data?.show_unverified_facilities ?? true),
  );

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("captureTitle")}</PageHeading>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("stepImage")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          {image?.preview ? (
            <EvidenceImage
              alt={translate("previewAlternative")}
              className="max-h-56"
              src={image.preview}
            />
          ) : null}
          <label className="border-primary bg-surface hover:bg-surface-subtle has-[:focus-visible]:outline-focus min-h-touch flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-sm font-bold has-[:focus-visible]:outline-[length:var(--focus-ring-width)]">
            <Camera aria-hidden="true" className="text-primary size-5" />
            {image ? translate("retake") : translate("takePhoto")}
            <input
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFileChange(file);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <p className="text-muted-foreground text-xs leading-5">{translate("imageHint")}</p>
          {image ? (
            <p className="text-muted-foreground text-xs">
              {translate(image.reduced ? "imageReduced" : "imageNotReduced", {
                size: formats.number(Math.round(image.originalBytes / 1024), 0),
              })}
            </p>
          ) : null}
          {imageError ? <FormError title={imageError} /> : null}
          {fieldErrors["image"] ? <FormError title={fieldErrors["image"]} /> : null}
          {appraising ? (
            <p aria-live="polite" className="text-muted-foreground text-xs">
              {translate("appraising")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {appraisal ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("stepCategory")}</SectionHeading>
          </CardHeader>
          <CardContent>
            <PredictionPanel
              appraisal={appraisal}
              confidenceThreshold={threshold}
              correctionReason={correctionReason}
              onCorrectionReasonChange={setCorrectionReason}
              onSelectCategory={setCategory}
              selectedCategory={category}
            />
            {fieldErrors["category"] ? <FormError title={fieldErrors["category"]} /> : null}
            {fieldErrors["correctionReason"] ? (
              <FormError title={fieldErrors["correctionReason"]} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("stepDetails")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          {!appraisal ? (
            <Field
              error={fieldErrors["category"]}
              hint={translate("categoryHint")}
              label={translate("categoryLabel")}
              required
            >
              {(control) => (
                <Select
                  onChange={(event) => setCategory(event.target.value as EwasteCategory | "")}
                  value={category}
                  {...control}
                >
                  <option value="">{translate("categoryPlaceholder")}</option>
                  {EwasteCategorySchema.options.map((value) => (
                    <option key={value} value={value}>
                      {labels.category(value)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}

          <Field label={translate("conditionLabel")} required>
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

          {isBatch ? (
            <Alert title={translate("batchNoticeTitle")} tone="info">
              {translate("batchNotice")}
            </Alert>
          ) : (
            <Field error={fieldErrors["itemCount"]} label={translate("countLabel")} required>
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
          )}

          <Field
            error={fieldErrors["weight"]}
            hint={translate(weightRequired ? "weightHintRequired" : "weightHintOptional")}
            label={translate("weightLabel")}
            required={weightRequired}
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

          <Field hint={translate("areaHint")} label={translate("areaLabel")} required>
            {(control) => (
              <Select
                onChange={(event) => setAreaLabel(event.target.value)}
                value={areaLabel}
                {...control}
              >
                {AREA_LABELS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="space-y-2">
            <Button onClick={requestLocation} variant="secondary">
              {translate("useLocation")}
            </Button>
            <p aria-live="polite" className="text-muted-foreground text-xs">
              {locationNotice ?? translate("locationHint")}
            </p>
          </div>

          <Field hint={translate("destinationHint")} label={translate("destinationLabel")}>
            {(control) => (
              <Select
                onChange={(event) => setDestination(event.target.value)}
                value={destination}
                {...control}
              >
                <option value="">{translate("destinationPlaceholder")}</option>
                {compatibleDestinations.map((entry) => (
                  <option key={entry.location_id} value={entry.location_id}>
                    {entry.name} — {labels.facilityType(entry.facility_type)}
                    {entry.verification_status === "programme_verified"
                      ? ""
                      : ` (${labels.verification(entry.verification_status)})`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("stepSafety")}</SectionHeading>
        </CardHeader>
        <CardContent>
          <SafetyGuidePanel category={category === "" ? undefined : category} language={locale} />
        </CardContent>
      </Card>

      {appraisal?.outcome === "classified" && appraisal.estimate ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("stepEstimate")}</SectionHeading>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-primary-dark text-lg font-bold">
              {formats.currency(appraisal.estimate.minimum_amount, appraisal.estimate.currency)} –{" "}
              {formats.currency(appraisal.estimate.maximum_amount, appraisal.estimate.currency)}
            </p>
            <p className="text-muted-foreground text-xs leading-5">{appraisal.estimate.basis}</p>
            <p className="text-muted-foreground text-xs leading-5">
              {translate("estimateSource", {
                source: appraisal.estimate.source,
                date: appraisal.estimate.effective_date,
              })}
            </p>
            <Alert title={translate("estimateDisclaimerTitle")} tone="warning">
              {appraisal.estimate.disclaimer}
            </Alert>
          </CardContent>
        </Card>
      ) : null}

      {formError ? <FormError title={formError} /> : null}

      <div className="flex flex-col gap-2">
        <Button block loading={busy} onClick={() => void onSubmit()} size="large">
          <CheckCircle2 aria-hidden="true" className="size-5" />
          {translate("submit")}
        </Button>
        <Link
          className="text-muted-foreground min-h-touch inline-flex items-center justify-center text-xs underline-offset-2 hover:underline"
          href="/collector"
        >
          {translate("cancel")}
        </Link>
      </div>
      <p className="bg-surface text-muted-foreground rounded-md border p-3 text-xs leading-5">
        {translate("privacyReminder")}
      </p>
    </div>
  );
}
