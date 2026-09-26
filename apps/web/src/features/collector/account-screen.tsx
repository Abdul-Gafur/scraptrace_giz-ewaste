import { UserRoleSchema } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice-controls";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { Link } from "@/i18n/navigation";

const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
  pt: "Português",
};

/** Figma: account-privacy. */
export function AccountScreen() {
  const translate = useTranslations("screens.account");
  const translatePages = useTranslations("pages");
  const translateRoles = useTranslations("roles");
  const locale = useLocale();
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("profileTitle")}</PageHeading>

      <section aria-labelledby="identification" className="space-y-2">
        <SectionLabel>
          <span id="identification">{translate("identification")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList>
            <DefinitionRow term={translate("accountRole")} tone="success">
              {translateRoles(UserRoleSchema.enum.collector)}
            </DefinitionRow>
            <DefinitionRow term={translate("nodeId")}>ST-CN-88029</DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <section aria-labelledby="preferences" className="space-y-2">
        <SectionLabel>
          <span id="preferences">{translate("preferences")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList>
            <DefinitionRow term={translate("preferredLanguage")} tone="success">
              <span lang={locale}>
                {NATIVE_NAMES[locale]} ({locale.toUpperCase()})
              </span>
            </DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <section aria-labelledby="privacy" className="space-y-2">
        <SectionLabel>
          <span id="privacy">{translate("privacyControls")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4">
          <Switch label={translate("training")} />
        </div>
      </section>

      <section aria-labelledby="local-data" className="space-y-2">
        <SectionLabel tone="danger">
          <span id="local-data">{translate("localData")}</span>
        </SectionLabel>
        <Link
          className={buttonVariants({ variant: "destructiveOutline", block: true, size: "large" })}
          href="/collector/profile/clear-cache"
        >
          {translate("clear")}
        </Link>
        <p className="text-muted-foreground text-xs leading-5">{translate("clearHint")}</p>
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
