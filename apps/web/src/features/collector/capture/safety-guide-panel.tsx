"use client";

import {
  getLanguageDirection,
  type EwasteCategory,
  type SupportedLanguage,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DefinitionList, DefinitionRow } from "@/components/ui/content";
import { Skeleton } from "@/components/ui/skeleton";
import { useSafetyGuidance } from "@/hooks/use-administration";
import { SAFETY_QUESTION_KEYS } from "@/services/domain/safety-content";

/**
 * Approved safety guidance for the confirmed category (FR-SAF-006, FR-SAF-007, FR-SAF-008).
 *
 * Only approved content is displayed. When no approved card exists for the category and language,
 * the approved fallback and referral are shown instead, and no guidance text is generated. The
 * card's version, sources, approval date and review date are always reachable.
 */
export function SafetyGuidePanel({
  category,
  language,
}: {
  category: EwasteCategory | undefined;
  language: SupportedLanguage;
}) {
  const translate = useTranslations("safety");
  const translateQuestions = useTranslations("safetyQuestions");
  const query = useSafetyGuidance(category, language);

  if (!category) {
    return <p className="text-muted-foreground text-xs">{translate("selectCategoryFirst")}</p>;
  }
  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError || !query.data) {
    return (
      <Alert title={translate("unavailableTitle")} tone="warning">
        {translate("unavailableFallback")}
      </Alert>
    );
  }

  const guidance = query.data;
  if (guidance.outcome === "safe_fallback") {
    return (
      <Alert title={translate("fallbackTitle")} tone="danger">
        <p>{translate("fallbackAdvice")}</p>
        <p className="mt-1 font-semibold">{translate("fallbackReferral")}</p>
        <p className="mt-1">{translate(`fallbackReason.${guidance.reason}`)}</p>
      </Alert>
    );
  }

  const direction = getLanguageDirection(guidance.language.language);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-success-subtle text-success-strong">
          {translate("approvedBadge")}
        </Badge>
        <Badge>{guidance.language.language.toUpperCase()}</Badge>
        <Badge>{translate("version", { version: guidance.safety_card_version })}</Badge>
      </div>
      <ol className="space-y-3" dir={direction} lang={guidance.language.language}>
        {SAFETY_QUESTION_KEYS.map((key) => (
          <li className="bg-surface rounded-md border p-3" key={key}>
            <p className="text-primary-dark text-sm font-bold">{translateQuestions(key)}</p>
            <p className="text-foreground mt-1 text-sm leading-6">{guidance.answers[key]}</p>
          </li>
        ))}
      </ol>
      <details>
        <summary className="text-muted-foreground min-h-touch cursor-pointer text-xs">
          {translate("metadataSummary")}
        </summary>
        <DefinitionList className="mt-2 text-xs">
          <DefinitionRow term={translate("approvalDate")}>{guidance.approval_date}</DefinitionRow>
          <DefinitionRow term={translate("reviewDate")}>{guidance.review_date}</DefinitionRow>
          <DefinitionRow term={translate("aiAssisted")}>
            {translate(guidance.ai_assisted ? "aiAssistedYes" : "aiAssistedNo")}
          </DefinitionRow>
        </DefinitionList>
        <p className="text-muted-foreground mt-2 text-xs font-semibold">{translate("sources")}</p>
        <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
          {guidance.source_references.map((reference) => (
            <li key={reference}>{reference}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
