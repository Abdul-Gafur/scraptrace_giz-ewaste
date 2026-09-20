"use client";

import type { SupportedLanguage } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";

import { Select } from "@/components/ui/select";
import { locales } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const currentLocale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  const router = useRouter();
  const translateCommon = useTranslations("common");
  const translateLanguage = useTranslations("languages");

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{translateCommon("language")}</span>
      <Select
        aria-label={translateCommon("language")}
        value={currentLocale}
        onChange={(event) =>
          router.replace(pathname, { locale: event.target.value as SupportedLanguage })
        }
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {translateLanguage(locale)}
          </option>
        ))}
      </Select>
    </label>
  );
}
