"use client";

import { RecoveryRecordStateSchema } from "@scraptrace/contracts";
import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ListItem, SectionHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { SearchInput } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOwnRecords } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";

/** The collector's own records, searchable and filterable by lifecycle state (Figma: mobile-collector-en). */
export function RecordsScreen() {
  const translate = useTranslations("screens.records");
  const translatePages = useTranslations("pages");
  const translateStatus = useTranslations("status");
  const translateHome = useTranslations("screens.collectorHome");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const query = useOwnRecords();
  const [state, setState] = useState("all");
  const [search, setSearch] = useState("");

  const records = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (record) =>
        (state === "all" || record.business_state === state) &&
        (term.length === 0 ||
          record.human_reference.toLowerCase().includes(term) ||
          record.category.includes(term)),
    );
  }, [query.data, search, state]);

  const pending = (query.data ?? []).filter(
    (record) => record.sync.sync_state !== "synchronized",
  ).length;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="min-h-touch bg-surface flex items-center justify-between gap-3 rounded-md border p-4">
        <p className="text-sm font-bold">
          {translate("syncSummary", { count: formats.number(pending, 0) })}
        </p>
        <StatusBadge status={pending > 0 ? "pending_synchronization" : "synchronized"} />
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

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterState")}
          onChange={(event) => setState(event.target.value)}
          options={[
            { value: "all", label: translate("allStates") },
            ...RecoveryRecordStateSchema.options.map((value) => ({
              value,
              label: translateStatus(value),
            })),
          ]}
          value={state}
        />
        <SearchInput
          className="min-w-48 flex-1"
          label={translate("search")}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={translate("search")}
          value={search}
        />
      </div>

      <AsyncPanel
        emptyDescription={translate("emptyDescription")}
        isEmpty={() => records.length === 0}
        query={query}
      >
        {() => (
          <ul className="space-y-2">
            {records.map((record) => {
              const weight = record.handoff?.measured_weight ?? record.approximate_weight;
              return (
                <ListItem
                  href={`/collector/records/${record.record_id}`}
                  key={record.record_id}
                  status={<StatusBadge status={record.business_state} />}
                  subtitle={record.human_reference}
                  title={labels.category(record.category)}
                  {...(weight ? { value: `${formats.number(toKilograms(weight), 1)} kg` } : {})}
                />
              );
            })}
          </ul>
        )}
      </AsyncPanel>

      <Link className={buttonVariants({ size: "large", block: true })} href="/collector/capture">
        <Camera aria-hidden="true" className="size-5" />
        {translateHome("captureAction")}
      </Link>
    </div>
  );
}
