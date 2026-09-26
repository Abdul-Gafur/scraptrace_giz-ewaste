"use client";

import { EWASTE_CATEGORIES, FacilityTypeSchema, type EwasteCategory } from "@scraptrace/contracts";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useOnlineStatus } from "@/components/feedback/connectivity";
import { InfoPanel } from "@/components/ui/card";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useDate } from "@/i18n/use-date";
import { useNumber } from "@/i18n/use-number";
import { useNearbyLocations } from "@/services/queries";

type FacilityType = (typeof FacilityTypeSchema.options)[number];

/**
 * No Figma frame. The location service decides what is shown: it returns results, or the safe
 * holding message when nothing accepts the category. Freshness and verification travel with
 * every entry, because an out-of-date directory is the failure mode that matters here.
 */
export function LocationsScreen() {
  const translate = useTranslations("screens.locations");
  const translateTypes = useTranslations("screens.facilityTypes");
  const translateWorkflow = useTranslations("screens.workflow");
  const translateCategories = useTranslations("categories");
  const translatePages = useTranslations("pages");
  const number = useNumber();
  const date = useDate();
  const online = useOnlineStatus();
  const [type, setType] = useState<"all" | FacilityType>("all");
  const [category, setCategory] = useState<"all" | EwasteCategory>("all");

  const search = useNearbyLocations({
    categories: category === "all" ? EWASTE_CATEGORIES : [category],
    radiusKm: 25,
    ...(type === "all" ? {} : { facilityTypes: [type] }),
    offline: !online,
  });

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading visuallyHiddenBelowDesktop>{translatePages("locationsTitle")}</PageHeading>

      <div className="flex flex-wrap gap-3">
        <FilterControl
          label={translate("filterCategory")}
          onChange={(event) => setCategory(event.target.value as "all" | EwasteCategory)}
          options={[
            { value: "all", label: translate("categoryAll") },
            ...EWASTE_CATEGORIES.map((option) => ({
              value: option,
              label: translateCategories(option),
            })),
          ]}
          value={category}
        />
        <FilterControl
          label={translate("filterType")}
          onChange={(event) => setType(event.target.value as "all" | FacilityType)}
          options={[
            { value: "all", label: translate("typeAll") },
            ...FacilityTypeSchema.options.map((option) => ({
              value: option,
              label: translateTypes(option),
            })),
          ]}
          value={type}
        />
      </div>

      {search.isPending ? <Skeleton className="h-40 w-full" /> : null}

      {search.data?.outcome === "results" ? (
        <>
          <InfoPanel as="h2" title={translate("freshnessTitle")} tone="info">
            {translate("freshnessText", { date: date(search.data.data_as_of.slice(0, 10)) })}
            {search.data.offline_limitations ? ` ${search.data.offline_limitations}` : ""}
          </InfoPanel>

          <section aria-labelledby="locations-heading" className="space-y-2">
            <SectionLabel>
              <span id="locations-heading">
                {translate("resultsHeading", { count: number(search.data.locations.length) })}
              </span>
            </SectionLabel>
            <ul className="space-y-2">
              {search.data.locations.map((location) => (
                <li className="bg-surface rounded-md border p-4" key={location.location_id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-foreground text-sm font-bold">{location.name}</h3>
                    <ToneBadge
                      tone={
                        location.verification_status === "programme_verified"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {translateWorkflow(
                        location.verification_status === "programme_verified"
                          ? "verified"
                          : "unverified",
                      )}
                    </ToneBadge>
                  </div>
                  <p className="text-primary mt-1 flex items-center gap-1 text-xs font-bold">
                    <MapPin aria-hidden="true" className="size-4" />
                    {translate("distance", { value: number(location.distance_km) })}
                    <span aria-hidden="true">·</span>
                    <span className="text-muted-foreground font-normal">
                      {translateTypes(location.facility_type)}
                    </span>
                  </p>
                  <DefinitionList className="mt-3 text-xs">
                    <DefinitionRow term={translate("accepted")}>
                      {location.accepted_categories
                        .map((accepted) => translateCategories(accepted))
                        .join(", ")}
                    </DefinitionRow>
                    {location.opening_information ? (
                      <DefinitionRow term={translate("hours")}>
                        {location.opening_information}
                      </DefinitionRow>
                    ) : null}
                    <DefinitionRow term={translate("lastReviewed")}>
                      {date(location.last_reviewed_at.slice(0, 10))}
                    </DefinitionRow>
                  </DefinitionList>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {search.data?.outcome === "no_results" ? (
        <InfoPanel as="h2" title={translate("safeHoldingTitle")} tone="warning">
          <p>{search.data.safe_holding_message}</p>
          {search.data.programme_contact ? (
            <p className="mt-2 font-bold">{search.data.programme_contact}</p>
          ) : null}
        </InfoPanel>
      ) : null}
    </div>
  );
}
