"use client";

import type { EwasteCategory, SupportedLanguage } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";

import { InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow } from "@/components/ui/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useSafetyGuidance } from "@/services/queries";

/**
 * Approved safety guidance for one category, in the reader's language.
 *
 * Only an approved card in that language is shown as guidance. Anything else renders the
 * service's safe fallback, which refers the reader to a person instead of inventing advice.
 */
export function SafetyGuidancePanel({ category }: { category: EwasteCategory }) {
  const translate = useTranslations("screens.safetyGuidance");
  const locale = useLocale() as SupportedLanguage;
  const { data, isPending } = useSafetyGuidance(category, locale);

  if (isPending) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;

  if (data.outcome === "safe_fallback") {
    return (
      <InfoPanel as="h2" title={translate("fallbackTitle")} tone="warning">
        <p>{data.message}</p>
        <p className="mt-2 font-bold">{data.referral}</p>
      </InfoPanel>
    );
  }

  return (
    <InfoPanel as="h2" title={translate("title")} tone="danger">
      <DefinitionList className="text-xs">
        <DefinitionRow term={translate("whatIsIt")}>{data.answers.what_is_it}</DefinitionRow>
        <DefinitionRow term={translate("dangers")}>{data.answers.possible_dangers}</DefinitionRow>
        <DefinitionRow term={translate("prohibited")}>
          {data.answers.prohibited_actions}
        </DefinitionRow>
        <DefinitionRow term={translate("safeActions")}>
          {data.answers.safe_actions_now}
        </DefinitionRow>
        <DefinitionRow term={translate("destination")}>
          {data.answers.suitable_destination}
        </DefinitionRow>
      </DefinitionList>
      <p className="text-muted-foreground mt-2">
        {translate("provenance", {
          version: data.safety_card_version,
          approved: data.approval_date,
          review: data.review_date,
        })}
      </p>
    </InfoPanel>
  );
}
