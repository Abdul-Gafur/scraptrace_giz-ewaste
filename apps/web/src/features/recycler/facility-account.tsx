import { FacilityTypeSchema, UserRoleSchema } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice-controls";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { ToneBadge } from "@/components/ui/tone-badge";
import { Link } from "@/i18n/navigation";
import { useDate } from "@/i18n/use-date";

/**
 * No Figma frame. The account-privacy frame is the collector equivalent; this keeps its
 * structure (identification, preferences, controls, sign out) and replaces the local-data
 * section with what a receiving facility actually holds: its programme verification.
 */
export function FacilityAccount() {
  const translate = useTranslations("screens.recyclerAccount");
  const translateTypes = useTranslations("screens.facilityTypes");
  const translateWorkflow = useTranslations("screens.workflow");
  const translatePages = useTranslations("pages");
  const translateRoles = useTranslations("roles");
  const translateAccount = useTranslations("screens.account");
  const translateLanguages = useTranslations("languages");
  const locale = useLocale();
  const date = useDate();
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading>{translatePages("recyclerAccountTitle")}</PageHeading>

      <section aria-labelledby="facility" className="space-y-2">
        <SectionLabel>
          <span id="facility">{translate("facility")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList>
            <DefinitionRow term={translate("siteId")}>RY-9921-EM</DefinitionRow>
            <DefinitionRow term={translate("facilityType")}>
              {translateTypes(FacilityTypeSchema.enum.recycler)}
            </DefinitionRow>
            <DefinitionRow term={translate("verification")}>
              <ToneBadge tone="success">{translateWorkflow("verified")}</ToneBadge>
            </DefinitionRow>
            <DefinitionRow term={translate("validUntil")}>{date("2027-03-31")}</DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <section aria-labelledby="facility-preferences" className="space-y-2">
        <SectionLabel>
          <span id="facility-preferences">{translate("preferences")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList>
            <DefinitionRow term={translate("preferredLanguage")} tone="success">
              {translateLanguages(locale)}
            </DefinitionRow>
            <DefinitionRow term={translateAccount("accountRole")} tone="success">
              {translateRoles(UserRoleSchema.enum.recycler)}
            </DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <section aria-labelledby="facility-notifications" className="space-y-2">
        <SectionLabel>
          <span id="facility-notifications">{translate("notifications")}</span>
        </SectionLabel>
        <div className="bg-surface divide-y rounded-md border px-4">
          <Switch description={translate("intakeAlertsHint")} label={translate("intakeAlerts")} />
          <Switch label={translate("weeklySummary")} />
        </div>
      </section>

      <Link
        className={buttonVariants({ variant: "secondary", block: true, size: "large" })}
        href="/sign-in"
      >
        {translate("signOut")}
      </Link>
    </div>
  );
}
