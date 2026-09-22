import { useFormatter, useLocale } from "next-intl";

/**
 * Locale-aware number formatting. Arabic uses Arabic-Indic digits, as in the approved design.
 * Pass `fractionDigits` for a fixed number of decimals; otherwise at most one is shown.
 */
export function useNumber() {
  const format = useFormatter();
  const locale = useLocale();
  return (value: number, fractionDigits?: number): string =>
    format.number(value, {
      ...(locale === "ar" ? { numberingSystem: "arab" } : {}),
      ...(fractionDigits === undefined
        ? { maximumFractionDigits: 1 }
        : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
    });
}
