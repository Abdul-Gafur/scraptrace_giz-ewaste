"use client";

import type { SupportedLanguage } from "@scraptrace/contracts";
import { Check, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { locales } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Each language is described in its own language so speakers can recognise it. */
const OPTIONS: Record<SupportedLanguage, { name: string; description: string }> = {
  en: { name: "English", description: "Official system communication" },
  fr: { name: "Français", description: "Communication officielle" },
  ar: { name: "العربية", description: "التواصل الرسمي للنظام" },
  pt: { name: "Português", description: "Comunicação oficial" },
};

/** Figma: welcome-language. Confirming continues to the privacy step in the chosen language. */
export function LanguageChoice() {
  const translate = useTranslations("screens.onboarding");
  const current = useLocale() as SupportedLanguage;
  const router = useRouter();
  const [selected, setSelected] = useState<SupportedLanguage>(current);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ShieldCheck aria-hidden="true" className="text-primary size-10" strokeWidth={1.5} />
        <h1 className="text-primary-dark text-3xl font-extrabold">{translate("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">{translate("subtitle")}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">{translate("languageGroup")}</legend>
        {locales.map((locale) => {
          const option = OPTIONS[locale];
          const active = locale === selected;
          return (
            <label
              className={cn(
                "bg-surface has-[:focus-visible]:outline-focus flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 py-2 has-[:focus-visible]:outline-[length:var(--focus-ring-width)] has-[:focus-visible]:outline-offset-2",
                active && "border-primary border-2",
              )}
              key={locale}
              lang={locale}
            >
              <input
                checked={active}
                className="sr-only"
                name="language"
                onChange={() => setSelected(locale)}
                type="radio"
                value={locale}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "w-9 text-sm font-bold",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                dir="ltr"
              >
                [{locale.toUpperCase()}]
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{option.name}</span>
                <span className="text-muted-foreground block text-xs">{option.description}</span>
              </span>
              {active ? <Check aria-hidden="true" className="text-primary size-5" /> : null}
            </label>
          );
        })}
      </fieldset>

      <p className="bg-surface text-muted-foreground rounded-md border p-3 text-xs leading-5">
        {translate("note")}
      </p>

      <Button
        block
        onClick={() => router.push("/onboarding/privacy", { locale: selected })}
        size="large"
      >
        {translate("confirm")}
      </Button>
    </div>
  );
}
