import { SupportedLanguageSchema } from "@scraptrace/contracts";
import { defineRouting } from "next-intl/routing";

export const locales = SupportedLanguageSchema.options;
export const defaultLocale = "en";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
