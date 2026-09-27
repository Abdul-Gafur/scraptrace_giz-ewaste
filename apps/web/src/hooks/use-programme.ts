"use client";

import type { ReportingFiltersSchema } from "@scraptrace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { queryKeys } from "@/lib/query-keys";
import type { ProgrammeSettings } from "@/services/domain/programme-settings";
import { useServices } from "@/services/service-provider";

type ReportingFilters = z.infer<typeof ReportingFiltersSchema>;

const filterKey = (filters: ReportingFilters): string => JSON.stringify(filters);

export function useProgrammeSettings() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.programmeSettings,
    queryFn: () => services.programmeSettings.get(),
    staleTime: 60_000,
  });
}

export function useSaveProgrammeSettings() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Omit<ProgrammeSettings, "updated_at" | "updated_by">) =>
      services.programmeSettings.save(settings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programmeSettings });
      void queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useReportSummary(filters: ReportingFilters) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.report.summary(filterKey(filters)),
    queryFn: () => services.reporting.summarize(filters),
  });
}

export function useReportRows(filters: ReportingFilters) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.report.rows(filterKey(filters)),
    queryFn: () => services.reporting.listForReport(filters),
  });
}

export function useBuildExport() {
  const services = useServices();
  return useMutation({
    mutationFn: (filters: ReportingFilters) => services.dataExports.build(filters),
  });
}

/**
 * Hands the generated CSV to the browser as a download. The object URL is revoked immediately
 * after the click, so the content is not left reachable.
 */
export const downloadCsv = (filename: string, content: string): void => {
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
