"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/states";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/content";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { useNumber } from "@/i18n/use-number";
import { useOwnRecords } from "@/services/queries";

import { RecordListItem } from "../records/record-display";
import { OutboxPanel } from "./outbox-panel";

/** Figma: mobile-collector-en, over the records this device holds. */
export function RecordsScreen() {
  const translate = useTranslations("screens.records");
  const translatePages = useTranslations("pages");
  const translateHome = useTranslations("screens.collectorHome");
  const number = useNumber();
  const { data: records, isPending } = useOwnRecords();

  const unsynchronized = (records ?? []).filter(
    (record) => record.sync.sync_state !== "synchronized",
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="min-h-touch bg-surface flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
        <p className="text-sm font-bold">
          {translate("syncSummary", { count: number(unsynchronized.length) })}
        </p>
        <StatusBadge
          status={unsynchronized.length > 0 ? "pending_synchronization" : "synchronized"}
        />
      </div>

      <OutboxPanel />

      <div className="flex items-center justify-between gap-3">
        <SectionHeading as="h1">{translatePages("recordsTitle")}</SectionHeading>
        <Link
          className="min-h-touch text-info inline-flex shrink-0 items-center text-xs font-bold underline-offset-2 hover:underline"
          href="/collector/locations"
        >
          {translate("viewMap")}
        </Link>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : records && records.length > 0 ? (
        <ul className="space-y-2">
          {records.map((record) => (
            <RecordListItem
              href={`/collector/records/${record.record_id}`}
              key={record.record_id}
              record={record}
            />
          ))}
        </ul>
      ) : (
        <EmptyState />
      )}

      <Link className={buttonVariants({ size: "large", block: true })} href="/collector/capture">
        <Camera aria-hidden="true" className="size-5" />
        {translateHome("captureAction")}
      </Link>
    </div>
  );
}
