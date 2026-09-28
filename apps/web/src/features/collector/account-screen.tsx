"use client";

import { UserRoleSchema } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useValueFormats } from "@/features/shared/formats";
import { useLocalDataSummary } from "@/hooks/use-local-data";
import { Link } from "@/i18n/navigation";
import { useActingIdentity } from "@/hooks/use-identity";

const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
  pt: "Português",
};

/** Collector account, language and device-data controls (Figma: account-privacy). */
export function AccountScreen() {
  const translate = useTranslations("screens.account");
  const identity = useActingIdentity();
  const translatePages = useTranslations("pages");
  const translateRoles = useTranslations("roles");
  const formats = useValueFormats();
  const locale = useLocale();
  const summaryQuery = useLocalDataSummary();

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
            <DefinitionRow term={translate("nodeId")}>
              <span className="font-mono text-xs">{identity.actorId}</span>
            </DefinitionRow>
          </DefinitionList>
        </div>
        <p className="text-muted-foreground text-xs leading-5">{translate("identifierNotice")}</p>
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

      <section aria-labelledby="local-data" className="space-y-2">
        <SectionLabel tone="danger">
          <span id="local-data">{translate("localData")}</span>
        </SectionLabel>
        <AsyncPanel query={summaryQuery} skeletonRows={1}>
          {(summary) => (
            <div className="bg-surface rounded-md border px-4 py-2">
              <DefinitionList>
                <DefinitionRow term={translate("storedRecords")}>
                  {formats.number(summary.records, 0)}
                </DefinitionRow>
                <DefinitionRow term={translate("storedDrafts")}>
                  {formats.number(summary.drafts, 0)}
                </DefinitionRow>
                <DefinitionRow
                  term={translate("storageDurability")}
                  tone={summary.durable ? "success" : "warning"}
                >
                  {translate(summary.durable ? "durable" : "notDurable")}
                </DefinitionRow>
              </DefinitionList>
            </div>
          )}
        </AsyncPanel>
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
