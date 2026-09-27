"use client";

import type { RecoveryRecord } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { DefinitionList, DefinitionRow } from "@/components/ui/content";
import { RecordStatus } from "@/components/ui/record-status";

import { useContractLabels } from "./contract-labels";
import { useValueFormats } from "./formats";

/**
 * The identity block every role sees for a record: its reference, what it is, and where it is in
 * the lifecycle. The reference is a stable identifier and is never translated.
 */
export function RecordIdentity({
  record,
  showSync = true,
}: {
  record: RecoveryRecord;
  showSync?: boolean;
}) {
  const translate = useTranslations("record");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const declared = formats.weight(record.approximate_weight);
  return (
    <DefinitionList>
      <DefinitionRow term={translate("reference")}>
        <span className="font-mono">{record.human_reference}</span>
      </DefinitionRow>
      <DefinitionRow term={translate("category")}>{labels.category(record.category)}</DefinitionRow>
      <DefinitionRow term={translate("kind")}>
        {labels.recordKind(record.record_kind)}
        {record.item_count === undefined ? null : ` · ${formats.number(record.item_count, 0)}`}
      </DefinitionRow>
      <DefinitionRow term={translate("condition")}>
        {labels.condition(record.condition)}
      </DefinitionRow>
      {declared ? (
        <DefinitionRow term={translate("declaredWeight")}>{declared}</DefinitionRow>
      ) : null}
      <DefinitionRow term={translate("capturedAt")}>
        {formats.dateTime(record.captured_at)}
      </DefinitionRow>
      <DefinitionRow term={translate("area")}>{record.approximate_area.label}</DefinitionRow>
      <DefinitionRow term={translate("state")}>
        <RecordStatus
          state={record.business_state}
          {...(showSync ? { synchronization: record.sync.sync_state } : {})}
        />
      </DefinitionRow>
    </DefinitionList>
  );
}
