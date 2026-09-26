"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "./query-provider";
import { ToastProvider } from "@/components/ui/toast";
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
      <ServiceProvider mode={serviceMode}>
        <ToastProvider>{children}</ToastProvider>
      </ServiceProvider>
    </QueryProvider>
  );
}
