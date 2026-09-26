"use client";

import { UserRoleSchema } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice-controls";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { useConsent, useProgrammeMutation, useSession } from "@/services/queries";

/** Figma: account-privacy. The training-reuse choice and the sign-out are both real here. */
export function AccountScreen() {
  const translate = useTranslations("screens.account");
  const translatePages = useTranslations("pages");
  const translateRoles = useTranslations("roles");
  const translateLanguages = useTranslations("languages");
  const locale = useLocale();
  const router = useRouter();
  const { show } = useToast();
  const { data: session } = useSession();
  const { data: consent } = useConsent();

  const setConsent = useProgrammeMutation((services, value: boolean) =>
    services.consent.set(value),
  );
  const signOut = useProgrammeMutation((services) => services.authentication.signOut());

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
              {translateRoles(session?.role ?? UserRoleSchema.enum.collector)}
            </DefinitionRow>
            <DefinitionRow term={translate("nodeId")}>
              {session ? `ST-CN-${session.actorId.slice(-5).toUpperCase()}` : "—"}
            </DefinitionRow>
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
              {translateLanguages(locale)}
            </DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <section aria-labelledby="privacy" className="space-y-2">
        <SectionLabel>
          <span id="privacy">{translate("privacyControls")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4">
          <Switch
            checked={consent?.trainingReuse ?? false}
            label={translate("training")}
            onChange={async (event) => {
              await setConsent.mutateAsync(event.target.checked);
              show({ title: translate("trainingSaved"), tone: "success" });
            }}
          />
        </div>
        <p className="text-muted-foreground text-xs leading-5">{translate("trainingHint")}</p>
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

      <Button
        block
        loading={signOut.isPending}
        onClick={async () => {
          await signOut.mutateAsync(undefined);
          router.push("/sign-in");
        }}
        size="large"
        variant="secondary"
      >
        {translate("signOut")}
      </Button>
    </div>
  );
}
