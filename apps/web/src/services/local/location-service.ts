import { LocationSearchRequestSchema, LocationSearchResponseSchema } from "@scraptrace/contracts";

import { nowUtc } from "@/services/domain/time";
import type { LocationService } from "@/services/ports/service-ports";

import { pause, type LocalServiceContext } from "./context";
import { AREA_CENTROIDS, buildDirectory } from "./location-directory";

/**
 * Participating-location search (FR-LOC-002, FR-LOC-003, FR-LOC-007).
 *
 * A manual area is a first-class origin, so declining geolocation never blocks the journey. When
 * nothing compatible is found the response is an approved safe-holding message rather than any
 * improvised disposal advice.
 */
export const createLocationService = (context: LocalServiceContext): LocationService => ({
  async search(request) {
    await pause(context.delayMilliseconds);
    const parsed = LocationSearchRequestSchema.parse(request);
    const settings = context.repository.getProgrammeSettings();
    const origin =
      parsed.search_origin.type === "coordinates"
        ? parsed.search_origin.coordinates
        : (AREA_CENTROIDS[parsed.search_origin.area.label] ??
          AREA_CENTROIDS[Object.keys(AREA_CENTROIDS)[0] ?? ""]);

    if (!origin) {
      return LocationSearchResponseSchema.parse({
        outcome: "offline_data_unavailable",
        message: "No reviewed directory area matches that selection.",
      });
    }

    const locations = buildDirectory(origin, {
      categories: parsed.categories,
      ...(parsed.facility_types ? { facilityTypes: parsed.facility_types } : {}),
      radiusKm: parsed.radius_km,
      includeUnverified: settings?.show_unverified_facilities ?? true,
      offline: parsed.offline,
    });

    if (locations.length === 0) {
      return LocationSearchResponseSchema.parse({
        outcome: "no_results",
        safe_holding_message:
          "Keep the item intact, dry and out of reach until a suitable receiving location is available. Do not open, break or burn it.",
        programme_contact: "Programme support desk",
      });
    }

    return LocationSearchResponseSchema.parse({
      outcome: "results",
      locations,
      data_as_of: nowUtc(),
      ...(parsed.offline
        ? {
            offline_limitations:
              "Shown from the last reviewed directory saved on this device. Opening hours may have changed.",
          }
        : {}),
    });
  },
});
