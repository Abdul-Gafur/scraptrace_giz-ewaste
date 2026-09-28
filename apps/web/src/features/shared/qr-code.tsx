"use client";

import type { QrPayload } from "@scraptrace/contracts";
import { Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { encodeQrPayload } from "@/services/domain/qr-payload";

/**
 * QR symbol for a recovery record (FR-REC-003, FR-REC-004).
 *
 * The symbol encodes only the three fields of the contract's QR payload: the contract version,
 * the record identifier and an opaque lookup token. It never encodes a name, a telephone number,
 * a coordinate or any other personal data.
 *
 * The symbol is rendered as inline SVG, so it stays sharp when printed and needs no network
 * request. The manual transfer code beneath it is the fallback a recycler can type. It is a
 * separate credential issued by the API (ADR-009), not the record's display reference.
 */
export function RecordQrCode({
  payload,
  transferCode,
  reference,
  className,
}: {
  payload: QrPayload;
  /** The manual transfer code issued with this QR, shown and copyable as the typed fallback. */
  transferCode: string;
  /** The record's display reference, used to name the downloaded symbol. */
  reference: string;
  className?: string;
}) {
  const translate = useTranslations("qr");
  const [copied, setCopied] = useState<"code" | null>(null);

  const { markup, text } = useMemo(() => {
    const encoded = encodeQrPayload(payload);
    // Error-correction level M keeps the symbol readable when a printed label is scuffed without
    // making it dense enough to be hard to scan from a phone screen.
    const symbol = qrcode(0, "M");
    symbol.addData(encoded);
    symbol.make();
    return {
      markup: symbol.createSvgTag({ cellSize: 4, margin: 2, scalable: true }),
      text: encoded,
    };
  }, [payload]);

  const download = () => {
    const blob = new Blob([markup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reference}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = () => {
    void navigator.clipboard?.writeText(transferCode).then(() => setCopied("code"));
  };

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-3">
        <div
          aria-label={translate("symbolAlternative", { code: reference })}
          className="bg-surface w-40 rounded-md border p-2 [&_svg]:h-auto [&_svg]:w-full"
          // The symbol is a static, locally generated SVG string from the library; it contains no
          // record content beyond the encoded payload and no scripting.
          dangerouslySetInnerHTML={{ __html: markup }}
          role="img"
        />
        <p className="text-muted-foreground text-center text-xs">{translate("presentHint")}</p>
        <div className="w-full text-center">
          <p className="text-muted-foreground text-xs">{translate("transferCode")}</p>
          <p className="font-mono text-lg font-bold tracking-wider">{transferCode}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button block onClick={copyCode} variant="secondary">
            <Copy aria-hidden="true" className="size-4" />
            {copied === "code" ? translate("copied") : translate("copyCode")}
          </Button>
          <Button block onClick={download} variant="secondary">
            <Download aria-hidden="true" className="size-4" />
            {translate("download")}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied === "code" ? translate("copied") : ""}
        </p>
      </div>
      <details className="mt-3">
        <summary className="text-muted-foreground min-h-touch cursor-pointer text-xs">
          {translate("payloadSummary")}
        </summary>
        <p className="text-muted-foreground mt-1 font-mono text-[0.625rem] break-all">{text}</p>
        <p className="text-muted-foreground mt-1 text-xs">{translate("payloadNotice")}</p>
      </details>
    </div>
  );
}
