import { getLanguageDirection } from "@scraptrace/contracts";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Noto_Sans, Noto_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SkipLink } from "@/components/accessibility/skip-link";
import { publicEnvironment, useDevelopmentMocks } from "@/config/env";
import { routing } from "@/i18n/routing";
import { AppProviders } from "@/providers/app-providers";

import "../globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-sans-arabic",
  display: "swap",
});

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
    <html
      lang={locale}
      dir={direction}
      className={`${notoSans.variable} ${notoSansArabic.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          {/* The skip link sits outside the providers so it is reachable even while a provider is
              still preparing, which is exactly when a keyboard user presses Tab first. */}
          <SkipLink>{translate("skipToContent")}</SkipLink>
          <AppProviders
            serviceMode={useDevelopmentMocks ? "mock" : "http"}
            apiBaseUrl={publicEnvironment.NEXT_PUBLIC_API_BASE_URL}
            showQueryDevtools={publicEnvironment.NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS === "true"}
          >
            {children}
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
