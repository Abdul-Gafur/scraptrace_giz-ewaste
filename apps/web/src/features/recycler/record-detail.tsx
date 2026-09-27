"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { DefinitionList, DefinitionRow, PageHeading } from "@/components/ui/content";
import { Tabs } from "@/components/ui/tabs";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidencePanel } from "@/features/shared/evidence-panel";
import { FlagPanel } from "@/features/shared/flag-panel";
import { useValueFormats } from "@/features/shared/formats";
import { RecordIdentity } from "@/features/shared/record-identity";
import { RecordTimeline } from "@/features/shared/record-timeline";
import { useRecord, useRecordEvents, useRecordEvidence } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";
import { isTerminal } from "@/services/domain/records";
import { findLocationName } from "@/services/local/location-directory";

/**
 * One record as the receiving facility sees it.
 *
 * The next step is always stated: record processing when the record has been received, or nothing
 * to do when it is complete or already decided. A decided record is read-only.
 */
export function RecyclerRecordDetail({ recordId }: { recordId: string }) {
  const translate = useTranslations("record");
  const translateScreen = useTranslations("screens.recyclerRecords");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const recordQuery = useRecord(recordId);
  const eventsQuery = useRecordEvents(recordId);
  const evidenceQuery = useRecordEvidence(recordId);

  return (
    <div className="max-w-3xl space-y-4">
      <AsyncPanel isEmpty={(record) => record === null} query={recordQuery}>
        {(record) => {
          if (!record) return null;
          const canProcess = record.business_state === "received";
          const recovered = (record.processing?.material_entries ?? []).reduce(
            (total, entry) => total + toKilograms(entry.weight),
            0,
          );
          return (
            <>
              <PageHeading eyebrow={record.human_reference}>
                {labels.category(record.category)}
              </PageHeading>

              <FlagPanel flagCodes={record.review.flag_codes} />

              {canProcess ? (
                <Link
                  className={buttonVariants({ block: true, size: "large" })}
                  href={`/recycler/records/${record.record_id}/processing`}
                >
                  {translateScreen("recordProcessing")}
                </Link>
              ) : isTerminal(record) ? (
                <Alert title={translate("terminalTitle")} tone="info">
                  {translate("terminalNotice")}
                </Alert>
              ) : (
                <Alert title={translate("nextStepTitle")} tone="info">
                  {translate(`nextStep.${record.business_state}`)}
                </Alert>
              )}

              <Tabs
                items={[
                  {
                    id: "summary",
                    label: translate("tabSummary"),
                    content: (
                      <div className="space-y-4">
                        <div className="bg-surface rounded-md border px-4 py-2">
                          <RecordIdentity record={record} showSync={false} />
                        </div>
                        {record.handoff ? (
                          <div className="bg-surface rounded-md border px-4 py-2">
                            <DefinitionList>
                              <DefinitionRow term={translate("receivedAt")}>
                                {formats.dateTime(record.handoff.server_received_at)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("receivingLocation")}>
                                {findLocationName(record.handoff.receiving_location_id) ??
                                  translate("unknownLocation")}
                              </DefinitionRow>
                              <DefinitionRow term={translate("confirmedCategory")}>
                                {labels.category(record.handoff.confirmed_category)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("measuredWeight")} tone="success">
                                {formats.weight(record.handoff.measured_weight)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("finalPrice")}>
                                {formats.currency(
                                  record.handoff.final_price.amount,
                                  record.handoff.final_price.currency,
                                )}
                              </DefinitionRow>
                            </DefinitionList>
                          </div>
                        ) : null}
                        {record.processing ? (
                          <div className="bg-surface rounded-md border px-4 py-2">
                            <DefinitionList>
                              <DefinitionRow term={translate("processingMethod")}>
                                {labels.method(record.processing.method)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("processedAt")}>
                                {formats.dateTime(record.processing.processed_at)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("processingResult")}>
                                {record.processing.result}
                              </DefinitionRow>
                              <DefinitionRow term={translate("recoveredTotal")} tone="success">
                                {formats.kilograms(recovered)}
                              </DefinitionRow>
                            </DefinitionList>
                            {record.processing.material_entries.length > 0 ? (
                              <ul className="border-t pt-2 pb-2">
                                {record.processing.material_entries.map((entry) => (
                                  <li
                                    className="flex justify-between gap-3 py-1 text-xs"
                                    key={`${entry.material}-${entry.weight.value}`}
                                  >
                                    <span>{entry.material}</span>
                                    <span className="font-semibold">
                                      {formats.weight(entry.weight)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    id: "evidence",
                    label: translate("tabEvidence"),
                    content: (
                      <AsyncPanel query={evidenceQuery} skeletonRows={2}>
                        {(data) => <EvidencePanel evidence={data.evidence} images={data.images} />}
                      </AsyncPanel>
                    ),
                  },
                  {
                    id: "history",
                    label: translate("tabHistory"),
                    content: (
                      <AsyncPanel query={eventsQuery} skeletonRows={2}>
                        {(events) => <RecordTimeline events={events} />}
                      </AsyncPanel>
                    ),
                  },
                ]}
                label={translate("tabsLabel")}
              />
            </>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
