"use client";

import { getLanguageDirection } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useSafetyCards } from "@/hooks/use-administration";
import { Link } from "@/i18n/navigation";
import { SAFETY_QUESTION_KEYS, isServableSafetyCard } from "@/services/domain/safety-content";

/**
 * Published content: exactly what a collector can be served right now, plus the archived versions
 * kept behind it so approved history is never overwritten.
 */
export function SafetyPublishedScreen() {
  const translate = useTranslations("screens.safetyPublished");
  const translateQuestions = useTranslations("safetyQuestions");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useSafetyCards();

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <AsyncPanel query={query}>
        {(cards) => {
          const servable = cards.filter(isServableSafetyCard);
          const archived = cards.filter((card) => card.status === "archived");
          return (
            <>
              <p className="text-muted-foreground text-xs" role="status">
                {translate("servableCount", { count: formats.number(servable.length, 0) })}
              </p>

              {servable.length === 0 ? (
                <Alert title={translate("noneTitle")} tone="warning">
                  {translate("noneNotice")}
                </Alert>
              ) : (
                <ul className="space-y-3">
                  {servable.map((card) => (
                    <li key={card.card_id}>
                      <Card>
                        <CardHeader className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-primary-dark text-lg font-bold">
                              {labels.category(card.category)}
                            </h2>
                            <span className="flex flex-wrap gap-2">
                              <Badge className="bg-success-subtle text-success-strong">
                                {labels.cardStatus(card.status)}
                              </Badge>
                              <Badge>{card.language.toUpperCase()}</Badge>
                              <Badge>{card.version}</Badge>
                            </span>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {translate("approvedLine", {
                              approver: card.approved_by ?? "",
                              approval: card.approval_date ?? "",
                              review: card.review_date ?? "",
                            })}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <details>
                            <summary className="text-muted-foreground min-h-touch cursor-pointer text-xs">
                              {translate("showAnswers")}
                            </summary>
                            <ol
                              className="mt-2 space-y-2"
                              dir={getLanguageDirection(card.language)}
                              lang={card.language}
                            >
                              {SAFETY_QUESTION_KEYS.map((key) => (
                                <li className="bg-surface-subtle rounded-sm p-2" key={key}>
                                  <p className="text-xs font-bold">{translateQuestions(key)}</p>
                                  <p className="mt-1 text-sm leading-6">{card.answers[key]}</p>
                                </li>
                              ))}
                            </ol>
                          </details>
                          <Link
                            className="text-info min-h-touch inline-flex items-center text-xs font-bold underline-offset-2 hover:underline"
                            href={`/administration/safety/cards/${card.card_id}`}
                          >
                            {translate("openCard")}
                          </Link>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}

              <section aria-labelledby="archived-heading" className="space-y-2">
                <h2
                  className="text-muted-foreground text-xs font-bold uppercase"
                  id="archived-heading"
                >
                  {translate("archivedHeading", { count: formats.number(archived.length, 0) })}
                </h2>
                {archived.length === 0 ? (
                  <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
                    {translate("noArchived")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {archived.map((card) => (
                      <li
                        className="bg-surface flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                        key={card.card_id}
                      >
                        <span>
                          {labels.category(card.category)} · {labels.language(card.language)} ·{" "}
                          {card.version}
                        </span>
                        <Link
                          className="text-info text-xs font-bold underline-offset-2 hover:underline"
                          href={`/administration/safety/cards/${card.card_id}`}
                        >
                          {translate("openCard")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
