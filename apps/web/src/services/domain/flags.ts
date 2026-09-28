import type { EvidenceType, EwasteCategory, ReviewFlagCode } from "@scraptrace/contracts";

/**
 * Named review flags and reviewer reason codes are shared contract vocabulary
 * (`@scraptrace/contracts`), so the API enforces exactly the codes this interface displays.
 * Their user-facing wording lives in the `flags` and `reviewReasons` message namespaces.
 */
export {
  REASON_CODES_BY_DECISION,
  REVIEW_FLAG_CODES,
  REVIEW_REASON_CODES,
  isReviewFlagCode,
  type ReviewFlagCode,
  type ReviewReasonCode,
} from "@scraptrace/contracts";

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
