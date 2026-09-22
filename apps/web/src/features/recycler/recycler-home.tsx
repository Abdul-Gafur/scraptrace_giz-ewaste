import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

import { InfoPanel } from "@/components/ui/card";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import {
  DefinitionList,
  DefinitionRow,
  ListItem,
  PageHeading,
  SectionLabel,
} from "@/components/ui/content";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNumber } from "@/i18n/use-number";

/** Figma: recycler-home. */
export function RecyclerHome() {
  const translate = useTranslations("screens.recyclerHome");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("recyclerTitle")}</PageHeading>

      <section
        aria-labelledby="verify-heading"
        className="border-primary bg-surface rounded-md border-2 p-4"
      >
        <h2
          className="text-primary-dark flex items-center gap-2 text-lg font-bold"
          id="verify-heading"
        >
          <QrCode aria-hidden="true" className="text-primary size-5" />
          {translate("verifyTitle")}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{translate("verifyText")}</p>
        <div className="mt-4 flex gap-2">
          <Input
            aria-label={translate("codeLabel")}
            autoComplete="off"
            className="min-w-0 flex-1"
            placeholder={translate("codePlaceholder")}
          />
          <DeferredActionButton>{translate("apply")}</DeferredActionButton>
        </div>
      </section>

      <section aria-labelledby="pending-heading" className="space-y-2">
        <SectionLabel>
          <span id="pending-heading">{translate("pendingHeading", { count: number(2) })}</span>
        </SectionLabel>
        <ul>
          <ListItem
            status={<StatusBadge status="under_review" />}
            subtitle={translate("batchText")}
            title={translate("batchTitle")}
          />
        </ul>
      </section>

      <InfoPanel as="h2" title={translate("authorityTitle")} tone="success">
        <DefinitionList>
          <DefinitionRow term={translate("siteId")}>RY-9921-EM</DefinitionRow>
          <DefinitionRow term={translate("totalWeight")} tone="success">
            {translate("weightValue", { value: number(142.8) })}
          </DefinitionRow>
        </DefinitionList>
      </InfoPanel>
    </div>
  );
}
