"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createHttpServices } from "./http/http-services";
import { createLocalServices } from "./local/local-services";
import type { FrontendServices } from "./ports/service-ports";

const ServiceContext = createContext<FrontendServices | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  mode?: "mock" | "http";
  /** Supplied directly by tests, which need a deterministic, failure-injectable set. */
  services?: FrontendServices;
}

export function ServiceProvider({
  children,
  mode = "mock",
  services: provided,
}: ServiceProviderProps) {
  // "mock" is the in-browser programme implementation: every port is real, but nothing leaves
  // the device. "http" is the seam a backend will fill.
  const services = useMemo(
    () => provided ?? (mode === "mock" ? createLocalServices() : createHttpServices()),
    [mode, provided],
  );
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

export function useServices(): FrontendServices {
  const services = useContext(ServiceContext);
  if (!services) throw new Error("ServiceProvider is missing.");
  return services;
}
