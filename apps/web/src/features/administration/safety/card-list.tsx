"use client";

import {
  EwasteCategorySchema,
  SupportedLanguageSchema,
  type SupportedLanguage,
} from "@scraptrace/contracts";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useSafetyCards } from "@/hooks/use-administration";
import { Link } from "@/i18n/navigation";
import { isExpiredSafetyCard, type SafetyCard } from "@/services/domain/safety-content";

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-neutral-subtle text-muted-foreground",
  approved: "bg-info-subtle text-info",
  published: "bg-success-subtle text-success-strong",
  archived: "bg-neutral-subtle text-muted-foreground",
};

/**
 * Safety-card list (FR-SAF-001, FR-SAF-002, FR-SAF-008).
 *
 * Every card shows its category, language, version, authoring status, source count, approval date,
 * review date and last update. Only a published, unexpired card can reach a collector, and an
 * expired published card is marked so it is not mistaken for current guidance.
 */
export function SafetyCardList() {
  const translate = useTranslations("screens.safety");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useSafetyCards();

  const [status, setStatus] = useState("all");
  const [language, setLanguage] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (card) =>
        (status === "all" || card.status === status) &&
        (language === "all" || card.language === language) &&
        (category === "all" || card.category === category) &&
        (term.length === 0 ||
          card.category.includes(term) ||
          card.answers.what_is_it.toLowerCase().includes(term)),
    );
  }, [category, language, query.data, search, status]);

  const columns: DataColumn<SafetyCard>[] = [
    {
      key: "category",
      header: translate("colCategory"),
      primary: true,
      cell: (card) => (
        <Link
          className="text-info font-bold underline-offset-2 hover:underline"
          href={`/administration/safety/cards/${card.card_id}`}
        >
          {labels.category(card.category)}
        </Link>
      ),
    },
    {
      key: "language",
      header: translate("colLanguage"),
      cell: (card) => (
        <span lang={card.language}>
          {labels.language(card.language)} ({card.language.toUpperCase()})
        </span>
      ),
    },
    { key: "version", header: translate("colVersion"), cell: (card) => card.version },
    {
      key: "status",
      header: translate("colStatus"),
      cell: (card) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <Badge className={STATUS_CLASS[card.status] ?? ""}>
            {labels.cardStatus(card.status)}
          </Badge>
          {isExpiredSafetyCard(card) ? (
            <Badge className="bg-danger-subtle text-danger">{translate("expired")}</Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "sources",
      header: translate("colSources"),
      cell: (card) => formats.number(card.sources.length, 0),
    },
    {
      key: "approval",
      header: translate("colApproval"),
      cell: (card) => card.approval_date ?? "—",
    },
    { key: "review", header: translate("colReview"), cell: (card) => card.review_date ?? "—" },
    {
      key: "updated",
      header: translate("colUpdated"),
      cell: (card) => formats.dateTime(card.updated_at) ?? "",
    },
    {
      key: "programme",
      header: translate("colProgramme"),
      cell: (card) => (
        <span className="text-muted-foreground font-mono text-[0.625rem]">
          {card.programme_id ? `${card.programme_id.slice(0, 8)}…` : translate("noProgramme")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading description={translate("description")}>
        {translatePages("safetyTitle")}
      </PageHeading>

      <Alert title={translate("governanceTitle")} tone="info">
        {translate("governanceNotice")}
      </Alert>

      <AsyncPanel query={query}>
        {(cards) => {
          const published = cards.filter((card) => card.status === "published");
          const drafts = cards.filter((card) => card.status === "draft");
          const expired = published.filter(isExpiredSafetyCard);
          const coverage = new Set(
            published
              .filter((card) => !isExpiredSafetyCard(card))
              .map((card) => `${card.category}:${card.language}`),
          ).size;
          const target =
            EwasteCategorySchema.options.length * SupportedLanguageSchema.options.length;

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={translate("publishedCount")}
                  tone="success"
                  value={formats.number(published.length, 0)}
                />
                <MetricCard
                  label={translate("draftCount")}
                  value={formats.number(drafts.length, 0)}
                />
                <MetricCard
                  label={translate("expiredCount")}
                  tone="danger"
                  value={formats.number(expired.length, 0)}
                />
                <MetricCard
                  label={translate("coverage")}
                  value={`${formats.number(coverage, 0)} / ${formats.number(target, 0)}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <FilterControl
                  label={translate("filterStatus")}
                  onChange={(event) => setStatus(event.target.value)}
                  options={[
                    { value: "all", label: translate("allStatuses") },
                    ...["draft", "approved", "published", "archived"].map((value) => ({
                      value,
                      label: labels.cardStatus(value),
                    })),
                  ]}
                  value={status}
                />
                <FilterControl
                  label={translate("filterLanguage")}
                  onChange={(event) => setLanguage(event.target.value)}
                  options={[
                    { value: "all", label: translate("allLanguages") },
                    ...SupportedLanguageSchema.options.map((value: SupportedLanguage) => ({
                      value,
                      label: labels.language(value),
                    })),
                  ]}
                  value={language}
                />
                <FilterControl
                  label={translate("filterCategory")}
                  onChange={(event) => setCategory(event.target.value)}
                  options={[
                    { value: "all", label: translate("allCategories") },
                    ...EwasteCategorySchema.options.map((value) => ({
                      value,
                      label: labels.category(value),
                    })),
                  ]}
                  value={category}
                />
                <SearchInput
                  className="min-w-48 flex-1 sm:ms-auto sm:max-w-xs"
                  label={translate("search")}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={translate("search")}
                  value={search}
                />
                <Link className={buttonVariants({})} href="/administration/safety/cards/new">
                  <Plus aria-hidden="true" className="size-4" />
                  {translate("newCard")}
                </Link>
              </div>

              <p className="text-muted-foreground text-xs" role="status">
                {translate("resultCount", { count: formats.number(rows.length, 0) })}
              </p>

              {rows.length === 0 ? (
                <p className="bg-surface text-muted-foreground rounded-md border p-4 text-sm">
                  {translate("noResults")}
                </p>
              ) : (
                <DataTable
                  caption={translate("tableCaption")}
                  columns={columns}
                  getRowId={(card) => card.card_id}
                  rows={rows}
                />
              )}
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
