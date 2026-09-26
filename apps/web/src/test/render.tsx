import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import pt from "../../messages/pt.json";

export const bundles = { en, fr, ar, pt } as const;
export type TestLocale = keyof typeof bundles;

export function renderWithIntl(ui: ReactElement, locale: TestLocale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={bundles[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}
