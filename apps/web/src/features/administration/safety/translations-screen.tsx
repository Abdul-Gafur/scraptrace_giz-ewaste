"use client";

import {
  EwasteCategorySchema,
  SupportedLanguageSchema,
  type EwasteCategory,
} from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useSafetyCards } from "@/hooks/use-administration";
import { Link } from "@/i18n/navigation";
import { buildSafetyCoverage } from "@/services/domain/safety-content";

const CELL_CLASS: Record<string, string> = {
  published: "bg-success-subtle text-success-strong",
  approved: "bg-info-subtle text-info",
  draft: "bg-neutral-subtle text-muted-foreground",
  archived: "bg-neutral-subtle text-muted-foreground",
  missing: "bg-danger-subtle text-danger",
};

/**
 * Translation coverage (FR-SAF-009).
 *
 * The grid shows, for every category and language, whether current approved guidance exists. A
 * missing translation is shown as missing: English is never presented in place of another language,
 * and a collector requesting an uncovered language receives the approved fallback instead.
 */
export function SafetyTranslationsScreen() {
  const translate = useTranslations("screens.safetyTranslations");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useSafetyCards();
  const languages = SupportedLanguageSchema.options;

  return (
    <div className="space-y-4">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <Alert title={translate("policyTitle")} tone="info">
        {translate("policyNotice")}
      </Alert>

      <AsyncPanel query={query} skeletonRows={3}>
        {(cards) => {
          const coverage = buildSafetyCoverage(cards, languages);
          const missing = coverage.filter((cell) => cell.status !== "published");
          const cellFor = (category: EwasteCategory, language: string) =>
            coverage.find((cell) => cell.category === category && cell.language === language);

          return (
            <>
              <p className="text-muted-foreground text-xs" role="status">
                {translate("missingCount", { count: formats.number(missing.length, 0) })}
              </p>

              <div
                aria-label={translate("tableCaption")}
                className="bg-surface overflow-x-auto rounded-md border"
                role="region"
                tabIndex={0}
              >
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">{translate("tableCaption")}</caption>
                  <thead className="bg-background">
                    <tr>
                      <th className="border-b p-3 text-start font-bold" scope="col">
                        {translate("colCategory")}
                      </th>
                      {languages.map((language) => (
                        <th
                          className="border-b p-3 text-start font-bold"
                          key={language}
                          scope="col"
                        >
                          {labels.language(language)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EwasteCategorySchema.options.map((category) => (
                      <tr className="border-b last:border-b-0" key={category}>
                        <th className="p-3 text-start font-semibold" scope="row">
                          {labels.category(category)}
                        </th>
                        {languages.map((language) => {
                          const cell = cellFor(category, language);
                          const status = cell?.status ?? "missing";
                          return (
                            <td className="p-3" key={language}>
                              <Badge className={CELL_CLASS[status] ?? ""}>
                                {status === "missing"
                                  ? translate("missing")
                                  : labels.cardStatus(status)}
                              </Badge>
                              {cell?.expired ? (
                                <span className="text-danger ms-1 text-[0.625rem] font-bold">
                                  {translate("expired")}
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Link
                className="text-info min-h-touch inline-flex items-center text-sm font-bold underline-offset-2 hover:underline"
                href="/administration/safety/cards/new"
              >
                {translate("addTranslation")}
              </Link>
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
