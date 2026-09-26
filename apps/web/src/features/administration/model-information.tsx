import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading } from "@/components/ui/content";
import { Progress } from "@/components/ui/progress";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_MODEL } from "../samples";

/**
 * No Figma frame. `VisionResultSchema` carries a model version alongside every prediction, so
 * this names the version in use and the evaluation behind it. A prediction remains decision
 * support: a person confirms or corrects it before a category is stored.
 */
export function ModelInformation() {
  const translate = useTranslations("screens.model");
  const translateMl = useTranslations("screens.ml");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const date = useDate();
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeading>{translatePages("modelTitle")}</PageHeading>
      <SampleDataNote />

      <Card>
        <CardHeader>
          <h2 className="text-primary-dark text-sm font-bold">{translate("summary")}</h2>
        </CardHeader>
        <CardContent>
          <DefinitionList className="text-sm">
            <DefinitionRow term={translate("name")}>{translate("nameValue")}</DefinitionRow>
            <DefinitionRow term={translate("version")}>{SAMPLE_MODEL.version}</DefinitionRow>
            <DefinitionRow term={translate("trained")}>
              {date(SAMPLE_MODEL.trainedOn)}
            </DefinitionRow>
            <DefinitionRow term={translate("evaluated")}>
              {date(SAMPLE_MODEL.evaluatedOn)}
            </DefinitionRow>
            <DefinitionRow term={translate("images")}>
              {translate("imagesValue", { count: number(SAMPLE_MODEL.imageCount) })}
            </DefinitionRow>
          </DefinitionList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-primary-dark text-sm font-bold">{translate("precisionHeading")}</h2>
          <p className="text-muted-foreground text-xs leading-5">{translate("precisionNote")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {SAMPLE_MODEL.precisionByCategory.map((entry) => (
            <Progress
              key={entry.category}
              label={translateMl(`categories.${entry.category}`)}
              value={entry.value}
            />
          ))}
        </CardContent>
      </Card>

      <InfoPanel as="h2" title={translate("scopeTitle")} tone="warning">
        {translate("scopeText")}
      </InfoPanel>
    </div>
  );
}
