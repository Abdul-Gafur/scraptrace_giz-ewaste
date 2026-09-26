import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/states";
import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_APPROVALS } from "../samples";

/**
 * No Figma frame. The safety contract serves approved cards only, and the governance rule is
 * that the administrator who wrote a card cannot approve it, so the queue names the author on
 * every card and keeps approval as a separate, deferred action.
 */
export function ApprovalQueue() {
  const translate = useTranslations("screens.approvals");
  const translateWorkflow = useTranslations("screens.workflow");
  const translatePages = useTranslations("pages");
  const translateCards = useTranslations("samples.safetyCards");
  const number = useNumber();
  const date = useDate();
  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("approvalsTitle")}</PageHeading>
      <SampleDataNote />

      <section aria-labelledby="approvals-heading" className="space-y-2">
        <SectionLabel>
          <span id="approvals-heading">
            {translate("heading", { count: number(SAMPLE_APPROVALS.length) })}
          </span>
        </SectionLabel>
        {SAMPLE_APPROVALS.length > 0 ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {SAMPLE_APPROVALS.map((approval) => (
              <li key={approval.card}>
                <Card className="h-full">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-foreground text-sm font-bold">
                        {translateCards(approval.card)}
                      </h3>
                      <ToneBadge tone="warning">{translateWorkflow("inReview")}</ToneBadge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <DefinitionList className="text-xs">
                      <DefinitionRow term={translate("submittedBy")}>
                        {approval.author}
                      </DefinitionRow>
                      <DefinitionRow term={translate("submittedOn")}>
                        {date(approval.submittedOn)}
                      </DefinitionRow>
                      <DefinitionRow term={translate("version")}>{approval.version}</DefinitionRow>
                    </DefinitionList>
                    <div className="flex flex-wrap gap-2">
                      <DeferredActionButton
                        aria-label={translate("approveCard", {
                          card: translateCards(approval.card),
                        })}
                      >
                        {translate("approve")}
                      </DeferredActionButton>
                      <DeferredActionButton
                        aria-label={translate("requestChangesCard", {
                          card: translateCards(approval.card),
                        })}
                        variant="secondary"
                      >
                        {translate("requestChanges")}
                      </DeferredActionButton>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description={translate("emptyDescription")} title={translate("emptyTitle")} />
        )}
      </section>

      <InfoPanel as="h2" title={translate("separationTitle")} tone="warning">
        {translate("separationText")}
      </InfoPanel>
    </div>
  );
}
