"use client";

import { RecoveryRecordEventTypeSchema } from "@scraptrace/contracts";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { PageHeading } from "@/components/ui/content";
import { FilterControl } from "@/components/ui/filter-control";
import { Pagination } from "@/components/ui/pagination";
import { AsyncPanel } from "@/features/shared/async-panel";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import { useOperationalRecords } from "@/hooks/use-records";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useServices } from "@/services/service-provider";

const PAGE_SIZE = 20;

/**
 * Append-only system history across records (FR-REV-008).
 *
 * Every accepted state change is listed with its actor role, its time and the states it moved
 * between. Nothing on this screen can change an entry.
 */
export function SystemHistory() {
  const translate = useTranslations("screens.reviewHistory");
  const translateStatus = useTranslations("status");
  const translateRoles = useTranslations("roles");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const services = useServices();
  const recordsQuery = useOperationalRecords();
  const [eventType, setEventType] = useState("all");
  const [page, setPage] = useState(1);

  const eventsQuery = useQuery({
    queryKey: ["records", "all-events", (recordsQuery.data ?? []).length],
    enabled: recordsQuery.isSuccess,
    queryFn: async () => {
      const lists = await Promise.all(
        (recordsQuery.data ?? []).map(async (record) => {
          const events = await services.recoveryRecords.listEvents(record.record_id);
          return events.map((event) => ({ event, reference: record.human_reference }));
        }),
      );
      return lists
        .flat()
        .sort((first, second) => second.event.occurred_at.localeCompare(first.event.occurred_at));
    },
  });

  const rows = useMemo(
    () =>
      (eventsQuery.data ?? []).filter(
        (entry) => eventType === "all" || entry.event.event_type === eventType,
      ),
    [eventType, eventsQuery.data],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeading description={translate("description")}>{translate("title")}</PageHeading>

      <FilterControl
        label={translate("filterEvent")}
        onChange={(event) => {
          setEventType(event.target.value);
          setPage(1);
        }}
        options={[
          { value: "all", label: translate("allEvents") },
          ...RecoveryRecordEventTypeSchema.options.map((value) => ({
            value,
            label: labels.event(value),
          })),
        ]}
        value={eventType}
      />
      <p className="text-muted-foreground text-xs" role="status">
        {translate("resultCount", { count: formats.number(rows.length, 0) })}
      </p>

      <AsyncPanel isEmpty={() => rows.length === 0} query={eventsQuery}>
        {() => (
          <>
            <ul className="space-y-2">
              {visible.map((entry) => (
                <li className="bg-surface rounded-md border p-3" key={entry.event.event_id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">{labels.event(entry.event.event_type)}</p>
                    <Link
                      className="text-info font-mono text-xs font-bold underline-offset-2 hover:underline"
                      href={`/review/queue/${entry.event.recovery_record_id}`}
                    >
                      {entry.reference}
                    </Link>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formats.dateTime(entry.event.occurred_at)} ·{" "}
                    {entry.event.actor_role === "system"
                      ? translate("systemActor")
                      : translateRoles(entry.event.actor_role)}{" "}
                    · {translateStatus(entry.event.previous_state)} →{" "}
                    {translateStatus(entry.event.resulting_state)}
                  </p>
                  {entry.event.reason ? (
                    <p className="text-foreground mt-1 text-xs">{entry.event.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {pageCount > 1 ? (
              <Pagination onPageChange={setPage} page={currentPage} pageCount={pageCount} />
            ) : null}
          </>
        )}
      </AsyncPanel>
    </div>
  );
}
