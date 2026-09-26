import {
  CONTRACT_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION,
  SupportedLanguageSchema,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { Card, CardContent, InfoPanel } from "@/components/ui/card";
import { Switch } from "@/components/ui/choice-controls";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useNumber } from "@/i18n/use-number";

const RETENTION_DAYS = [7, 30, 90] as const;

/**
 * No Figma frame. Programme-wide defaults, kept to values the contracts already define: the
 * supported languages, the weight units `WeightSchema` allows, and the schema versions this
 * build speaks. Saving needs the configuration service and is deferred.
 */
export function ProgrammeSettings() {
  const translate = useTranslations("screens.settings");
  const translatePages = useTranslations("pages");
  const translateLanguages = useTranslations("languages");
  const number = useNumber();
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading>{translatePages("settingsTitle")}</PageHeading>

      <section aria-labelledby="defaults" className="space-y-2">
        <SectionLabel>
          <span id="defaults">{translate("defaults")}</span>
        </SectionLabel>
        <Card>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-3 sm:pt-5">
            <Field label={translate("defaultLanguage")}>
              {(control) => (
                <Select defaultValue={SupportedLanguageSchema.options[0]} {...control}>
                  {SupportedLanguageSchema.options.map((language) => (
                    <option key={language} value={language}>
                      {translateLanguages(language)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={translate("retention")}>
              {(control) => (
                <Select defaultValue="30" {...control}>
                  {RETENTION_DAYS.map((days) => (
                    <option key={days} value={String(days)}>
                      {translate("retentionDays", { count: number(days) })}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={translate("unit")}>
              {(control) => (
                <Select defaultValue="kg" {...control}>
                  <option value="kg">{translate("unitKg")}</option>
                  <option value="g">{translate("unitG")}</option>
                </Select>
              )}
            </Field>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="settings-notifications" className="space-y-2">
        <SectionLabel>
          <span id="settings-notifications">{translate("notifications")}</span>
        </SectionLabel>
        <div className="bg-surface divide-y rounded-md border px-4">
          <Switch defaultChecked label={translate("reviewAlerts")} />
          <Switch label={translate("weeklyDigest")} />
        </div>
      </section>

      <section aria-labelledby="settings-environment" className="space-y-2">
        <SectionLabel>
          <span id="settings-environment">{translate("environment")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList>
            <DefinitionRow term={translate("contractVersion")}>
              {CONTRACT_SCHEMA_VERSION}
            </DefinitionRow>
            <DefinitionRow term={translate("eventVersion")}>{EVENT_SCHEMA_VERSION}</DefinitionRow>
            <DefinitionRow term={translate("dataRegion")}>
              {translate("dataRegionValue")}
            </DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <DeferredActionButton size="large">{translate("save")}</DeferredActionButton>

      <InfoPanel as="h2" title={translate("scopeTitle")} tone="info">
        {translate("scopeText")}
      </InfoPanel>
    </div>
  );
}
