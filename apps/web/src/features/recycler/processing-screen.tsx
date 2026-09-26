import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { Progress } from "@/components/ui/progress";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_PROCESSING } from "../samples";

/**
 * No Figma frame. Built from `ProcessingRequestSchema`: a batch in processing carries a
 * recovery method, the site doing the work and the evidence a completion needs. Recording the
 * outcome needs measured weight and a photograph, so it stays deferred.
 */
export function ProcessingScreen() {
  const translate = useTranslations("screens.processing");
  const translateMethods = useTranslations("screens.methods");
  const translatePages = useTranslations("pages");
  const translateSamples = useTranslations("samples");
  const number = useNumber();
  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("processingTitle")}</PageHeading>
      <SampleDataNote />

      <section aria-labelledby="processing-heading" className="space-y-2">
        <SectionLabel>
          <span id="processing-heading">
            {translate("heading", { count: number(SAMPLE_PROCESSING.length) })}
          </span>
        </SectionLabel>
        <ul className="grid gap-3 lg:grid-cols-2">
          {SAMPLE_PROCESSING.map((batch) => (
            <li key={batch.id}>
              <Card className="h-full">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-foreground text-sm font-bold">
                      {translateSamples(`${batch.key}.shortName`)}
                    </h2>
                    <StatusBadge status={batch.state} />
                  </div>
                  <p className="text-muted-foreground text-xs">{batch.id}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DefinitionList className="text-xs">
                    <DefinitionRow term={translate("methodLabel")}>
                      {translateMethods(batch.method)}
                    </DefinitionRow>
                    <DefinitionRow term={translate("operatorLabel")}>
                      {batch.operator}
                    </DefinitionRow>
                  </DefinitionList>
                  <Progress label={translate("progressLabel")} value={batch.progress} />
                  <DeferredActionButton
                    aria-label={translate("recordOutcomeFor", { id: batch.id })}
                    block
                    variant="secondary"
                  >
                    {translate("recordOutcome")}
                  </DeferredActionButton>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <InfoPanel as="h2" title={translate("evidenceTitle")} tone="warning">
        {translate("evidenceText")}
      </InfoPanel>
    </div>
  );
}
