"use client";

import { EwasteCategorySchema, type EwasteCategory } from "@scraptrace/contracts";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useLocationSearch } from "@/hooks/use-locations";
import { AREA_CENTROIDS } from "@/services/local/location-directory";

const AREAS = Object.keys(AREA_CENTROIDS);
const RADIUS_OPTIONS = [5, 15, 50, 200] as const;

/**
 * Nearby participating locations (FR-LOC-002 to FR-LOC-007).
 *
 * Geolocation is requested only when the user asks for it, and a denial falls back to an area
 * choice rather than an empty screen. A verified badge appears only for a programme-verified
 * profile; anything else says plainly that it is not programme verified.
 */
export function LocationsScreen() {
  const translate = useTranslations("screens.locations");
  const translatePages = useTranslations("pages");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const [category, setCategory] = useState<EwasteCategory>("refrigerators");
  const [area, setArea] = useState(AREAS[0] ?? "Greater Accra");
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [coordinates, setCoordinates] = useState<
    { latitude: number; longitude: number } | undefined
  >();
  const [locationNotice, setLocationNotice] = useState<string | undefined>();

  const query = useLocationSearch({
    category,
    areaLabel: area,
    radiusKm,
    ...(coordinates ? { coordinates } : {}),
    offline: false,
  });

  const requestLocation = () => {
    setLocationNotice(undefined);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationNotice(translate("locationUnsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationNotice(translate("locationUsed"));
      },
      () => setLocationNotice(translate("locationDenied")),
      { timeout: 10_000 },
    );
  };

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeading description={translate("description")} visuallyHiddenBelowDesktop>
        {translatePages("locationsTitle")}
      </PageHeading>

      <div className="flex flex-wrap items-center gap-3">
        <FilterControl
          label={translate("filterCategory")}
          onChange={(event) => setCategory(event.target.value as EwasteCategory)}
          options={EwasteCategorySchema.options.map((value) => ({
            value,
            label: labels.category(value),
          }))}
          value={category}
        />
        <FilterControl
          label={translate("filterArea")}
          onChange={(event) => {
            setArea(event.target.value);
            setCoordinates(undefined);
          }}
          options={AREAS.map((value) => ({ value, label: value }))}
          value={coordinates ? "" : area}
        />
        <FilterControl
          label={translate("filterRadius")}
          onChange={(event) => setRadiusKm(Number(event.target.value))}
          options={RADIUS_OPTIONS.map((value) => ({
            value: String(value),
            label: translate("radiusOption", { value: formats.number(value, 0) }),
          }))}
          value={String(radiusKm)}
        />
      </div>

      <div className="space-y-2">
        <Button onClick={requestLocation} variant="secondary">
          <MapPin aria-hidden="true" className="size-4" />
          {translate("useLocation")}
        </Button>
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {locationNotice ?? translate("locationHint")}
        </p>
      </div>

      <AsyncPanel query={query} skeletonRows={2}>
        {(response) => {
          if (response.outcome === "no_results") {
            return (
              <Alert title={translate("noResultsTitle")} tone="warning">
                <p>{response.safe_holding_message}</p>
                {response.programme_contact ? (
                  <p className="mt-1 font-semibold">{response.programme_contact}</p>
                ) : null}
              </Alert>
            );
          }
          if (response.outcome === "location_permission_denied") {
            return (
              <Alert title={translate("permissionDeniedTitle")} tone="info">
                {translate("permissionDenied")}
              </Alert>
            );
          }
          if (response.outcome === "offline_data_unavailable") {
            return (
              <Alert title={translate("offlineTitle")} tone="warning">
                {response.message}
              </Alert>
            );
          }
          return (
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs">
                {translate("dataAsOf", { when: formats.dateTime(response.data_as_of) ?? "" })}
              </p>
              {response.offline_limitations ? (
                <Alert title={translate("cachedTitle")} tone="info">
                  {response.offline_limitations}
                </Alert>
              ) : null}
              <ul className="space-y-2">
                {response.locations.map((location) => (
                  <li
                    className="bg-surface space-y-2 rounded-md border p-4"
                    key={location.location_id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-bold">{location.name}</p>
                      {location.verification_status === "programme_verified" ? (
                        <Badge className="bg-success-subtle text-success-strong">
                          {translate("verified")}
                        </Badge>
                      ) : (
                        <Badge className="bg-neutral-subtle text-muted-foreground">
                          {translate("notVerified")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {labels.facilityType(location.facility_type)} ·{" "}
                      {translate("distance", {
                        value: formats.number(location.distance_km, 1),
                      })}
                    </p>
                    {location.opening_information ? (
                      <p className="text-muted-foreground text-xs">
                        {location.opening_information}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {translate("accepts", {
                        list: location.accepted_categories
                          .map((value) => labels.category(value))
                          .join(", "),
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="min-h-touch text-info inline-flex items-center gap-1 text-xs font-bold underline-offset-2 hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${location.coordinates.latitude}&mlon=${location.coordinates.longitude}#map=16/${location.coordinates.latitude}/${location.coordinates.longitude}`}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" className="size-4" />
                        {translate("directions")}
                      </a>
                      {location.display_contact ? (
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                          <Phone aria-hidden="true" className="size-4" />
                          {location.display_contact}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs leading-5">
                {translate("listingNotice")}
              </p>
            </div>
          );
        }}
      </AsyncPanel>
    </div>
  );
}
