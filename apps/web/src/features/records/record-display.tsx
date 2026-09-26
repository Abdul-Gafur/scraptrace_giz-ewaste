"use client";

import type { RecoveryRecord } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { ListItem } from "@/components/ui/content";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNumber } from "@/i18n/use-number";

/** One record as a list row, used by the collector and by the receiving facility. */
export function RecordListItem({
  record,
  href,
  showSync = true,
}: {
  record: RecoveryRecord;
  href?: string;
  showSync?: boolean;
}) {
  const translate = useTranslations("record");
  const translateCategories = useTranslations("categories");
  const number = useNumber();
  const weight = record.handoff?.measured_weight ?? record.approximate_weight;
  return (
    <ListItem
      {...(href ? { href } : {})}
      status={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={record.business_state} />
          {showSync ? <StatusBadge status={record.sync.sync_state} /> : null}
        </span>
      }
      subtitle={record.human_reference}
      title={translateCategories(record.category)}
      {...(weight
        ? {
            value: translate("weightValue", {
              value: number(weight.value, weight.value % 1 === 0 ? 0 : 1),
              unit: weight.unit,
            }),
          }
        : {})}
    />
  );
}
