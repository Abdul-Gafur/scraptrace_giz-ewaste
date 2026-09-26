import type { SupportedLanguage } from "@scraptrace/contracts";

export const formatDate = (value: Date | string, locale: SupportedLanguage): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    typeof value === "string" ? new Date(value) : value,
  );

export const formatNumber = (value: number, locale: SupportedLanguage): string =>
  new Intl.NumberFormat(locale).format(value);

export const formatCurrency = (
  value: number,
  currency: string,
  locale: SupportedLanguage,
): string => new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
