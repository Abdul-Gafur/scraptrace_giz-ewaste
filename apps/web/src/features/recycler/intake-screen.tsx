import { CircleCheck, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DeferredActionButton } from "@/components/ui/deferred-action-button";
import { EvidencePlaceholder } from "@/components/ui/evidence-placeholder";
import { DefinitionList, DefinitionRow, PageHeading } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";

/** Figma: mobile-recycler-en. QR rendering and evidence photos arrive with the handoff milestone. */
export function IntakeScreen() {
  const translate = useTranslations("screens.recyclerIntake");
  const translatePages = useTranslations("pages");
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("recyclerTitle")}</PageHeading>

      <Card>
        <CardHeader className="text-center">
          <h2 className="text-primary-dark text-lg font-bold">{translate("scanTitle")}</h2>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="bg-surface-subtle text-foreground grid size-36 place-items-center rounded-md"
          >
            <QrCode className="size-20" strokeWidth={1.25} />
          </div>
          <p className="text-muted-foreground max-w-xs text-xs leading-5">
            {translate("scanText")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-bold">{translate("evidenceTitle")}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <EvidencePlaceholder label={translate("photoPlaceholder")} />
          <DefinitionList className="text-xs">
            <DefinitionRow term={translate("gps")}>
              <StatusBadge status="verified_gps" />
            </DefinitionRow>
            <DefinitionRow term={translate("timestamp")}>
              {translate("timestampValue")}
            </DefinitionRow>
          </DefinitionList>
        </CardContent>
      </Card>

      <DeferredActionButton block size="large">
        <CircleCheck aria-hidden="true" className="size-5" />
        {translate("approve")}
      </DeferredActionButton>
    </div>
  );
}
