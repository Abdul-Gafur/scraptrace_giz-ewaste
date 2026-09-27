"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { ListItem, MetricCard, PageHeading, SectionLabel } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useSafetyCards } from "@/hooks/use-administration";
import { Link } from "@/i18n/navigation";
import { isExpiredSafetyCard } from "@/services/domain/safety-content";

/**
 * Approval queue: drafts waiting for a named approver, cards approved but not yet current, and
 * published cards whose review date has passed and which therefore no longer reach collectors.
 */
export function SafetyApprovalsScreen() {
  const translate = useTranslations("screens.safetyApprovals");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useSafetyCards();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <AsyncPanel query={query}>
        {(cards) => {
          const drafts = cards.filter((card) => card.status === "draft");
          const approved = cards.filter((card) => card.status === "approved");
          const expired = cards.filter(isExpiredSafetyCard);

          const list = (heading: string, id: string, rows: typeof cards, emptyKey: string) => (
            <section aria-labelledby={id} className="space-y-2">
              <SectionLabel>
                <span id={id}>
                  {heading} ({formats.number(rows.length, 0)})
                </span>
              </SectionLabel>
              {rows.length === 0 ? (
                <p className="bg-surface text-muted-foreground rounded-md border p-4 text-xs">
                  {translate(emptyKey)}
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((card) => (
                    <ListItem
                      href={`/administration/safety/cards/${card.card_id}`}
                      key={card.card_id}
                      status={<Badge>{labels.cardStatus(card.status)}</Badge>}
                      subtitle={`${labels.language(card.language)} · ${card.version}`}
                      title={labels.category(card.category)}
                      {...(card.review_date ? { value: card.review_date } : {})}
                    />
                  ))}
                </ul>
              )}
            </section>
          );

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={translate("draftCount")}
                  value={formats.number(drafts.length, 0)}
                />
                <MetricCard
                  label={translate("approvedCount")}
                  tone="info"
                  value={formats.number(approved.length, 0)}
                />
                <MetricCard
                  label={translate("expiredCount")}
                  tone="danger"
                  value={formats.number(expired.length, 0)}
                />
              </div>
              {list(translate("draftsHeading"), "drafts-heading", drafts, "noDrafts")}
              {list(translate("approvedHeading"), "approved-heading", approved, "noApproved")}
              {list(translate("expiredHeading"), "expired-heading", expired, "noExpired")}
              <Link
                className="text-info min-h-touch inline-flex items-center text-sm font-bold underline-offset-2 hover:underline"
                href="/administration/safety/cards/new"
              >
                {translate("newCard")}
              </Link>
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
