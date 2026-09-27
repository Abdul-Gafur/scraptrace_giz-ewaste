"use client";

import { UserRoleSchema, type SupportedLanguage, type UserRole } from "@scraptrace/contracts";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { PageLoading } from "@/components/feedback/page-loading";
import { AuthenticationProvider } from "@/auth/auth-session";

import { createHttpServices } from "./http/http-services";
import { createLocalServices, getSharedRepository } from "./local/local-services";
import { ensureSeeded } from "./local/seed";
import type { FrontendServices } from "./ports/service-ports";

interface ServiceConfiguration {
  readonly mode: "mock" | "http";
  readonly apiBaseUrl: string | undefined;
}

const ServiceContext = createContext<FrontendServices | null>(null);
const ServiceConfigurationContext = createContext<ServiceConfiguration | null>(null);

const buildServices = (
  configuration: ServiceConfiguration,
  role: UserRole,
  preferredLanguage: SupportedLanguage,
): FrontendServices => {
  if (configuration.mode === "mock") {
    return createLocalServices({
      role,
      preferredLanguage,
      repository: getSharedRepository(),
    });
  }
  if (!configuration.apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required in HTTP mode.");
  }
  return createHttpServices(configuration.apiBaseUrl);
};

interface ServiceProviderProps {
  children: ReactNode;
  mode: "mock" | "http";
  apiBaseUrl?: string | undefined;
}

/**
 * Root service provider.
 *
 * In development mode it writes the initial demonstration data through the real services once,
 * before any screen renders, so a screen never briefly shows an empty repository. It provides
 * collector-bound services by default; each role workspace rebinds them with `ServiceScope`.
 */
export function ServiceProvider({ children, mode, apiBaseUrl }: ServiceProviderProps) {
  const locale = useLocale();
  const translate = useTranslations("common");
  const [ready, setReady] = useState(mode !== "mock");

  useEffect(() => {
    if (mode !== "mock") return;
    let active = true;
    void ensureSeeded(getSharedRepository()).finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  const configuration = useMemo<ServiceConfiguration>(
    () => ({ mode, apiBaseUrl }),
    [apiBaseUrl, mode],
  );
  const services = useMemo(
    () => buildServices(configuration, UserRoleSchema.enum.collector, locale as SupportedLanguage),
    [configuration, locale],
  );

  if (!ready) return <PageLoading label={translate("loading")} />;
  return (
    <ServiceConfigurationContext.Provider value={configuration}>
      <ServiceContext.Provider value={services}>
        <AuthenticationProvider authentication={services.authentication}>
          {children}
        </AuthenticationProvider>
      </ServiceContext.Provider>
    </ServiceConfigurationContext.Provider>
  );
}

/**
 * Rebinds the services to one workspace role, so every call made from that workspace is
 * authorized as that role's actor.
 */
export function ServiceScope({ role, children }: { role: UserRole; children: ReactNode }) {
  const configuration = useContext(ServiceConfigurationContext);
  const locale = useLocale();
  const services = useMemo(
    () => (configuration ? buildServices(configuration, role, locale as SupportedLanguage) : null),
    [configuration, locale, role],
  );
  if (!services) return <>{children}</>;
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

export function useServices(): FrontendServices {
  const services = useContext(ServiceContext);
  if (!services) throw new Error("ServiceProvider is missing.");
  return services;
}

export function useServiceConfiguration(): ServiceConfiguration {
  const configuration = useContext(ServiceConfigurationContext);
  if (!configuration) throw new Error("ServiceProvider is missing.");
  return configuration;
}

export function useServiceConfigurationOptional(): ServiceConfiguration | null {
  return useContext(ServiceConfigurationContext);
}
