import type { UserRole } from "@scraptrace/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, type ReactElement, type ReactNode } from "react";

import { DevelopmentSessionProvider } from "@/auth/session";
import { ToastProvider } from "@/components/ui/toast";
import { createLocalServices } from "@/services/local/local-services";
import { ScrapTraceRepository } from "@/services/local/repository";
import { ensureSeeded, seedRepository } from "@/services/local/seed";
import type { FrontendServices } from "@/services/ports/service-ports";

import { bundles, type TestLocale } from "./render";

/**
 * Renders a whole screen with the providers it needs, against an isolated repository.
 *
 * The service context is provided through the same module the screens import, so a screen under test
 * talks to the real local services rather than to a stub.
 */

export const makeTestRepository = (): ScrapTraceRepository =>
  new ScrapTraceRepository({
    durable: false,
    read: () => null,
    write: () => ({ ok: true }) as const,
    clear: () => undefined,
  });

const ServiceOverride = createContext<FrontendServices | null>(null);

export function TestServiceProvider({
  services,
  children,
}: {
  services: FrontendServices;
  children: ReactNode;
}) {
  return <ServiceOverride.Provider value={services}>{children}</ServiceOverride.Provider>;
}

export function useTestServices(): FrontendServices | null {
  return useContext(ServiceOverride);
}

export interface ScreenHarness {
  readonly repository: ScrapTraceRepository;
  readonly services: FrontendServices;
}

export const createScreenHarness = async (
  role: UserRole,
  options: { readonly seed?: boolean } = {},
): Promise<ScreenHarness> => {
  const repository = makeTestRepository();
  seedRepository(repository);
  if (options.seed !== false) await ensureSeeded(repository);
  return { repository, services: createLocalServices({ role, repository }) };
};

export function renderScreen(
  ui: ReactElement,
  {
    role,
    services,
    locale = "en",
  }: { role: UserRole; services: FrontendServices; locale?: TestLocale },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale={locale} messages={bundles[locale]}>
      <QueryClientProvider client={queryClient}>
        <TestServiceProvider services={services}>
          <ToastProvider>
            <DevelopmentSessionProvider role={role}>{ui}</DevelopmentSessionProvider>
          </ToastProvider>
        </TestServiceProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
