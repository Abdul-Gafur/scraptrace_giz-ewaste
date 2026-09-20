"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";
import { ServiceProvider } from "@/services/service-provider";

export function AppProviders({
  children,
  serviceMode,
  showQueryDevtools,
}: {
  children: ReactNode;
  serviceMode: "mock" | "http";
  showQueryDevtools: boolean;
}) {
  return (
    <QueryProvider showDevtools={showQueryDevtools}>
      <ServiceProvider mode={serviceMode}>{children}</ServiceProvider>
    </QueryProvider>
  );
}
