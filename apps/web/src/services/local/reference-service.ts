import {
  ProgrammeViewSchema,
  ReceivingLocationListSchema,
  type ReceivingLocationView,
} from "@scraptrace/contracts";

import { DEMO_FACILITY_ID, DEMO_PROGRAMME_ID } from "@/auth/actors";
import type { ReferenceDataService } from "@/services/ports/service-ports";

import { pause, type LocalServiceContext } from "./context";
import { validationFailed } from "./errors";
import { ALL_DIRECTORY_LOCATIONS } from "./location-directory";

const directory = (): readonly ReceivingLocationView[] =>
  ReceivingLocationListSchema.parse(
    ALL_DIRECTORY_LOCATIONS.map((entry) => ({
      location_id: entry.location_id,
      facility_id: DEMO_FACILITY_ID,
      name: entry.name,
      facility_type: entry.facility_type,
      verification_status: entry.verification_status,
      verification_date: entry.verification_date ?? null,
      accepted_categories: [...entry.accepted_categories],
    })),
  );

/** Programme reference data from the demonstration repository, shaped like the API's. */
export const createReferenceService = (context: LocalServiceContext): ReferenceDataService => ({
  async getProgramme() {
    await pause(context.delayMilliseconds);
    const settings = context.repository.getProgrammeSettings();
    if (!settings) throw validationFailed("Programme settings are not available.");
    return ProgrammeViewSchema.parse({
      programme_id: DEMO_PROGRAMME_ID,
      name: settings.programme_name,
      currency: settings.currency,
      country_code: settings.country_code,
      weight_discrepancy_threshold_percentage: settings.weight_discrepancy_threshold_percentage,
    });
  },
  async listDestinations() {
    await pause(context.delayMilliseconds);
    return directory().filter((location) => location.verification_status !== "suspended");
  },
  async listReceivingLocations() {
    await pause(context.delayMilliseconds);
    return directory().filter((location) =>
      context.actor.locationIds.includes(location.location_id),
    );
  },
});
