"use client";

import type { RecoveryRecordEvent } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";

import { SectionLabel } from "@/components/ui/content";

import { useContractLabels } from "./contract-labels";
import { useValueFormats } from "./formats";

/**
 * Append-only record history in time order (FR-DSH-001, FR-REV-008).
 *
 * Each entry names the event, who performed it, when, and the state it moved the record from and
 * to. The list is read-only for every role.
 */
export function RecordTimeline({ events }: { events: readonly RecoveryRecordEvent[] }) {
  const translate = useTranslations("record");
  const translateRoles = useTranslations("roles");
  const translateStatus = useTranslations("status");
  const labels = useContractLabels();
  const formats = useValueFormats();

  if (events.length === 0) {
    return <p className="text-muted-foreground text-xs">{translate("noEvents")}</p>;
  }

  return (
    <div className="space-y-2">
      <SectionLabel>{translate("timeline")}</SectionLabel>
      <ol className="border-s ps-4">
        {events.map((event) => (
          <li className="relative pb-4 last:pb-0" key={event.event_id}>
            <span
              aria-hidden="true"
              className="bg-primary absolute -start-[1.3125rem] top-1.5 size-2 rounded-full"
            />
            <p className="text-sm font-bold">{labels.event(event.event_type)}</p>
            <p className="text-muted-foreground text-xs">
              {formats.dateTime(event.occurred_at)} ·{" "}
              {event.actor_role === "system"
                ? translate("systemActor")
                : translateRoles(event.actor_role)}
            </p>
            <p className="text-muted-foreground text-xs">
              {translateStatus(event.previous_state)} → {translateStatus(event.resulting_state)}
            </p>
            {event.reason ? <p className="text-foreground mt-1 text-xs">{event.reason}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
