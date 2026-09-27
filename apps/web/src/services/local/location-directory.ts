import {
  EwasteCategorySchema,
  FacilityTypeSchema,
  FacilityVerificationStatusSchema,
  ParticipatingLocationSchema,
  type EwasteCategory,
  type GeoCoordinates,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { DEMO_LOCATION_IDS } from "@/auth/actors";

export type ParticipatingLocation = z.infer<typeof ParticipatingLocationSchema>;

/**
 * Reviewed demonstration directory. Every profile carries a name, type, coordinates, accepted
 * categories, opening information, display contact and a verification state with its date
 * (FR-LOC-001), and only a manager-reviewed profile carries `programme_verified` (FR-LOC-004,
 * BR-006). The unverified entry exists so the absence of a verified badge is demonstrable.
 */
const facilityType = FacilityTypeSchema.enum;
const verification = FacilityVerificationStatusSchema.enum;

const DIRECTORY_REVIEWED_AT = "2026-09-20T09:00:00.000Z";

const ALL_CATEGORIES: readonly EwasteCategory[] = EwasteCategorySchema.options;

interface DirectoryEntry {
  readonly location_id: string;
  readonly name: string;
  readonly facility_type: z.infer<typeof FacilityTypeSchema>;
  readonly accepted_categories: readonly EwasteCategory[];
  readonly verification_status: z.infer<typeof FacilityVerificationStatusSchema>;
  readonly verification_date?: string;
  readonly coordinates: GeoCoordinates;
  readonly opening_information: string;
  readonly display_contact: string;
}

const ENTRIES: readonly DirectoryEntry[] = [
  {
    location_id: DEMO_LOCATION_IDS.collectionCentre,
    name: "Accra Central Collection Centre",
    facility_type: facilityType.collection_centre,
    accepted_categories: ALL_CATEGORIES,
    verification_status: verification.programme_verified,
    verification_date: "2026-08-14",
    coordinates: { latitude: 5.5502, longitude: -0.2174, source: "facility" },
    opening_information: "Monday to Saturday, 08:00–17:00",
    display_contact: "Programme desk, extension 210",
  },
  {
    location_id: DEMO_LOCATION_IDS.recycler,
    name: "Tema Licensed Recycling Works",
    facility_type: facilityType.recycler,
    accepted_categories: [
      "refrigerators",
      "air_conditioners",
      "compressors",
      "televisions",
      "mixed_scrap",
    ],
    verification_status: verification.programme_verified,
    verification_date: "2026-07-02",
    coordinates: { latitude: 5.6698, longitude: -0.0166, source: "facility" },
    opening_information: "Monday to Friday, 07:30–16:30. Refrigerant recovery on site.",
    display_contact: "Intake office, extension 44",
  },
  {
    location_id: DEMO_LOCATION_IDS.scrapyard,
    name: "Kaneshie Scrap Yard",
    facility_type: facilityType.scrapyard,
    accepted_categories: ["mixed_scrap", "laptops_and_desktop_computers", "microwaves"],
    verification_status: verification.unverified,
    coordinates: { latitude: 5.5731, longitude: -0.2359, source: "imported" },
    opening_information: "Daily, daylight hours",
    display_contact: "No programme contact recorded",
  },
];

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Straight-line distance, used only to order results (FR-LOC-002). */
export const distanceKilometres = (from: GeoCoordinates, to: GeoCoordinates): number => {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const buildDirectory = (
  origin: GeoCoordinates,
  options: {
    readonly categories: readonly EwasteCategory[];
    readonly facilityTypes?: readonly DirectoryEntry["facility_type"][];
    readonly radiusKm: number;
    readonly includeUnverified: boolean;
    readonly offline: boolean;
  },
): readonly ParticipatingLocation[] =>
  ENTRIES.filter(
    (entry) =>
      options.categories.some((category) => entry.accepted_categories.includes(category)) &&
      (options.facilityTypes === undefined ||
        options.facilityTypes.includes(entry.facility_type)) &&
      (options.includeUnverified || entry.verification_status === verification.programme_verified),
  )
    .map((entry) =>
      ParticipatingLocationSchema.parse({
        location_id: entry.location_id,
        name: entry.name,
        facility_type: entry.facility_type,
        accepted_categories: entry.accepted_categories,
        verification_status: entry.verification_status,
        ...(entry.verification_date ? { verification_date: entry.verification_date } : {}),
        coordinates: entry.coordinates,
        distance_km: Number(distanceKilometres(origin, entry.coordinates).toFixed(2)),
        opening_information: entry.opening_information,
        display_contact: entry.display_contact,
        last_reviewed_at: DIRECTORY_REVIEWED_AT,
        data_source: options.offline ? "cached_directory" : "live_directory",
      }),
    )
    .filter((location) => location.distance_km <= options.radiusKm)
    .sort((first, second) => first.distance_km - second.distance_km);

/** Coordinates used when a collector declines geolocation and picks an area instead. */
export const AREA_CENTROIDS: Readonly<Record<string, GeoCoordinates>> = {
  "Greater Accra": { latitude: 5.6037, longitude: -0.187, source: "manual" },
  "Ashanti Region": { latitude: 6.6885, longitude: -1.6244, source: "manual" },
  "Northern Region": { latitude: 9.4008, longitude: -0.8393, source: "manual" },
};

export const DEFAULT_AREA_LABEL = "Greater Accra";

export const findLocationName = (locationId: string | undefined): string | undefined =>
  ENTRIES.find((entry) => entry.location_id === locationId)?.name;

export const ALL_DIRECTORY_LOCATIONS: readonly DirectoryEntry[] = ENTRIES;
