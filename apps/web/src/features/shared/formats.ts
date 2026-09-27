import type { SupportedLanguage } from "@scraptrace/contracts";
import { useFormatter, useLocale } from "next-intl";

import { toKilograms, type Weight } from "@/services/domain/flags";

/**
 * Locale-aware formatting for the three values that appear on nearly every screen: a weight, a
 * date and time, and a currency amount. Arabic uses Arabic-Indic digits, as the approved design
 * does.
 */
export function useValueFormats() {
  const format = useFormatter();
  const locale = useLocale() as SupportedLanguage;
  const numberingSystem = locale === "ar" ? { numberingSystem: "arab" } : {};

  const number = (value: number, fractionDigits = 2): string =>
    format.number(value, {
      ...numberingSystem,
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });

  return {
    number,
    /** Weight normalised to kilograms, with its unit, so totals are comparable. */
    weightKg: (weight: Weight | undefined): string | null =>
      weight ? `${number(toKilograms(weight), 3)} kg` : null,
    weight: (weight: Weight | undefined): string | null =>
      weight ? `${number(weight.value, 3)} ${weight.unit}` : null,
    kilograms: (value: number): string => `${number(value, 3)} kg`,
    dateTime: (value: string | undefined): string | null =>
      value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : null,
    date: (value: string | undefined): string | null =>
      value ? format.dateTime(new Date(value), { dateStyle: "medium" }) : null,
    currency: (amount: number, currency: string): string =>
      format.number(amount, { style: "currency", currency, ...numberingSystem }),
    percent: (ratio: number, fractionDigits = 1): string =>
      format.number(ratio, {
        style: "percent",
        ...numberingSystem,
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
      }),
  };
}
