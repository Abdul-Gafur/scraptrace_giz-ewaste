import {
  PermissionSchema,
  ReportingFiltersSchema,
  ReportingSummarySchema,
  type RecoveryRecord,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { toKilograms } from "@/services/domain/flags";
import {
  countByState,
  matchesReportingFilters,
  verifiedWeightKilograms,
} from "@/services/domain/records";
import { buildCsv, buildExportFilename, type CsvColumn } from "@/services/domain/csv";
import { nowUtc, todayCalendarDate } from "@/services/domain/time";
import type {
  DataExportResult,
  DataExportService,
  ReportingService,
} from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { findLocationName } from "./location-directory";

const permission = PermissionSchema.enum;

type ReportingFilters = z.infer<typeof ReportingFiltersSchema>;

const appliedFilters = (filters: ReportingFilters) => ({
  ...(filters.date_from ? { date_from: filters.date_from } : {}),
  ...(filters.date_to ? { date_to: filters.date_to } : {}),
  ...(filters.categories ? { categories: filters.categories } : {}),
  ...(filters.coarse_area ? { coarse_area: filters.coarse_area } : {}),
  ...(filters.receiving_location_id
    ? { receiving_location_id: filters.receiving_location_id }
    : {}),
  ...(filters.states ? { states: filters.states } : {}),
});

const decodeCursor = (cursor: string | undefined): number => {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Programme reporting (FR-DSH-003 to FR-DSH-005).
 *
 * Counts come from the shared repository, and the verified-weight total includes only records in
 * `approved_and_completed`, which the contract itself pins through `eligible_state`. Drafts,
 * flagged records and rejected records therefore cannot contribute to verified recovery.
 */
export const createReportingService = (context: LocalServiceContext): ReportingService => {
  const { repository } = context;

  const filtered = (filters: ReportingFilters): readonly RecoveryRecord[] =>
    repository
      .listRecords()
      .filter((record) => matchesReportingFilters(record, appliedFilters(filters)))
      .sort((first, second) => second.captured_at.localeCompare(first.captured_at));

  return {
    async summarize(filters) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["programme_report:view"]);
      const parsed = ReportingFiltersSchema.parse(filters);
      const records = filtered(parsed);
      const offset = decodeCursor(parsed.pagination.cursor);
      const nextOffset = offset + parsed.pagination.limit;
      return ReportingSummarySchema.parse({
        record_counts_by_state: countByState(records),
        verified_weight: {
          value: Number(verifiedWeightKilograms(records).toFixed(3)),
          unit: "kg",
          eligible_state: "approved_and_completed",
        },
        applied_filters: appliedFilters(parsed),
        data_freshness_at: nowUtc(),
        pagination: {
          next_cursor: nextOffset < records.length ? String(nextOffset) : null,
          has_more: nextOffset < records.length,
        },
      });
    },

    async listForReport(filters) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["programme_report:view"]);
      const parsed = ReportingFiltersSchema.parse(filters);
      const records = filtered(parsed);
      const offset = decodeCursor(parsed.pagination.cursor);
      return {
        records: records.slice(offset, offset + parsed.pagination.limit),
        total: records.length,
      };
    },
  };
};

/**
 * Authorised CSV export (FR-DSH-007).
 *
 * The export contains programme and evidence facts only. It carries no collector identifier,
 * telephone number, precise coordinate or storage URL, so a spreadsheet cannot become a way to
 * distribute personal data. Headings are stable English identifiers and are never translated,
 * because downstream tooling depends on them.
 */
export const createDataExportService = (context: LocalServiceContext): DataExportService => {
  const { repository } = context;

  const columns: readonly CsvColumn<RecoveryRecord>[] = [
    { heading: "record_reference", value: (record) => record.human_reference },
    { heading: "lifecycle_state", value: (record) => record.business_state },
    { heading: "review_state", value: (record) => record.review.review_state },
    { heading: "category", value: (record) => record.category },
    { heading: "record_kind", value: (record) => record.record_kind },
    { heading: "condition", value: (record) => record.condition },
    { heading: "item_count", value: (record) => record.item_count ?? "" },
    { heading: "captured_at_utc", value: (record) => record.captured_at },
    { heading: "coarse_area", value: (record) => record.approximate_area.label },
    { heading: "country_code", value: (record) => record.approximate_area.country_code },
    {
      heading: "declared_weight_kg",
      value: (record) =>
        record.approximate_weight ? toKilograms(record.approximate_weight).toFixed(3) : "",
    },
    {
      heading: "received_weight_kg",
      value: (record) =>
        record.handoff ? toKilograms(record.handoff.measured_weight).toFixed(3) : "",
    },
    {
      heading: "receiving_location",
      value: (record) => findLocationName(record.handoff?.receiving_location_id) ?? "",
    },
    {
      heading: "recovered_material_kg",
      value: (record) =>
        record.processing
          ? record.processing.material_entries
              .reduce((total, entry) => total + toKilograms(entry.weight), 0)
              .toFixed(3)
          : "",
    },
    { heading: "processing_method", value: (record) => record.processing?.method ?? "" },
    { heading: "review_flags", value: (record) => record.review.flag_codes.join(" ") },
    { heading: "review_decision", value: (record) => record.review.decision ?? "" },
    { heading: "review_reason_code", value: (record) => record.review.reason_code ?? "" },
    { heading: "decided_at_utc", value: (record) => record.review.decided_at ?? "" },
    {
      heading: "counts_towards_verified_weight",
      value: (record) => (record.business_state === "approved_and_completed" ? "yes" : "no"),
    },
  ];

  return {
    async build(filters) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["programme_data:export"]);
      const parsed = ReportingFiltersSchema.parse(filters);
      const records = repository
        .listRecords()
        .filter((record) => matchesReportingFilters(record, appliedFilters(parsed)))
        .sort((first, second) => second.captured_at.localeCompare(first.captured_at));
      const settings = repository.getProgrammeSettings();
      return {
        filename: buildExportFilename(
          settings?.programme_name ?? "programme",
          "records",
          todayCalendarDate(),
        ),
        mimeType: "text/csv",
        content: buildCsv(columns, records),
        rowCount: records.length,
        columnHeadings: columns.map((column) => column.heading),
      } satisfies DataExportResult;
    },
  };
};
