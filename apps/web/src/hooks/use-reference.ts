"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "@/lib/query-keys";
import { useServices } from "@/services/service-provider";

/** Reference data changes rarely, so it is cached for the session. */
const REFERENCE_STALE_TIME = 5 * 60_000;

export function useProgramme() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.reference.programme,
    queryFn: () => services.reference.getProgramme(),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useDestinations() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.reference.destinations,
    queryFn: () => services.reference.listDestinations(),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReceivingLocations() {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.reference.receivingLocations,
    queryFn: () => services.reference.listReceivingLocations(),
    staleTime: REFERENCE_STALE_TIME,
  });
}

/** Location identifier to directory name, from the programme's reference data. */
export function useLocationNames(): (locationId: string | undefined) => string | undefined {
  const destinations = useDestinations();
  const receiving = useReceivingLocations();
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const location of [...(destinations.data ?? []), ...(receiving.data ?? [])]) {
      names.set(location.location_id, location.name);
    }
    return (locationId) => (locationId ? names.get(locationId) : undefined);
  }, [destinations.data, receiving.data]);
}
