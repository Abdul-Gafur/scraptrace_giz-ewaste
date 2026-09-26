"use client";

import type {
  EwasteCategory,
  FacilityType,
  ItemCondition,
  RecoveryRecord,
  SupportedLanguage,
} from "@scraptrace/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { useServices } from "./service-provider";
import type { FrontendServices } from "./ports/service-ports";

/**
 * Every screen reads and writes the programme through these hooks, never through storage.
 * When the backend replaces the in-browser implementation, only `createHttpServices` changes.
 */

/**
 * Programme data is small and heavily cross-linked: a handoff changes a record, the reviewer
 * queue, the manager totals and the event history at once. Invalidating everything after a
 * mutation is cheaper than maintaining a dependency map that could silently go stale.
 */
export function useProgrammeMutation<Input, Output>(
  run: (services: FrontendServices, input: Input) => Promise<Output>,
  options?: Omit<UseMutationOptions<Output, Error, Input>, "mutationFn">,
) {
  const services = useServices();
  const queryClient = useQueryClient();
  return useMutation<Output, Error, Input>({
    ...options,
    mutationFn: (input: Input) => run(services, input),
    async onSuccess(data, variables, context, mutation) {
      // Not awaited: a mutation is done when the write is done. Waiting for every dependent
      // query to refetch would make the caller's `await` hang on unrelated reads.
      void queryClient.invalidateQueries();
      await options?.onSuccess?.(data, variables, context, mutation);
    },
  });
}

export function useSession() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => services.authentication.getSession(),
  });
}

export function useRecords() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.recoveryRecords.all,
    queryFn: () => services.recoveryRecords.list(),
  });
}

export function useOwnRecords() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.recoveryRecords.own,
    queryFn: () => services.recoveryRecords.listOwn(),
  });
}

export function useRecord(recordId: string | undefined) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.recoveryRecords.detail(recordId ?? ""),
    queryFn: () => services.recoveryRecords.getById(recordId ?? ""),
    enabled: Boolean(recordId),
  });
}

export function useRecordEvents() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.recoveryRecords.events,
    queryFn: () => services.recoveryRecords.events(),
  });
}

export function useEvidenceImage(evidenceId: string | undefined) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.evidence(evidenceId ?? ""),
    queryFn: () => services.evidence.read(evidenceId ?? ""),
    enabled: Boolean(evidenceId),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useNearbyLocations({
  categories,
  radiusKm,
  facilityTypes,
  offline,
}: {
  categories: readonly EwasteCategory[];
  radiusKm: number;
  facilityTypes?: readonly FacilityType[];
  offline: boolean;
}) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.locations(
      `${categories.join("+")}|${radiusKm}|${facilityTypes?.join("+") ?? "all"}`,
    ),
    queryFn: () =>
      services.locations.search({
        search_origin: { type: "manual_area", area: { label: "Current area", country_code: "GH" } },
        radius_km: radiusKm,
        categories: [...categories] as [EwasteCategory, ...EwasteCategory[]],
        ...(facilityTypes?.length ? { facility_types: [...facilityTypes] } : {}),
        offline,
      }),
  });
}

export function useSafetyGuidance(
  category: EwasteCategory | undefined,
  language: SupportedLanguage,
) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.safetyGuidance(category ?? "", language),
    queryFn: () =>
      services.safetyGuidance.getGuidance({
        category: category as EwasteCategory,
        requested_language: language,
        transformation_mode: "none",
        offline: typeof navigator === "undefined" ? false : !navigator.onLine,
      }),
    enabled: Boolean(category),
  });
}

export function usePriceEstimate(input: {
  category: EwasteCategory | undefined;
  condition: ItemCondition;
  itemCount?: number;
  approximateWeightKg?: number;
}) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.priceEstimate(
      `${input.category ?? ""}|${input.condition}|${input.itemCount ?? ""}|${input.approximateWeightKg ?? ""}`,
    ),
    queryFn: () =>
      services.prices.estimate({
        category: input.category as EwasteCategory,
        condition: input.condition,
        ...(input.itemCount ? { itemCount: input.itemCount } : {}),
        ...(input.approximateWeightKg ? { approximateWeightKg: input.approximateWeightKg } : {}),
      }),
    enabled: Boolean(input.category),
  });
}

export function useSafetyCards() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.safetyCards,
    queryFn: () => services.safetyContent.listCards(),
  });
}

export function useModelLabels() {
  const services = useServices();
  return useQuery({ queryKey: queryKeys.modelLabels, queryFn: () => services.modelLabels.list() });
}

export function useDataExports() {
  const services = useServices();
  return useQuery({ queryKey: queryKeys.dataExports, queryFn: () => services.dataExports.list() });
}

export function useProgrammeSettings() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.settings.programme,
    queryFn: () => services.settings.getProgramme(),
  });
}

export function useFacilitySettings() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.settings.facility,
    queryFn: () => services.settings.getFacility(),
  });
}

export function useConsent() {
  const services = useServices();
  return useQuery({ queryKey: queryKeys.consent, queryFn: () => services.consent.get() });
}

export function useDeviceSummary() {
  const services = useServices();
  return useQuery({ queryKey: queryKeys.device, queryFn: () => services.device.summary() });
}

export function useOutbox() {
  const services = useServices();
  return useQuery({ queryKey: queryKeys.outbox, queryFn: () => services.outbox.pending() });
}

export function useReportSummary(
  scope: string,
  filters: Parameters<FrontendServices["reporting"]["summarize"]>[0],
) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.reports(scope),
    queryFn: () => services.reporting.summarize(filters),
  });
}

/** Records a receiving facility is waiting for or has taken in. */
export const isHandoffRelevant = (record: RecoveryRecord): boolean =>
  record.business_state === "awaiting_handoff" ||
  record.business_state === "received" ||
  record.business_state === "processing_recorded";

/** Records a reviewer is expected to decide on. */
export const isReviewRelevant = (record: RecoveryRecord): boolean =>
  record.review.review_state === "open" || record.review.review_state === "awaiting_information";
