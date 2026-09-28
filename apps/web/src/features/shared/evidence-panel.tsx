"use client";

import type { EvidenceMetadata as Evidence } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DefinitionList, DefinitionRow, SectionLabel } from "@/components/ui/content";
import { EvidencePlaceholder } from "@/components/ui/evidence-placeholder";

import { useContractLabels } from "./contract-labels";
import { EvidenceImage } from "./evidence-image";
import { useValueFormats } from "./formats";

/**
 * Evidence with its provenance (FR-HND-002, FR-REV-004).
 *
 * Provenance shows how the content reached the record: the capture source, the device, the
 * capture and receipt times, whether the device was online, and the model observation or human
 * correction attached to it. The digest is shown as a change-detection value; the panel states
 * plainly that it does not prove the recorded event happened, and it never shows a collector's
 * precise coordinates to a role without permission for personal data.
 */
export function EvidencePanel({
  evidence,
  images,
  showCoordinates = false,
}: {
  evidence: readonly Evidence[];
  /** Evidence identifier to stored preview, when one was kept on the device. */
  images?: Readonly<Record<string, string | null>>;
  showCoordinates?: boolean;
}) {
  const translate = useTranslations("evidence");
  const labels = useContractLabels();
  const formats = useValueFormats();

  if (evidence.length === 0) {
    return <p className="text-muted-foreground text-xs">{translate("none")}</p>;
  }

  return (
    <div className="space-y-3">
      <SectionLabel>{translate("heading")}</SectionLabel>
      <ul className="space-y-3">
        {evidence.map((item) => {
          const preview = images?.[item.evidence_id] ?? null;
          const isImage = item.mime_type.startsWith("image/");
          return (
            <li className="bg-surface space-y-2 rounded-md border p-3" key={item.evidence_id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{labels.evidenceType(item.evidence_type)}</p>
                <Badge>{labels.captureSource(item.provenance.capture_source)}</Badge>
              </div>
              {isImage ? (
                preview ? (
                  // The alternative text names the evidence role, not the picture's content: the
                  // application cannot describe what the photograph actually shows.
                  <EvidenceImage
                    alt={translate("imageAlternative", {
                      type: labels.evidenceType(item.evidence_type),
                    })}
                    className="max-h-48"
                    src={preview}
                  />
                ) : (
                  <EvidencePlaceholder label={translate("noPreview")} />
                )
              ) : null}
              <DefinitionList className="text-xs">
                <DefinitionRow term={translate("capturedAt")}>
                  {formats.dateTime(item.provenance.captured_at)}
                </DefinitionRow>
                {item.provenance.server_received_at ? (
                  <DefinitionRow term={translate("receivedAt")}>
                    {formats.dateTime(item.provenance.server_received_at)}
                  </DefinitionRow>
                ) : null}
                <DefinitionRow term={translate("connectivity")}>
                  {translate(item.provenance.connectivity)}
                </DefinitionRow>
                <DefinitionRow term={translate("mimeType")}>{item.mime_type}</DefinitionRow>
                <DefinitionRow term={translate("size")}>
                  {formats.number(item.file_size_bytes, 0)}
                </DefinitionRow>
                <DefinitionRow term={translate("validation")}>
                  {translate(`validation_${item.validation_status}`)}
                </DefinitionRow>
                {showCoordinates && item.provenance.coordinates ? (
                  <DefinitionRow term={translate("coordinates")}>
                    {formats.number(item.provenance.coordinates.latitude, 4)},{" "}
                    {formats.number(item.provenance.coordinates.longitude, 4)}
                  </DefinitionRow>
                ) : null}
                {item.provenance.ai_observation ? (
                  <DefinitionRow term={translate("modelObservation")}>
                    {labels.category(
                      item.provenance.ai_observation.original_prediction as Parameters<
                        typeof labels.category
                      >[0],
                    )}{" "}
                    · {formats.percent(item.provenance.ai_observation.confidence)} ·{" "}
                    {item.provenance.ai_observation.model_version}
                  </DefinitionRow>
                ) : null}
                {item.provenance.human_correction ? (
                  <DefinitionRow term={translate("humanCorrection")} tone="warning">
                    {item.provenance.human_correction.original_value} →{" "}
                    {item.provenance.human_correction.corrected_value}
                  </DefinitionRow>
                ) : null}
                <DefinitionRow term={translate("digest")}>
                  <span className="font-mono text-[0.625rem] break-all">{item.content_digest}</span>
                </DefinitionRow>
              </DefinitionList>
            </li>
          );
        })}
      </ul>
      <Alert title={translate("digestNoticeTitle")} tone="info">
        {translate("digestNotice")}
      </Alert>
    </div>
  );
}
