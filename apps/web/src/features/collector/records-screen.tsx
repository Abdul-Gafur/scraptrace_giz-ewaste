import { Camera, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { InfoPanel } from "@/components/ui/card";
import { ListItem, SectionHeading } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";

import { SAMPLE_RECORDS } from "../samples";

/** Figma: mobile-collector-en. */
export function RecordsScreen() {
  const translate = useTranslations("screens.records");
  const translatePages = useTranslations("pages");
  const translateHome = useTranslations("screens.collectorHome");
  const translateSamples = useTranslations("samples");
  const number = useNumber();
  return (
    <div className="max-w-2xl space-y-4">
      <div className="min-h-touch bg-surface flex items-center justify-between gap-3 rounded-md border p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <RefreshCw aria-hidden="true" className="text-primary size-5" />
          {translate("syncSummary", { count: number(SAMPLE_RECORDS.length) })}
        </p>
        <StatusBadge status="pending_synchronization" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <SectionHeading as="h1">{translatePages("recordsTitle")}</SectionHeading>
        <Link
          className="min-h-touch text-info inline-flex shrink-0 items-center text-xs font-bold underline-offset-2 hover:underline"
          href="/collector/locations"
        >
          {translate("viewMap")}
        </Link>
      </div>

      <ul className="space-y-2">
        {SAMPLE_RECORDS.map((record) => (
          <ListItem
            key={record.id}
            status={<StatusBadge status={record.status} />}
            subtitle={record.id}
            title={translateSamples(`${record.key}.name`)}
            value={translateSamples(`${record.key}.massLong`)}
          />
        ))}
      </ul>

      <InfoPanel as="h2" title={translate("safetyTitle")} tone="danger">
        {translate("safetyText")}
      </InfoPanel>

      <Link className={buttonVariants({ size: "large", block: true })} href="/collector/capture">
        <Camera aria-hidden="true" className="size-5" />
        {translateHome("captureAction")}
      </Link>
    </div>
  );
}
