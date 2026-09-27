"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceProvider } from "@/services/service-provider";

export function AppProviders({
  children,
  serviceMode,
  apiBaseUrl,
  showQueryDevtools,
}: {
  children: ReactNode;
  serviceMode: "mock" | "http";
  apiBaseUrl?: string | undefined;
  showQueryDevtools: boolean;
}) {
  return (
    <QueryProvider showDevtools={showQueryDevtools}>
      <ServiceProvider mode={serviceMode} apiBaseUrl={apiBaseUrl}>
        <ToastProvider>{children}</ToastProvider>
      </ServiceProvider>
    </QueryProvider>
  );
}
