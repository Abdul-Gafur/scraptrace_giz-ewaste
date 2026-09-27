import type { EvidenceType, EwasteCategory } from "@scraptrace/contracts";

/**
 * Named review flags (FR-HND-006, FR-REV-002). A flag records that a value needs human
 * judgement. It is never proof of wrongdoing (BR-009) and never silently blocks or approves a
 * record. Codes are stable identifiers; their user-facing wording lives in the `flags` message
 * namespace.
 */
export const REVIEW_FLAG_CODES = [
  "WEIGHT_DISCREPANCY",
  "CATEGORY_DISAGREEMENT",
  "DUPLICATE_EVIDENCE_DIGEST",
  "INCOMPLETE_EVIDENCE",
  "MISSING_MATERIAL_WEIGHTS",
  "PROCESSED_WEIGHT_ABOVE_RECEIVED",
] as const;

export type ReviewFlagCode = (typeof REVIEW_FLAG_CODES)[number];

export const isReviewFlagCode = (value: string): value is ReviewFlagCode =>
  (REVIEW_FLAG_CODES as readonly string[]).includes(value);

/** Reviewer decision reason codes. Stable values; wording lives in `reviewReasons`. */
export const REVIEW_REASON_CODES = [
  "EVIDENCE_SUFFICIENT",
  "WEIGHT_EXPLAINED",
  "EVIDENCE_INSUFFICIENT",
  "CATEGORY_INCORRECT",
  "WEIGHT_UNEXPLAINED",
  "ADDITIONAL_EVIDENCE_REQUIRED",
] as const;

export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];

/** Reason codes offered for each contract decision outcome. */
export const REASON_CODES_BY_DECISION = {
  approve: ["EVIDENCE_SUFFICIENT", "WEIGHT_EXPLAINED"],
  reject: ["EVIDENCE_INSUFFICIENT", "CATEGORY_INCORRECT", "WEIGHT_UNEXPLAINED"],
  request_correction: ["ADDITIONAL_EVIDENCE_REQUIRED", "EVIDENCE_INSUFFICIENT"],
} as const satisfies Record<
  "approve" | "reject" | "request_correction",
  readonly ReviewReasonCode[]
>;

const GRAMS_PER_KILOGRAM = 1000;

export interface Weight {
  readonly value: number;
  readonly unit: "kg" | "g";
}

export const toKilograms = (weight: Weight): number =>
  weight.unit === "kg" ? weight.value : weight.value / GRAMS_PER_KILOGRAM;

/**
 * Relative difference between a declared and a measured weight, as a fraction of the declared
 * value. Returns `null` when no declared weight exists, because an absent declaration is not a
 * discrepancy.
 */
export const weightDifferenceRatio = (
  declared: Weight | undefined,
  measured: Weight,
): number | null => {
  if (!declared) return null;
  const declaredKg = toKilograms(declared);
  if (declaredKg <= 0) return null;
  return Math.abs(toKilograms(measured) - declaredKg) / declaredKg;
};

export interface HandoffFlagInput {
  readonly declaredWeight: Weight | undefined;
  readonly measuredWeight: Weight;
  readonly declaredCategory: EwasteCategory;
  readonly confirmedCategory: EwasteCategory;
  readonly thresholdPercentage: number;
  readonly duplicateEvidenceDigest: boolean;
  readonly availableEvidence: ReadonlySet<EvidenceType>;
}

const HANDOFF_REQUIRED_EVIDENCE: readonly EvidenceType[] = [
  "handoff_qr_scan",
  "recycler_receipt",
  "handoff_photo",
  "weight_measurement",
];

/** Evaluates the handoff rules and returns the flags that require review, in a stable order. */
export const evaluateHandoffFlags = (input: HandoffFlagInput): readonly ReviewFlagCode[] => {
  const flags: ReviewFlagCode[] = [];
  const ratio = weightDifferenceRatio(input.declaredWeight, input.measuredWeight);
  if (ratio !== null && ratio * 100 > input.thresholdPercentage) {
    flags.push("WEIGHT_DISCREPANCY");
  }
  if (input.confirmedCategory !== input.declaredCategory) flags.push("CATEGORY_DISAGREEMENT");
  if (input.duplicateEvidenceDigest) flags.push("DUPLICATE_EVIDENCE_DIGEST");
  if (HANDOFF_REQUIRED_EVIDENCE.some((evidence) => !input.availableEvidence.has(evidence))) {
    flags.push("INCOMPLETE_EVIDENCE");
  }
  return flags;
};

export interface ProcessingFlagInput {
  readonly receivedWeight: Weight | undefined;
  readonly materialWeights: readonly Weight[];
  readonly requiresMaterialWeights: boolean;
}

/**
 * Processing rules. Recovered material may legitimately weigh less than the received item, so
 * only a recovered total above the received weight is flagged.
 */
export const evaluateProcessingFlags = (input: ProcessingFlagInput): readonly ReviewFlagCode[] => {
  const flags: ReviewFlagCode[] = [];
  if (input.requiresMaterialWeights && input.materialWeights.length === 0) {
    flags.push("MISSING_MATERIAL_WEIGHTS");
  }
  const recovered = input.materialWeights.reduce((total, weight) => total + toKilograms(weight), 0);
  if (input.receivedWeight && recovered > toKilograms(input.receivedWeight)) {
    flags.push("PROCESSED_WEIGHT_ABOVE_RECEIVED");
  }
  return flags;
};
