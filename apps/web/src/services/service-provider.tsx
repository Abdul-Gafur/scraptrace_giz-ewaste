"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createHttpServices } from "./http/http-services";
import { createMockServices } from "./mocks/mock-services";
import type { FrontendServices } from "./ports/service-ports";

const ServiceContext = createContext<FrontendServices | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  mode: "mock" | "http";
}

export function ServiceProvider({ children, mode }: ServiceProviderProps) {
  const services = useMemo(
    () => (mode === "mock" ? createMockServices() : createHttpServices()),
    [mode],
  );
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

export function useServices(): FrontendServices {
  const services = useContext(ServiceContext);
  if (!services) throw new Error("ServiceProvider is missing.");
  return services;
}
