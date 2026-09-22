import { BadgeCheck, Calculator } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, MetricCard, PageHeading } from "@/components/ui/content";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { useNumber } from "@/i18n/use-number";

/**
 * Figma: ProgrammeManagerShell. Indicative estimates and verified outcomes stay in separate
 * panels so an estimate is never presented as a measured result.
 */
export function ManagementOverview() {
  const translate = useTranslations("screens.manager");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  return (
    <div className="space-y-5">
      <PageHeading>{translatePages("managementTitle")}</PageHeading>
      <SampleDataNote />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={translate("nodes")}
          value={translate("nodesValue", { count: number(342) })}
        />
        <MetricCard
          label={translate("volume")}
          tone="success"
          value={translate("volumeValue", { value: number(1429.4, 1) })}
        />
        <MetricCard
          label={translate("awaitingReceipt")}
          tone="warning"
          value={translate("batchesValue", { count: number(84) })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-warning flex items-center gap-2 text-lg font-bold">
              <Calculator aria-hidden="true" className="size-5" />
              {translate("estimatesTitle")}
            </h2>
            <p className="text-muted-foreground text-xs leading-5">{translate("estimatesText")}</p>
          </CardHeader>
          <CardContent>
            <DefinitionList>
              <DefinitionRow term={translate("copper")}>
                {translate("approx", { value: number(12.4, 1) })}
              </DefinitionRow>
              <DefinitionRow term={translate("yttrium")}>
                {translate("approx", { value: number(1.8, 1) })}
              </DefinitionRow>
            </DefinitionList>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-primary flex items-center gap-2 text-lg font-bold">
              <BadgeCheck aria-hidden="true" className="size-5" />
              {translate("verifiedTitle")}
            </h2>
            <p className="text-muted-foreground text-xs leading-5">{translate("verifiedText")}</p>
          </CardHeader>
          <CardContent>
            <DefinitionList>
              <DefinitionRow term={translate("disassembled")} tone="success">
                {translate("measured", { value: number(10.12, 2) })}
              </DefinitionRow>
              <DefinitionRow term={translate("glass")} tone="success">
                {translate("logged", { value: number(4.82, 2) })}
              </DefinitionRow>
            </DefinitionList>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
