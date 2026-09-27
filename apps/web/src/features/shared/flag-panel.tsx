"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";

import { useContractLabels } from "./contract-labels";

/**
 * Review flags.
 *
 * Every flag panel carries the approved statement that a flag needs human judgement and is not
 * proof of wrongdoing (FR-REV-009, BR-009). The panel is a warning, never an accusation.
 */
export function FlagPanel({
  flagCodes,
  className,
}: {
  flagCodes: readonly string[];
  className?: string;
}) {
  const translate = useTranslations("flags");
  const labels = useContractLabels();
  if (flagCodes.length === 0) return null;
  return (
    <Alert {...(className ? { className } : {})} title={translate("panelTitle")} tone="warning">
      <ul className="list-inside list-disc space-y-1">
        {flagCodes.map((code) => (
          <li key={code}>
            <span className="font-semibold">{labels.flag(code)}</span>
            <span className="text-muted-foreground"> — {code}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2">{translate("judgementNotice")}</p>
    </Alert>
  );
}
