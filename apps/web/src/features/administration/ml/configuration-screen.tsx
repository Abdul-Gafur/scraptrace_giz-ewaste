"use client";

import { EwasteCategorySchema, type EwasteCategory } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/choice-controls";
import {
  DefinitionList,
  DefinitionRow,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/choice-controls";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import {
  useModelConfiguration,
  useModelRegistry,
  useSaveModelConfiguration,
} from "@/hooks/use-administration";
import type { ModelConfiguration } from "@/services/domain/model-administration";

type Draft = Omit<ModelConfiguration, "updated_at" | "updated_by">;

const MIN_THRESHOLD = 5;
const MAX_THRESHOLD = 95;

/**
 * Model configuration.
 *
 * Only controls the application actually applies are offered: the confidence threshold below which
 * a prediction needs manual confirmation, how a low-confidence case is routed, and the categories
 * that always require confirmation. Activating or rolling back a model version is not supported by
 * any service here, so the active version is shown as read-only metadata rather than as a control
 * that would not do what it says.
 */
const toDraft = (configuration: ModelConfiguration): Draft => ({
  active_model_version: configuration.active_model_version,
  confidence_threshold: configuration.confidence_threshold,
  low_confidence_routing: configuration.low_confidence_routing,
  manual_review_categories: [...configuration.manual_review_categories],
});

/**
 * The configuration form. Its state is initialised from the stored configuration it is given, and
 * the container remounts it after a save, so no effect copies loaded data into state.
 */
function ModelConfigurationForm({ saved }: { saved: ModelConfiguration }) {
  const translate = useTranslations("screens.mlConfiguration");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const registryQuery = useModelRegistry();
  const save = useSaveModelConfiguration();

  const [draft, setDraft] = useState<Draft>(() => toDraft(saved));
  const [thresholdPercent, setThresholdPercent] = useState(() =>
    String(Math.round(saved.confidence_threshold * 100)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const registered = registryQuery.data ?? [];
  const canSelectVersion = registered.length > 1;

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(toDraft(saved)) ||
    Number(thresholdPercent) !== Math.round(saved.confidence_threshold * 100);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const onSave = () => {
    setFormError(undefined);
    const next: Record<string, string> = {};
    const percent = Number(thresholdPercent);
    if (!Number.isFinite(percent) || percent < MIN_THRESHOLD || percent > MAX_THRESHOLD) {
      next["threshold"] = translate("thresholdInvalid", {
        min: formats.number(MIN_THRESHOLD, 0),
        max: formats.number(MAX_THRESHOLD, 0),
      });
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(translate("fixErrors"));
      return;
    }
    save.mutate(
      { ...draft, confidence_threshold: percent / 100 },
      {
        onSuccess: () => show({ title: translate("saved"), tone: "success" }),
        onError: (error) => setFormError(safeMessage(error)),
      },
    );
  };

  const toggleCategory = (category: EwasteCategory, checked: boolean) => {
    update({
      manual_review_categories: checked
        ? [...new Set([...draft.manual_review_categories, category])]
        : draft.manual_review_categories.filter((value) => value !== category),
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      {dirty ? (
        <Alert title={translate("unsavedTitle")} tone="warning">
          {translate("unsaved")}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("versionHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          {canSelectVersion ? (
            <Field hint={translate("versionHint")} label={translate("versionLabel")} required>
              {(control) => (
                <Select
                  onChange={(event) => update({ active_model_version: event.target.value })}
                  value={draft.active_model_version}
                  {...control}
                >
                  {registered.map((entry) => (
                    <option key={entry.model_version} value={entry.model_version}>
                      {entry.model_name} {entry.model_version}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <>
              <DefinitionList>
                <DefinitionRow term={translate("versionLabel")}>
                  {draft.active_model_version}
                </DefinitionRow>
                <DefinitionRow term={translate("registeredVersions")}>
                  {formats.number(registered.length, 0)}
                </DefinitionRow>
              </DefinitionList>
              <Alert title={translate("singleVersionTitle")} tone="info">
                {translate("singleVersionNotice")}
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("thresholdHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            error={errors["threshold"]}
            hint={translate("thresholdHint", {
              min: formats.number(MIN_THRESHOLD, 0),
              max: formats.number(MAX_THRESHOLD, 0),
            })}
            label={translate("thresholdLabel")}
            required
          >
            {(control) => (
              <Input
                inputMode="numeric"
                max={MAX_THRESHOLD}
                min={MIN_THRESHOLD}
                onChange={(event) => setThresholdPercent(event.target.value)}
                type="number"
                value={thresholdPercent}
                {...control}
              />
            )}
          </Field>
          <p className="text-muted-foreground text-xs leading-5">{translate("thresholdEffect")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("routingHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            legend={translate("routingLabel")}
            name="routing"
            onValueChange={(value) =>
              update({
                low_confidence_routing: value as Draft["low_confidence_routing"],
              })
            }
            options={[
              {
                value: "manual_confirmation",
                label: translate("routing.manual_confirmation"),
                description: translate("routingHint.manual_confirmation"),
              },
              {
                value: "manual_confirmation_and_feedback",
                label: translate("routing.manual_confirmation_and_feedback"),
                description: translate("routingHint.manual_confirmation_and_feedback"),
              },
            ]}
            value={draft.low_confidence_routing}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("manualHeading")}</SectionHeading>
          <p className="text-muted-foreground text-xs leading-5">{translate("manualIntro")}</p>
        </CardHeader>
        <CardContent>
          <fieldset className="grid gap-1 sm:grid-cols-2">
            <legend className="sr-only">{translate("manualHeading")}</legend>
            {EwasteCategorySchema.options.map((category) => (
              <Checkbox
                checked={draft.manual_review_categories.includes(category)}
                key={category}
                label={labels.category(category)}
                onChange={(event) => toggleCategory(category, event.target.checked)}
              />
            ))}
          </fieldset>
        </CardContent>
      </Card>

      {formError ? <FormError title={formError} /> : null}

      <div className="space-y-2">
        <ConfirmAction
          block
          confirmLabel={translate("save")}
          description={translate("confirmDescription", {
            threshold: `${thresholdPercent}%`,
          })}
          disabled={save.isPending}
          label={translate("save")}
          loading={save.isPending}
          onConfirm={onSave}
          size="large"
          title={translate("confirmTitle")}
        />
        <p className="text-muted-foreground text-xs">
          {translate("lastUpdated", {
            when: formats.dateTime(saved.updated_at) ?? "",
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * Loads the stored configuration, then mounts the form for it, keyed by the save timestamp.
 */
export function ModelConfigurationScreen() {
  const query = useModelConfiguration();
  return (
    <AsyncPanel query={query} skeletonRows={4}>
      {(configuration) => (
        <ModelConfigurationForm key={configuration.updated_at} saved={configuration} />
      )}
    </AsyncPanel>
  );
}
