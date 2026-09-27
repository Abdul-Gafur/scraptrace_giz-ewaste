"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DefinitionList,
  DefinitionRow,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { Tabs } from "@/components/ui/tabs";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { EvidencePanel } from "@/features/shared/evidence-panel";
import { FlagPanel } from "@/features/shared/flag-panel";
import { useValueFormats } from "@/features/shared/formats";
import { RecordIdentity } from "@/features/shared/record-identity";
import { RecordTimeline } from "@/features/shared/record-timeline";
import { RecordQrCode } from "@/features/shared/qr-code";
import { useRecord, useRecordEvents, useRecordEvidence } from "@/hooks/use-records";
import { findLocationName } from "@/services/local/location-directory";

/**
 * One record as its collector sees it (FR-REC-004, FR-DSH-001, FR-DSH-002).
 *
 * The QR symbol and transfer code are available whenever the record is awaiting handoff, so the
 * collector can present the record after closing and reopening the application. Estimate and
 * recycler final price stay in separate rows, because one is indicative and the other is measured.
 */
export function CollectorRecordDetail({ recordId }: { recordId: string }) {
  const translate = useTranslations("record");
  const translateCapture = useTranslations("screens.capture");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const recordQuery = useRecord(recordId);
  const eventsQuery = useRecordEvents(recordId);
  const evidenceQuery = useRecordEvidence(recordId);

  return (
    <div className="max-w-2xl space-y-5">
      <AsyncPanel isEmpty={(record) => record === null} query={recordQuery}>
        {(record) => {
          if (!record) return null;
          const showQr =
            record.business_state === "awaiting_handoff" || record.business_state === "submitted";
          return (
            <>
              <PageHeading eyebrow={record.human_reference}>
                {labels.category(record.category)}
              </PageHeading>

              <FlagPanel flagCodes={record.review.flag_codes} />

              {showQr ? (
                <Card>
                  <CardHeader>
                    <SectionHeading as="h2">{translate("qrHeading")}</SectionHeading>
                  </CardHeader>
                  <CardContent>
                    <RecordQrCode
                      payload={record.qr_payload}
                      transferCode={record.human_reference}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {record.business_state === "draft" ? (
                <Alert title={translate("draftTitle")} tone="info">
                  {translate("draftNotice")}
                </Alert>
              ) : null}

              <Tabs
                items={[
                  {
                    id: "summary",
                    label: translate("tabSummary"),
                    content: (
                      <div className="space-y-4">
                        <div className="bg-surface rounded-md border px-4 py-2">
                          <RecordIdentity record={record} />
                        </div>

                        {record.vision_result ? (
                          <div className="bg-surface rounded-md border px-4 py-2">
                            <DefinitionList>
                              <DefinitionRow term={translate("suggestedCategory")}>
                                {labels.category(record.vision_result.suggested_category)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("confidence")}>
                                {formats.percent(record.vision_result.confidence)}
                              </DefinitionRow>
                              <DefinitionRow term={translate("modelVersion")}>
                                {record.vision_result.model_version}
                              </DefinitionRow>
                              <DefinitionRow term={translate("confirmedBy")}>
                                {labels.confirmation(record.category_confirmation.source)}
                              </DefinitionRow>
                              {record.category_confirmation.correction_reason ? (
                                <DefinitionRow term={translate("correctionReason")} tone="warning">
                                  {record.category_confirmation.correction_reason}
                                </DefinitionRow>
                              ) : null}
                            </DefinitionList>
                          </div>
                        ) : null}

                        {record.estimated_price ? (
                          <div className="bg-surface rounded-md border px-4 py-2">
                            <DefinitionList>
                              <DefinitionRow term={translate("estimateRange")}>
                                {formats.currency(
                                  record.estimated_price.minimum_amount,
                                  record.estimated_price.currency,
                                )}{" "}
                                –{" "}
                                {formats.currency(
                                  record.estimated_price.maximum_amount,
                                  record.estimated_price.currency,
                                )}
                              </DefinitionRow>
                              {record.handoff ? (
                                <DefinitionRow term={translate("finalPrice")} tone="success">
                                  {formats.currency(
                                    record.handoff.final_price.amount,
                                    record.handoff.final_price.currency,
                                  )}
                                </DefinitionRow>
                              ) : null}
                            </DefinitionList>
                            <p className="text-muted-foreground pb-2 text-xs leading-5">
                              {record.estimated_price.disclaimer}
                            </p>
                          </div>
                        ) : null}

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
                              <DefinitionRow term={translate("measuredWeight")} tone="success">
                                {formats.weight(record.handoff.measured_weight)}
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
                            </DefinitionList>
                          </div>
                        ) : null}

                        {record.safety_guide ? (
                          <p className="text-muted-foreground text-xs leading-5">
                            {translateCapture("safetyCardUsed", {
                              version: record.safety_guide.card_version,
                              language: record.safety_guide.language.toUpperCase(),
                            })}
                          </p>
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
