"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { DefinitionList, DefinitionRow } from "@/components/ui/content";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useValueFormats } from "@/features/shared/formats";
import { RecordQrCode } from "@/features/shared/qr-code";
import { useToast } from "@/components/ui/toast";
import { useQrCredentials, useReissueQrCredentials } from "@/hooks/use-records";

/**
 * The owning collector's handoff credentials (FR-REC-003, FR-REC-004, ADR-009): the QR symbol,
 * the separate manual transfer code, their status and expiry, and a reissue action that revokes
 * both at once. Credentials are requested only while this panel is shown and are not cached.
 */
export function QrCredentialsPanel({
  recordId,
  reference,
}: {
  readonly recordId: string;
  readonly reference: string;
}) {
  const translate = useTranslations("qr");
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const query = useQrCredentials(recordId);
  const reissue = useReissueQrCredentials();

  return (
    <AsyncPanel query={query} skeletonRows={3}>
      {(credentials) => (
        <div className="space-y-3">
          <DefinitionList>
            <DefinitionRow
              term={translate("statusLabel")}
              tone={credentials.status === "active" ? "success" : "neutral"}
            >
              {translate(`status.${credentials.status}`)}
            </DefinitionRow>
            {credentials.expires_at ? (
              <DefinitionRow term={translate("expiresAt")}>
                {formats.dateTime(credentials.expires_at)}
              </DefinitionRow>
            ) : null}
          </DefinitionList>
          {credentials.qr_payload && credentials.manual_transfer_code ? (
            <>
              {credentials.status === "inactive" ? (
                <Alert title={translate("inactiveTitle")} tone="info">
                  {translate("inactiveNotice")}
                </Alert>
              ) : null}
              <RecordQrCode
                payload={credentials.qr_payload}
                reference={reference}
                transferCode={credentials.manual_transfer_code}
              />
              <p className="text-muted-foreground text-xs leading-5">
                {translate("manualCodeNotice")}
              </p>
            </>
          ) : (
            <Alert
              title={translate(credentials.status === "used" ? "usedTitle" : "expiredTitle")}
              tone={credentials.status === "used" ? "info" : "warning"}
            >
              {translate(credentials.status === "used" ? "usedNotice" : "expiredNotice")}
            </Alert>
          )}
          {credentials.status === "active" || credentials.status === "expired" ? (
            <ConfirmAction
              block
              confirmLabel={translate("reissue")}
              description={translate("reissueDescription")}
              disabled={reissue.isPending}
              label={translate("reissue")}
              loading={reissue.isPending}
              onConfirm={() =>
                reissue.mutate(recordId, {
                  onSuccess: () => show({ title: translate("reissued"), tone: "success" }),
                  onError: (error) => show({ title: safeMessage(error), tone: "warning" }),
                })
              }
              title={translate("reissueTitle")}
              variant="secondary"
            />
          ) : null}
        </div>
      )}
    </AsyncPanel>
  );
}
