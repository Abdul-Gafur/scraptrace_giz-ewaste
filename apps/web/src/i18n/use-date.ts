import { useFormatter, useLocale } from "next-intl";

/**
 * Locale-aware calendar dates. Sample data carries plain `YYYY-MM-DD` programme dates, which
 * are read in UTC so the rendered day never shifts with the viewer's zone. Arabic is given
 * Arabic-Indic digits explicitly, as `useNumber` does: the digits a bare `ar` locale produces
 * depend on the runtime's ICU data, and the approved design is unambiguous about them.
 */
export function useDate() {
  const format = useFormatter();
  const locale = useLocale();
  return (isoDate: string): string =>
    format.dateTime(new Date(`${isoDate}T00:00:00Z`), {
      dateStyle: "medium",
      ...(locale === "ar" ? { numberingSystem: "arab" } : {}),
    });
}
