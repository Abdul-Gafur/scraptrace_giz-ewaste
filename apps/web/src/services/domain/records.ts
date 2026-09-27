import {
  RecoveryRecordStateSchema,
  type EwasteCategory,
  type RecoveryRecord,
  type RecoveryRecordState,
  type ReportingFiltersSchema,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { toKilograms } from "./flags";

/**
 * Derivations over the shared record repository. Every programme total is computed here from
 * the same records every role reads, so no dashboard can display a number that no record
 * supports.
 */

/** The only state that counts as verified recovery (BR-010, FR-DSH-004). */
export const VERIFIED_STATE: RecoveryRecordState = "approved_and_completed";

export type ReportingFilters = z.infer<typeof ReportingFiltersSchema>;

const calendarDateOf = (record: RecoveryRecord): string => record.captured_at.slice(0, 10);

export const matchesReportingFilters = (
  record: RecoveryRecord,
  filters: Omit<ReportingFilters, "pagination">,
): boolean => {
  const captured = calendarDateOf(record);
  if (filters.date_from && captured < filters.date_from) return false;
  if (filters.date_to && captured > filters.date_to) return false;
  if (
    filters.categories &&
    filters.categories.length > 0 &&
    !filters.categories.includes(record.category)
  ) {
    return false;
  }
  if (
    filters.states &&
    filters.states.length > 0 &&
    !filters.states.includes(record.business_state)
  ) {
    return false;
  }
  if (filters.coarse_area && record.approximate_area.label !== filters.coarse_area) return false;
  if (
    filters.receiving_location_id &&
    record.handoff?.receiving_location_id !== filters.receiving_location_id
  ) {
    return false;
  }
  return true;
};

export const emptyStateCounts = (): Record<RecoveryRecordState, number> =>
  Object.fromEntries(RecoveryRecordStateSchema.options.map((state) => [state, 0])) as Record<
    RecoveryRecordState,
    number
  >;

export const countByState = (
  records: readonly RecoveryRecord[],
): Record<RecoveryRecordState, number> => {
  const counts = emptyStateCounts();
  for (const record of records) counts[record.business_state] += 1;
  return counts;
};

/** Weight measured at handoff, in kilograms, for records in the verified state only. */
export const verifiedWeightKilograms = (records: readonly RecoveryRecord[]): number =>
  records
    .filter((record) => record.business_state === VERIFIED_STATE)
    .reduce(
      (total, record) =>
        record.handoff ? total + toKilograms(record.handoff.measured_weight) : total,
      0,
    );

/** Recovered material weight in kilograms. Counted only for verified records. */
export const verifiedRecoveredMaterialKilograms = (records: readonly RecoveryRecord[]): number =>
  records
    .filter((record) => record.business_state === VERIFIED_STATE)
    .flatMap((record) => record.processing?.material_entries ?? [])
    .reduce((total, entry) => total + toKilograms(entry.weight), 0);

export const countByCategory = (
  records: readonly RecoveryRecord[],
): ReadonlyMap<EwasteCategory, number> => {
  const counts = new Map<EwasteCategory, number>();
  for (const record of records) {
    counts.set(record.category, (counts.get(record.category) ?? 0) + 1);
  }
  return counts;
};

export const countUnresolvedFlags = (records: readonly RecoveryRecord[]): number =>
  records.filter(
    (record) => record.review.flag_codes.length > 0 && record.review.review_state === "open",
  ).length;

export const participatingLocationIds = (records: readonly RecoveryRecord[]): readonly string[] => [
  ...new Set(
    records
      .map((record) => record.handoff?.receiving_location_id)
      .filter((value): value is string => typeof value === "string"),
  ),
];

/** Records that still need a reviewer decision. */
export const isAwaitingReview = (record: RecoveryRecord): boolean =>
  record.business_state === "under_review";

/** Terminal records must not be silently edited (ADR-003). */
export const isTerminal = (record: RecoveryRecord): boolean =>
  record.business_state === "approved_and_completed" || record.business_state === "rejected";

export interface DailyTrendPoint {
  readonly calendarDate: string;
  readonly submitted: number;
  readonly verified: number;
}

/** Submission and verification counts per capture day, oldest first. */
export const dailyTrend = (records: readonly RecoveryRecord[]): readonly DailyTrendPoint[] => {
  const days = new Map<string, { submitted: number; verified: number }>();
  for (const record of records) {
    const day = calendarDateOf(record);
    const entry = days.get(day) ?? { submitted: 0, verified: 0 };
    entry.submitted += 1;
    if (record.business_state === VERIFIED_STATE) entry.verified += 1;
    days.set(day, entry);
  }
  return [...days.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([calendarDate, counts]) => ({ calendarDate, ...counts }));
};
