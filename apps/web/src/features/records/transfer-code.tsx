"use client";

import type { RecoveryRecord } from "@scraptrace/contracts";
import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

/**
 * The code a collector presents at handoff. It carries the opaque lookup token, never a name,
 * a location or a value, so a copied code discloses nothing about the person who holds it.
 *
 * A printed QR symbol needs a barcode library, which is a dependency decision this milestone
 * has not taken; the token is shown and copyable so the receiving facility can enter it.
 */
export function TransferCode({ record }: { record: RecoveryRecord }) {
  const translate = useTranslations("record");
  const { show } = useToast();
  return (
    <Card>
      <CardHeader>
        <h2 className="text-primary-dark flex items-center gap-2 text-sm font-bold">
          <QrCode aria-hidden="true" className="text-primary size-5" />
          {translate("transferHeading")}
        </h2>
        <p className="text-muted-foreground text-xs leading-5">{translate("transferText")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="bg-background rounded-sm border p-3 text-center text-lg font-extrabold tracking-widest">
          {record.human_reference}
        </p>
        <p className="text-muted-foreground font-mono text-[0.625rem] break-all" dir="ltr">
          {record.qr_payload.lookup_token}
        </p>
        <Button
          block
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(record.qr_payload.lookup_token);
              show({ title: translate("codeCopied"), tone: "success" });
            } catch {
              show({ title: translate("codeCopyFailed"), tone: "warning" });
            }
          }}
          variant="secondary"
        >
          {translate("copyCode")}
        </Button>
      </CardContent>
    </Card>
  );
}
