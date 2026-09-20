import { getLanguageDirection } from "@scraptrace/contracts";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SkipLink } from "@/components/accessibility/skip-link";
import { publicEnvironment, useDevelopmentMocks } from "@/config/env";
import { routing } from "@/i18n/routing";
import { AppProviders } from "@/providers/app-providers";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const translate = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: { default: translate("title"), template: `%s | ${translate("title")}` },
    description: translate("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const translate = await getTranslations("common");
  const direction = getLanguageDirection(locale);
  return (
    <html lang={locale} dir={direction}>
      <body>
        <NextIntlClientProvider>
          <AppProviders
            serviceMode={useDevelopmentMocks ? "mock" : "http"}
            showQueryDevtools={publicEnvironment.NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS === "true"}
          >
            <SkipLink>{translate("skipToContent")}</SkipLink>
            {children}
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
