import {
  PriceEstimateSchema,
  type EwasteCategory,
  type ItemConditionSchema,
} from "@scraptrace/contracts";
import type { z } from "zod";

/**
 * Dated indicative price reference data (FR-PRI-001, FR-PRI-004).
 *
 * The figures are a fictional demonstration reference table, not market rates, and every
 * estimate produced from them carries its basis, source, effective date and a non-offer
 * disclaimer. When a category has no current entry the service returns no estimate rather than
 * inventing a value (FR-PRI-005).
 */

type ItemCondition = z.infer<typeof ItemConditionSchema>;

export const PRICE_REFERENCE_EFFECTIVE_DATE = "2026-09-01";
export const PRICE_REFERENCE_SOURCE =
  "ScrapTrace demonstration reference table (fictional; not a market quotation)";

/** Minimum and maximum indicative amount per item, in the programme currency. */
const PER_ITEM_RANGE: Partial<Record<EwasteCategory, readonly [number, number]>> = {
  refrigerators: [90, 180],
  laptops_and_desktop_computers: [40, 140],
  televisions: [20, 70],
  microwaves: [15, 45],
  air_conditioners: [110, 220],
  compressors: [60, 130],
};

/** Minimum and maximum indicative amount per kilogram, used for declared-weight batches. */
const PER_KILOGRAM_RANGE: Partial<Record<EwasteCategory, readonly [number, number]>> = {
  mixed_scrap: [1.2, 3.4],
};

const CONDITION_MULTIPLIER: Record<ItemCondition, number> = {
  working: 1,
  repairable: 0.8,
  damaged: 0.55,
  unknown: 0.5,
};

const round = (value: number): number => Math.round(value * 100) / 100;

export interface EstimateInput {
  readonly category: EwasteCategory;
  readonly condition: ItemCondition;
  readonly itemCount?: number;
  readonly approximateWeightKg?: number;
  readonly currency: string;
}

/**
 * Returns a contract-valid estimate, or `null` when the inputs cannot support one — including
 * mixed scrap without an approximate weight, which the contract itself refuses (BR-005).
 */
export const buildPriceEstimate = (
  input: EstimateInput,
): z.infer<typeof PriceEstimateSchema> | null => {
  const multiplier = CONDITION_MULTIPLIER[input.condition];
  const perKilogram = PER_KILOGRAM_RANGE[input.category];
  const perItem = PER_ITEM_RANGE[input.category];

  let minimum: number;
  let maximum: number;
  let basis: string;

  if (perKilogram) {
    if (input.approximateWeightKg === undefined || input.approximateWeightKg <= 0) return null;
    minimum = perKilogram[0] * input.approximateWeightKg * multiplier;
    maximum = perKilogram[1] * input.approximateWeightKg * multiplier;
    basis = `Declared weight of ${input.approximateWeightKg} kg at the reference rate per kilogram for ${input.condition} condition`;
  } else if (perItem) {
    const count = input.itemCount ?? 1;
    minimum = perItem[0] * count * multiplier;
    maximum = perItem[1] * count * multiplier;
    basis = `${count} item(s) at the reference rate per item for ${input.condition} condition`;
  } else {
    return null;
  }

  const parsed = PriceEstimateSchema.safeParse({
    category: input.category,
    condition: input.condition,
    ...(input.itemCount !== undefined && !perKilogram ? { count: input.itemCount } : {}),
    ...(input.approximateWeightKg !== undefined
      ? { approximate_weight: { value: input.approximateWeightKg, unit: "kg" } }
      : {}),
    minimum_amount: round(minimum),
    maximum_amount: round(maximum),
    currency: input.currency,
    basis,
    source: PRICE_REFERENCE_SOURCE,
    effective_date: PRICE_REFERENCE_EFFECTIVE_DATE,
    disclaimer:
      "Indicative range only. It is not an offer, not guaranteed income, and a photograph cannot measure weight or value.",
  });
  return parsed.success ? parsed.data : null;
};
