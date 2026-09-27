"use client";

import {
  RecoveryRecordStateSchema,
  SupportedLanguageSchema,
  type RecoveryRecordState,
  type SupportedLanguage,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/choice-controls";
import { PageHeading, SectionHeading } from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useValueFormats } from "@/features/shared/formats";
import { useProgrammeSettings, useSaveProgrammeSettings } from "@/hooks/use-programme";
import type { ProgrammeSettings } from "@/services/domain/programme-settings";

type Draft = Omit<ProgrammeSettings, "updated_at" | "updated_by">;

const toDraft = (settings: ProgrammeSettings): Draft => ({
  programme_name: settings.programme_name,
  currency: settings.currency,
  country_code: settings.country_code,
  weight_discrepancy_threshold_percentage: settings.weight_discrepancy_threshold_percentage,
  supported_languages: [...settings.supported_languages],
  show_unverified_facilities: settings.show_unverified_facilities,
  default_report_period_days: settings.default_report_period_days,
  default_report_states: [...settings.default_report_states],
});

/**
 * Programme settings form.
 *
 * Only settings an existing service or contract field consumes are offered. The unsaved-change
 * warning compares the form with the saved values, and saving requires the manager's contract
 * permission — a role without it is refused by the service, not merely by a hidden button.
 *
 * The form's state is initialised from the saved settings it is given, and the container remounts it
 * when a save changes them, so no effect copies loaded data into state.
 */
function ProgrammeSettingsForm({ saved }: { saved: ProgrammeSettings }) {
  const translate = useTranslations("screens.settings");
  const translateStatus = useTranslations("status");
  const translateLanguages = useTranslations("languages");
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const save = useSaveProgrammeSettings();

  const [draft, setDraft] = useState<Draft>(() => toDraft(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved));

  // A browser-level warning covers navigating away with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const onSave = () => {
    setFormError(undefined);
    const next: Record<string, string> = {};
    if (draft.programme_name.trim().length < 2) next["programme_name"] = translate("nameRequired");
    if (!/^[A-Z]{3}$/.test(draft.currency)) next["currency"] = translate("currencyInvalid");
    if (!/^[A-Z]{2}$/.test(draft.country_code)) next["country_code"] = translate("countryInvalid");
    if (
      draft.weight_discrepancy_threshold_percentage < 1 ||
      draft.weight_discrepancy_threshold_percentage > 100
    ) {
      next["threshold"] = translate("thresholdInvalid");
    }
    if (draft.default_report_period_days < 1 || draft.default_report_period_days > 365) {
      next["period"] = translate("periodInvalid");
    }
    if (!draft.supported_languages.includes("en")) next["languages"] = translate("englishRequired");
    if (draft.supported_languages.length === 0) next["languages"] = translate("languagesRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(translate("fixErrors"));
      return;
    }
    save.mutate(draft, {
      onSuccess: () => show({ title: translate("saved"), tone: "success" }),
      onError: (error) => setFormError(safeMessage(error)),
    });
  };

  const toggleLanguage = (language: SupportedLanguage, checked: boolean) => {
    const next = checked
      ? [...new Set([...draft.supported_languages, language])]
      : draft.supported_languages.filter((value) => value !== language);
    update({ supported_languages: next });
  };

  const toggleState = (state: RecoveryRecordState, checked: boolean) => {
    const next = checked
      ? [...new Set([...draft.default_report_states, state])]
      : draft.default_report_states.filter((value) => value !== state);
    update({ default_report_states: next });
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
          <SectionHeading as="h2">{translate("programmeHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field error={errors["programme_name"]} label={translate("programmeNameLabel")} required>
            {(control) => (
              <Input
                maxLength={160}
                onChange={(event) => update({ programme_name: event.target.value })}
                value={draft.programme_name}
                {...control}
              />
            )}
          </Field>
          <Field
            error={errors["currency"]}
            hint={translate("currencyHint")}
            label={translate("currencyLabel")}
            required
          >
            {(control) => (
              <Input
                maxLength={3}
                onChange={(event) => update({ currency: event.target.value.toUpperCase() })}
                value={draft.currency}
                {...control}
              />
            )}
          </Field>
          <Field
            error={errors["country_code"]}
            hint={translate("countryHint")}
            label={translate("countryLabel")}
            required
          >
            {(control) => (
              <Input
                maxLength={2}
                onChange={(event) => update({ country_code: event.target.value.toUpperCase() })}
                value={draft.country_code}
                {...control}
              />
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("rulesHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            error={errors["threshold"]}
            hint={translate("thresholdHint")}
            label={translate("thresholdLabel")}
            required
          >
            {(control) => (
              <Input
                inputMode="numeric"
                max={100}
                min={1}
                onChange={(event) =>
                  update({
                    weight_discrepancy_threshold_percentage: Number(event.target.value),
                  })
                }
                type="number"
                value={String(draft.weight_discrepancy_threshold_percentage)}
                {...control}
              />
            )}
          </Field>
          <Checkbox
            checked={draft.show_unverified_facilities}
            label={translate("showUnverifiedLabel")}
            onChange={(event) => update({ show_unverified_facilities: event.target.checked })}
          />
          <p className="text-muted-foreground text-xs leading-5">
            {translate("showUnverifiedHint")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("languagesHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-2">
          <fieldset className="space-y-2">
            <legend className="sr-only">{translate("languagesHeading")}</legend>
            {SupportedLanguageSchema.options.map((language) => (
              <Checkbox
                checked={draft.supported_languages.includes(language)}
                disabled={language === "en"}
                key={language}
                label={translateLanguages(language)}
                onChange={(event) => toggleLanguage(language, event.target.checked)}
              />
            ))}
          </fieldset>
          {errors["languages"] ? <FormError title={errors["languages"]} /> : null}
          <p className="text-muted-foreground text-xs leading-5">{translate("languagesHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("reportingHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            error={errors["period"]}
            hint={translate("periodHint")}
            label={translate("periodLabel")}
            required
          >
            {(control) => (
              <Input
                inputMode="numeric"
                max={365}
                min={1}
                onChange={(event) =>
                  update({ default_report_period_days: Number(event.target.value) })
                }
                type="number"
                value={String(draft.default_report_period_days)}
                {...control}
              />
            )}
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-foreground text-xs font-semibold">
              {translate("defaultStatesLabel")}
            </legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {RecoveryRecordStateSchema.options.map((state) => (
                <Checkbox
                  checked={draft.default_report_states.includes(state)}
                  key={state}
                  label={translateStatus(state)}
                  onChange={(event) => toggleState(state, event.target.checked)}
                />
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              {translate("defaultStatesHint")}
            </p>
          </fieldset>
        </CardContent>
      </Card>

      {formError ? <FormError title={formError} /> : null}

      <div className="space-y-2">
        <ConfirmAction
          block
          confirmLabel={translate("save")}
          description={translate("confirmDescription")}
          disabled={!dirty || save.isPending}
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
 * Loads the saved settings, then mounts the form for them. The form is keyed by the save timestamp,
 * so a successful save replaces the form with one seeded from the stored values.
 */
export function ProgrammeSettingsScreen() {
  const query = useProgrammeSettings();
  return (
    <AsyncPanel query={query} skeletonRows={4}>
      {(settings) => <ProgrammeSettingsForm key={settings.updated_at} saved={settings} />}
    </AsyncPanel>
  );
}
