"use client";

import { UserRoleSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { DefinitionList, DefinitionRow, PageHeading, SectionLabel } from "@/components/ui/content";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { Link } from "@/i18n/navigation";
import { toKilograms } from "@/services/domain/flags";
import { useActingIdentity } from "@/hooks/use-identity";
import { useReceivingLocations } from "@/hooks/use-reference";

/** Facility identity and the receiving locations this account may act on. */
export function RecyclerAccountScreen() {
  const translate = useTranslations("screens.recyclerAccount");
  const identity = useActingIdentity();
  const locations = useReceivingLocations();
  const translateRoles = useTranslations("roles");
  const formats = useValueFormats();
  const query = useOperationalRecords();

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeading>{translate("title")}</PageHeading>

      <section aria-labelledby="identity" className="space-y-2">
        <SectionLabel>
          <span id="identity">{translate("identity")}</span>
        </SectionLabel>
        <div className="bg-surface rounded-md border px-4 py-2">
          <DefinitionList>
            <DefinitionRow term={translate("role")} tone="success">
              {translateRoles(UserRoleSchema.enum.recycler)}
            </DefinitionRow>
            <DefinitionRow term={translate("actorId")}>
              <span className="font-mono text-xs">{identity.actorId}</span>
            </DefinitionRow>
            <DefinitionRow term={translate("facilityId")}>
              <span className="font-mono text-xs">{identity.facilityIds.join(", ")}</span>
            </DefinitionRow>
          </DefinitionList>
        </div>
      </section>

      <section aria-labelledby="locations" className="space-y-2">
        <SectionLabel>
          <span id="locations">{translate("assignedLocations")}</span>
        </SectionLabel>
        <ul className="space-y-2">
          {(locations.data ?? []).map((location) => (
            <li className="bg-surface rounded-md border p-3 text-sm" key={location.location_id}>
              {location.name}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs leading-5">{translate("scopeNotice")}</p>
      </section>

      <section aria-labelledby="totals" className="space-y-2">
        <SectionLabel>
          <span id="totals">{translate("totals")}</span>
        </SectionLabel>
        <AsyncPanel query={query} skeletonRows={1}>
          {(records) => {
            const measured = records.reduce(
              (total, record) =>
                record.handoff ? total + toKilograms(record.handoff.measured_weight) : total,
              0,
            );
            const recovered = records
              .flatMap((record) => record.processing?.material_entries ?? [])
              .reduce((total, entry) => total + toKilograms(entry.weight), 0);
            return (
              <div className="bg-surface rounded-md border px-4 py-2">
                <DefinitionList>
                  <DefinitionRow term={translate("recordsInScope")}>
                    {formats.number(records.length, 0)}
                  </DefinitionRow>
                  <DefinitionRow term={translate("measuredWeight")} tone="success">
                    {formats.kilograms(measured)}
                  </DefinitionRow>
                  <DefinitionRow term={translate("recoveredWeight")} tone="success">
                    {formats.kilograms(recovered)}
                  </DefinitionRow>
                </DefinitionList>
              </div>
            );
          }}
        </AsyncPanel>
      </section>

      <Link
        className={buttonVariants({ variant: "secondary", block: true, size: "large" })}
        href="/sign-in"
      >
        {translate("signOut")}
      </Link>
    </div>
  );
}
