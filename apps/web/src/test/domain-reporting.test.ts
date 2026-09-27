import { RecoveryRecordStateSchema, type RecoveryRecord } from "@scraptrace/contracts";

import {
  VERIFIED_STATE,
  countByCategory,
  countByState,
  countUnresolvedFlags,
  dailyTrend,
  isTerminal,
  matchesReportingFilters,
  participatingLocationIds,
  verifiedRecoveredMaterialKilograms,
  verifiedWeightKilograms,
} from "@/services/domain/records";
import { ensureSeeded, seedRepository } from "@/services/local/seed";
import { ScrapTraceRepository } from "@/services/local/repository";
import { DEMO_LOCATION_IDS } from "@/auth/actors";

const makeRepository = () =>
  new ScrapTraceRepository({
    durable: false,
    read: () => null,
    write: () => ({ ok: true }) as const,
    clear: () => undefined,
  });

let records: readonly RecoveryRecord[];

beforeAll(async () => {
  const repository = makeRepository();
  seedRepository(repository);
  await ensureSeeded(repository);
  records = repository.listRecords();
});

describe("derived programme totals", () => {
  it("counts every lifecycle state, including the ones with no records", () => {
    const counts = countByState(records);
    expect(Object.keys(counts).sort()).toEqual([...RecoveryRecordStateSchema.options].sort());
    expect(Object.values(counts).reduce((total, value) => total + value, 0)).toBe(records.length);
  });

  it("counts only approved and completed records towards verified weight", () => {
    const approved = records.filter((record) => record.business_state === VERIFIED_STATE);
    expect(approved.length).toBeGreaterThan(0);
    const expected = approved.reduce(
      (total, record) =>
        record.handoff
          ? total +
            (record.handoff.measured_weight.unit === "kg"
              ? record.handoff.measured_weight.value
              : record.handoff.measured_weight.value / 1000)
          : total,
      0,
    );
    expect(verifiedWeightKilograms(records)).toBeCloseTo(expected, 6);
  });

  it("excludes a rejected record from verified weight even though it has a measured weight", () => {
    const rejected = records.find((record) => record.business_state === "rejected");
    expect(rejected?.handoff).toBeDefined();
    expect(verifiedWeightKilograms([rejected as RecoveryRecord])).toBe(0);
  });

  it("excludes a record under review from verified weight", () => {
    const underReview = records.filter((record) => record.business_state === "under_review");
    expect(underReview.length).toBeGreaterThan(0);
    expect(verifiedWeightKilograms(underReview)).toBe(0);
  });

  it("excludes a draft from verified weight", () => {
    const drafts = records.filter((record) => record.business_state === "draft");
    expect(drafts.length).toBeGreaterThan(0);
    expect(verifiedWeightKilograms(drafts)).toBe(0);
  });

  it("counts recovered material only for verified records", () => {
    const recovered = verifiedRecoveredMaterialKilograms(records);
    const approvedRecovered = records
      .filter((record) => record.business_state === VERIFIED_STATE)
      .flatMap((record) => record.processing?.material_entries ?? [])
      .reduce(
        (total, entry) =>
          total + (entry.weight.unit === "kg" ? entry.weight.value : entry.weight.value / 1000),
        0,
      );
    expect(recovered).toBeCloseTo(approvedRecovered, 6);
  });

  it("counts records per category without inventing categories", () => {
    const counts = countByCategory(records);
    expect([...counts.values()].reduce((total, value) => total + value, 0)).toBe(records.length);
  });

  it("counts records whose flags are still open", () => {
    expect(countUnresolvedFlags(records)).toBeGreaterThan(0);
  });

  it("lists the receiving locations that actually appear on a handoff", () => {
    const locations = participatingLocationIds(records);
    expect(locations.length).toBeGreaterThan(0);
    for (const id of locations) {
      expect(Object.values(DEMO_LOCATION_IDS)).toContain(id);
    }
  });

  it("builds a day-by-day trend from capture dates only, oldest first", () => {
    const trend = dailyTrend(records);
    expect(trend.length).toBeGreaterThan(1);
    expect([...trend].sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))).toEqual(trend);
    expect(trend.reduce((total, point) => total + point.submitted, 0)).toBe(records.length);
  });

  it("treats only approved and rejected records as terminal", () => {
    for (const record of records) {
      expect(isTerminal(record)).toBe(
        record.business_state === "approved_and_completed" || record.business_state === "rejected",
      );
    }
  });
});

describe("reporting filters", () => {
  it("matches everything when no filter is set", () => {
    expect(records.every((record) => matchesReportingFilters(record, {}))).toBe(true);
  });

  it("filters by capture date range inclusively", () => {
    const sorted = [...records].sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    const first = sorted[0] as RecoveryRecord;
    const day = first.captured_at.slice(0, 10);
    const onThatDay = records.filter((record) => record.captured_at.slice(0, 10) === day);
    expect(
      records.filter((record) => matchesReportingFilters(record, { date_from: day, date_to: day })),
    ).toEqual(onThatDay);
  });

  it("filters by category", () => {
    const filtered = records.filter((record) =>
      matchesReportingFilters(record, { categories: ["televisions"] }),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((record) => record.category === "televisions")).toBe(true);
  });

  it("filters by lifecycle state", () => {
    const filtered = records.filter((record) =>
      matchesReportingFilters(record, { states: ["approved_and_completed"] }),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((record) => record.business_state === "approved_and_completed")).toBe(
      true,
    );
  });

  it("filters by receiving location", () => {
    const filtered = records.filter((record) =>
      matchesReportingFilters(record, { receiving_location_id: DEMO_LOCATION_IDS.recycler }),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (record) => record.handoff?.receiving_location_id === DEMO_LOCATION_IDS.recycler,
      ),
    ).toBe(true);
  });

  it("filters by coarse area and excludes a non-matching area", () => {
    expect(
      records.filter((record) => matchesReportingFilters(record, { coarse_area: "Greater Accra" }))
        .length,
    ).toBe(records.length);
    expect(
      records.filter((record) => matchesReportingFilters(record, { coarse_area: "Nowhere" }))
        .length,
    ).toBe(0);
  });

  it("applies several filters together", () => {
    const filtered = records.filter((record) =>
      matchesReportingFilters(record, {
        categories: ["televisions"],
        states: ["rejected"],
      }),
    );
    expect(
      filtered.every(
        (record) => record.category === "televisions" && record.business_state === "rejected",
      ),
    ).toBe(true);
  });

  it("treats an empty filter array as no restriction", () => {
    expect(
      records.filter((record) => matchesReportingFilters(record, { categories: [], states: [] }))
        .length,
    ).toBe(records.length);
  });
});
