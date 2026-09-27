import { buildCsv, buildExportFilename, escapeCsvValue } from "@/services/domain/csv";
import {
  REASON_CODES_BY_DECISION,
  evaluateHandoffFlags,
  evaluateProcessingFlags,
  toKilograms,
  weightDifferenceRatio,
} from "@/services/domain/flags";
import {
  idempotencyKeyFor,
  newHumanReference,
  newLookupToken,
  newRecoveryRecordId,
} from "@/services/domain/identifiers";
import { validateProgrammeSettings } from "@/services/domain/programme-settings";
import { ModelConfigurationSchema } from "@/services/domain/model-administration";
import {
  canTransitionSafetyCard,
  isExpiredSafetyCard,
  isServableSafetyCard,
  nextCardVersion,
  SafetyCardSchema,
} from "@/services/domain/safety-content";
import { toCalendarDate, addDays } from "@/services/domain/time";
import { newUuid } from "@/services/domain/identifiers";

const allEvidence = new Set([
  "handoff_qr_scan",
  "recycler_receipt",
  "handoff_photo",
  "weight_measurement",
] as const);

describe("weight rules", () => {
  it("normalises grams to kilograms", () => {
    expect(toKilograms({ value: 2500, unit: "g" })).toBe(2.5);
    expect(toKilograms({ value: 2.5, unit: "kg" })).toBe(2.5);
  });

  it("treats an absent declared weight as no discrepancy rather than a difference", () => {
    expect(weightDifferenceRatio(undefined, { value: 10, unit: "kg" })).toBeNull();
  });

  it("computes the difference as a fraction of the declared weight", () => {
    expect(weightDifferenceRatio({ value: 20, unit: "kg" }, { value: 23, unit: "kg" })).toBeCloseTo(
      0.15,
    );
    expect(weightDifferenceRatio({ value: 20, unit: "kg" }, { value: 17, unit: "kg" })).toBeCloseTo(
      0.15,
    );
  });

  it("compares across units", () => {
    expect(weightDifferenceRatio({ value: 1, unit: "kg" }, { value: 1000, unit: "g" })).toBe(0);
  });
});

describe("handoff flag rules", () => {
  const base = {
    declaredWeight: { value: 20, unit: "kg" } as const,
    declaredCategory: "televisions" as const,
    confirmedCategory: "televisions" as const,
    thresholdPercentage: 15,
    duplicateEvidenceDigest: false,
    availableEvidence: allEvidence,
  };

  it("raises nothing when everything agrees", () => {
    expect(evaluateHandoffFlags({ ...base, measuredWeight: { value: 21, unit: "kg" } })).toEqual(
      [],
    );
  });

  it("treats the threshold as exclusive, so exactly at the threshold is not flagged", () => {
    expect(evaluateHandoffFlags({ ...base, measuredWeight: { value: 23, unit: "kg" } })).toEqual(
      [],
    );
  });

  it("flags a weight beyond the threshold", () => {
    expect(evaluateHandoffFlags({ ...base, measuredWeight: { value: 31, unit: "kg" } })).toEqual([
      "WEIGHT_DISCREPANCY",
    ]);
  });

  it("flags a category disagreement", () => {
    expect(
      evaluateHandoffFlags({
        ...base,
        measuredWeight: { value: 20, unit: "kg" },
        confirmedCategory: "microwaves",
      }),
    ).toEqual(["CATEGORY_DISAGREEMENT"]);
  });

  it("flags reused evidence content", () => {
    expect(
      evaluateHandoffFlags({
        ...base,
        measuredWeight: { value: 20, unit: "kg" },
        duplicateEvidenceDigest: true,
      }),
    ).toEqual(["DUPLICATE_EVIDENCE_DIGEST"]);
  });

  it("flags incomplete evidence", () => {
    expect(
      evaluateHandoffFlags({
        ...base,
        measuredWeight: { value: 20, unit: "kg" },
        availableEvidence: new Set(["handoff_photo"] as const),
      }),
    ).toEqual(["INCOMPLETE_EVIDENCE"]);
  });

  it("raises every applicable flag, in a stable order", () => {
    expect(
      evaluateHandoffFlags({
        ...base,
        measuredWeight: { value: 40, unit: "kg" },
        confirmedCategory: "microwaves",
        duplicateEvidenceDigest: true,
        availableEvidence: new Set(),
      }),
    ).toEqual([
      "WEIGHT_DISCREPANCY",
      "CATEGORY_DISAGREEMENT",
      "DUPLICATE_EVIDENCE_DIGEST",
      "INCOMPLETE_EVIDENCE",
    ]);
  });

  it("uses the configured programme threshold", () => {
    const measured = { value: 24, unit: "kg" } as const;
    expect(
      evaluateHandoffFlags({ ...base, measuredWeight: measured, thresholdPercentage: 25 }),
    ).toEqual([]);
    expect(
      evaluateHandoffFlags({ ...base, measuredWeight: measured, thresholdPercentage: 5 }),
    ).toEqual(["WEIGHT_DISCREPANCY"]);
  });
});

describe("processing flag rules", () => {
  it("allows recovered material to weigh less than the received item", () => {
    expect(
      evaluateProcessingFlags({
        receivedWeight: { value: 30, unit: "kg" },
        materialWeights: [{ value: 12, unit: "kg" }],
        requiresMaterialWeights: true,
      }),
    ).toEqual([]);
  });

  it("flags material recovery recorded with no material rows", () => {
    expect(
      evaluateProcessingFlags({
        receivedWeight: { value: 30, unit: "kg" },
        materialWeights: [],
        requiresMaterialWeights: true,
      }),
    ).toEqual(["MISSING_MATERIAL_WEIGHTS"]);
  });

  it("does not require material rows for a referral", () => {
    expect(
      evaluateProcessingFlags({
        receivedWeight: { value: 30, unit: "kg" },
        materialWeights: [],
        requiresMaterialWeights: false,
      }),
    ).toEqual([]);
  });

  it("flags recovered material heavier than the received item", () => {
    expect(
      evaluateProcessingFlags({
        receivedWeight: { value: 10, unit: "kg" },
        materialWeights: [
          { value: 8, unit: "kg" },
          { value: 4, unit: "kg" },
        ],
        requiresMaterialWeights: true,
      }),
    ).toEqual(["PROCESSED_WEIGHT_ABOVE_RECEIVED"]);
  });
});

describe("review reason codes", () => {
  it("offers reason codes for each contract decision and nothing else", () => {
    expect(Object.keys(REASON_CODES_BY_DECISION).sort()).toEqual([
      "approve",
      "reject",
      "request_correction",
    ]);
    for (const codes of Object.values(REASON_CODES_BY_DECISION)) {
      expect(codes.length).toBeGreaterThan(0);
    }
  });
});

describe("CSV serialisation", () => {
  it("quotes values containing a separator, a quote or a newline", () => {
    expect(escapeCsvValue("plain")).toBe("plain");
    expect(escapeCsvValue("with,comma")).toBe('"with,comma"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises a value a spreadsheet would treat as a formula", () => {
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(escapeCsvValue("-2")).toBe("'-2");
    expect(escapeCsvValue("@cmd")).toBe("'@cmd");
  });

  it("renders empty cells for absent values rather than the word undefined", () => {
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue(null)).toBe("");
  });

  it("writes a header row, CRLF line endings and a trailing newline", () => {
    const csv = buildCsv(
      [
        { heading: "reference", value: (row: { reference: string }) => row.reference },
        { heading: "note", value: () => "a,b" },
      ],
      [{ reference: "ST-AAAAAAAA" }],
    );
    expect(csv).toBe('reference,note\r\nST-AAAAAAAA,"a,b"\r\n');
  });

  it("builds a meaningful, file-system-safe filename", () => {
    expect(buildExportFilename("ScrapTrace Demonstration Programme", "records", "2026-09-27")).toBe(
      "scraptrace-scraptrace-demonstration-programme-records-2026-09-27.csv",
    );
    expect(buildExportFilename("!!!", "records", "2026-09-27")).toBe(
      "scraptrace-programme-records-2026-09-27.csv",
    );
  });
});

describe("identifiers", () => {
  it("produces contract-valid identifiers", () => {
    expect(newRecoveryRecordId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(newHumanReference()).toMatch(/^ST-[A-Z0-9]{8,16}$/);
    expect(newLookupToken()).toMatch(/^[a-z0-9]{24}$/);
  });

  it("derives a stable idempotency key for one operation on one record by one actor", () => {
    const recordId = newRecoveryRecordId();
    const actorId = "0199b002-0002-7002-8002-000000000002";
    expect(idempotencyKeyFor("record_handoff", recordId, actorId)).toBe(
      idempotencyKeyFor("record_handoff", recordId, actorId),
    );
    expect(idempotencyKeyFor("record_handoff", recordId, actorId)).not.toBe(
      idempotencyKeyFor("record_processing", recordId, actorId),
    );
  });
});

describe("programme settings validation", () => {
  const valid = {
    programme_name: "Programme",
    currency: "GHS",
    country_code: "GH",
    weight_discrepancy_threshold_percentage: 15,
    supported_languages: ["en", "fr"],
    show_unverified_facilities: true,
    default_report_period_days: 30,
    default_report_states: [],
    updated_at: "2026-09-20T08:00:00.000Z",
  };

  it("accepts valid settings", () => {
    expect(validateProgrammeSettings(valid).success).toBe(true);
  });

  it("rejects a threshold outside the allowed range", () => {
    expect(
      validateProgrammeSettings({ ...valid, weight_discrepancy_threshold_percentage: 0 }).success,
    ).toBe(false);
    expect(
      validateProgrammeSettings({ ...valid, weight_discrepancy_threshold_percentage: 101 }).success,
    ).toBe(false);
  });

  it("rejects removing English, because it is the declared translation fallback", () => {
    const result = validateProgrammeSettings({ ...valid, supported_languages: ["fr"] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed currency or country code", () => {
    expect(validateProgrammeSettings({ ...valid, currency: "ghs" }).success).toBe(false);
    expect(validateProgrammeSettings({ ...valid, country_code: "GHA" }).success).toBe(false);
  });
});

describe("model configuration validation", () => {
  const valid = {
    active_model_version: "0.1.0",
    confidence_threshold: 0.4,
    low_confidence_routing: "manual_confirmation" as const,
    manual_review_categories: [],
    updated_at: "2026-09-20T08:00:00.000Z",
  };

  it("accepts a threshold inside the allowed range", () => {
    expect(ModelConfigurationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a threshold that would disable or fully trust the model", () => {
    expect(ModelConfigurationSchema.safeParse({ ...valid, confidence_threshold: 0 }).success).toBe(
      false,
    );
    expect(ModelConfigurationSchema.safeParse({ ...valid, confidence_threshold: 1 }).success).toBe(
      false,
    );
  });

  it("rejects a routing value outside the supported options", () => {
    expect(
      ModelConfigurationSchema.safeParse({ ...valid, low_confidence_routing: "retrain" }).success,
    ).toBe(false);
  });
});

describe("safety card rules", () => {
  const card = (overrides: Record<string, unknown> = {}) =>
    SafetyCardSchema.parse({
      card_id: newUuid(),
      version: "1.0.0",
      category: "televisions",
      language: "en",
      status: "published",
      answers: {
        what_is_it: "a",
        possible_dangers: "b",
        prohibited_actions: "c",
        safe_actions_now: "d",
        suitable_destination: "e",
      },
      sources: [{ label: "Source", reference: "Reference" }],
      approved_by: "Panel",
      approval_date: "2026-01-01",
      review_date: toCalendarDate(addDays(Date.now(), 30)),
      ai_assisted: false,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    });

  it("requires approver and dates once a card leaves draft", () => {
    expect(
      SafetyCardSchema.safeParse({
        ...card(),
        status: "approved",
        approved_by: undefined,
        approval_date: undefined,
        review_date: undefined,
      }).success,
    ).toBe(false);
  });

  it("requires the review date to be after the approval date", () => {
    expect(SafetyCardSchema.safeParse({ ...card(), review_date: "2025-12-31" }).success).toBe(
      false,
    );
  });

  it("serves only a published card whose review date has not passed", () => {
    expect(isServableSafetyCard(card())).toBe(true);
    expect(isServableSafetyCard(card({ status: "draft" }))).toBe(false);
    expect(isServableSafetyCard(card({ status: "approved" }))).toBe(false);
    expect(isServableSafetyCard(card({ status: "archived" }))).toBe(false);
  });

  it("treats a published card past its review date as expired and unservable", () => {
    const expired = card({ review_date: toCalendarDate(addDays(Date.now(), -1)) });
    expect(isExpiredSafetyCard(expired)).toBe(true);
    expect(isServableSafetyCard(expired)).toBe(false);
  });

  it("allows only the documented status transitions", () => {
    expect(canTransitionSafetyCard("draft", "approved")).toBe(true);
    expect(canTransitionSafetyCard("draft", "published")).toBe(false);
    expect(canTransitionSafetyCard("approved", "published")).toBe(true);
    expect(canTransitionSafetyCard("approved", "draft")).toBe(true);
    expect(canTransitionSafetyCard("published", "archived")).toBe(true);
    expect(canTransitionSafetyCard("published", "draft")).toBe(false);
    expect(canTransitionSafetyCard("archived", "published")).toBe(false);
  });

  it("increments the minor version for a superseding draft", () => {
    expect(nextCardVersion("1.0.0")).toBe("1.1.0");
    expect(nextCardVersion("2.4.0")).toBe("2.5.0");
  });
});
