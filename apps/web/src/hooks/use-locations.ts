"use client";

import type { EwasteCategory } from "@scraptrace/contracts";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { useServices } from "@/services/service-provider";

export interface LocationSearchOptions {
  readonly category: EwasteCategory;
  readonly areaLabel: string;
  readonly radiusKm: number;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
  readonly offline: boolean;
}

/**
 * Nearby participating locations. Coordinates are used when the user has granted them; otherwise
 * the chosen area is the origin, which is what keeps the journey usable after a permission denial.
 */
export function useLocationSearch(options: LocationSearchOptions, enabled = true) {
  const services = useServices();
  return useQuery({
    queryKey: [
      ...queryKeys.locations(options.category, options.areaLabel),
      options.radiusKm,
      options.coordinates ? "gps" : "area",
    ],
    queryFn: () =>
      services.locations.search({
        search_origin: options.coordinates
          ? {
              type: "coordinates",
              coordinates: {
                latitude: options.coordinates.latitude,
                longitude: options.coordinates.longitude,
                source: "device",
              },
            }
          : { type: "manual_area", area: { label: options.areaLabel, country_code: "GH" } },
        radius_km: options.radiusKm,
        categories: [options.category],
        offline: options.offline,
      }),
    enabled,
  });
}
