"use client";

import type { SupportedLanguage } from "@scraptrace/contracts";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { locales } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Language names are shown in their own language so speakers can always find them. */
const NATIVE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
  pt: "Português",
};

export function LanguageSwitcher() {
  const currentLocale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  const router = useRouter();
  const translate = useTranslations("common");

  return (
    <DropdownMenu
      choice
      items={locales.map((locale) => ({
        id: locale,
        label: NATIVE_NAMES[locale],
        lang: locale,
        checked: locale === currentLocale,
        onSelect: () => router.replace(pathname, { locale }),
      }))}
      label={`${translate("language")}: ${NATIVE_NAMES[currentLocale]}`}
      trigger={
        <>
          <Globe aria-hidden="true" className="text-primary size-5" />
          <span lang={currentLocale}>{NATIVE_NAMES[currentLocale]}</span>
        </>
      }
    />
  );
}
