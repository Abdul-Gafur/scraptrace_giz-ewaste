import { useTranslations } from "next-intl";

import { InfoPanel } from "@/components/ui/card";
import { MetricCard, PageHeading } from "@/components/ui/content";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_PUBLISHED, type SamplePublishedCard } from "../samples";

/**
 * No Figma frame. An approved card carries an approval date and a review date, and stops
 * being served as approved guidance once the review date passes, so both are columns here.
 */
export function PublishedContent() {
  const translate = useTranslations("screens.published");
  const translatePages = useTranslations("pages");
  const translateCards = useTranslations("samples.safetyCards");
  const number = useNumber();
  const date = useDate();

  const languages = Math.max(...SAMPLE_PUBLISHED.map((card) => card.languages));

  const columns: DataColumn<SamplePublishedCard>[] = [
    {
      key: "card",
      header: translate("colCard"),
      primary: true,
      cell: (row) => translateCards(row.card),
    },
    { key: "version", header: translate("colVersion"), cell: (row) => row.version },
    {
      key: "languages",
      header: translate("colLanguages"),
      cell: (row) => <span className="text-primary font-bold">{number(row.languages)}</span>,
    },
    {
      key: "published",
      header: translate("colPublished"),
      cell: (row) => <span className="font-normal">{date(row.publishedOn)}</span>,
    },
    {
      key: "review",
      header: translate("colReview"),
      cell: (row) => <span className="text-warning font-semibold">{date(row.reviewOn)}</span>,
    },
    {
      key: "actions",
      header: translate("colActions"),
      align: "end",
      cell: (row) => (
        <DeferredActionButton
          aria-label={translate("viewCard", { card: translateCards(row.card) })}
          variant="secondary"
        >
          {translate("view")}
        </DeferredActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("publishedTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label={translate("live")}
          tone="success"
          value={translate("liveValue", { count: number(SAMPLE_PUBLISHED.length) })}
        />
        <MetricCard
          label={translate("languagesCovered")}
          value={translate("languagesValue", { count: number(languages) })}
        />
      </div>

      <DataTable
        caption={translate("tableCaption")}
        columns={columns}
        getRowId={(row) => row.card}
        rows={SAMPLE_PUBLISHED}
      />

      <InfoPanel as="h2" title={translate("reviewTitle")} tone="warning">
        {translate("reviewText")}
      </InfoPanel>
    </div>
  );
}
