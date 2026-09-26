import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import pt from "../../messages/pt.json";
import { createMockServices } from "@/services/mocks/mock-services";
import { ServiceProvider } from "@/services/service-provider";

export const bundles = { en, fr, ar, pt } as const;
export type TestLocale = keyof typeof bundles;

/** The providers every screen needs: query client, services and messages. */
export function renderWithIntl(ui: ReactElement, locale: TestLocale = "en") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={createMockServices({ delayMilliseconds: 0 })}>
        <NextIntlClientProvider locale={locale} messages={bundles[locale]} timeZone="UTC">
          {ui}
        </NextIntlClientProvider>
      </ServiceProvider>
    </QueryClientProvider>,
  );
}
