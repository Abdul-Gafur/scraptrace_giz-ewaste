import {
  EWASTE_CATEGORIES,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
  type EwasteCategory,
} from "@scraptrace/contracts";
import type { z } from "zod";

import { sha256Blob } from "@/services/domain/digest";
import { nowUtc } from "@/services/domain/time";
import type { VisionService } from "@/services/ports/service-ports";

import { pause, type LocalServiceContext } from "./context";
import { activeModel } from "./model-registry-data";
import { buildPriceEstimate } from "./price-reference";

/**
 * Local vision appraisal.
 *
 * The trained classifier runs in the Python vision service, not in the browser, so the local
 * implementation derives a deterministic distribution from the image digest. It is an
 * appraisal *shape* that matches the contract exactly — seven scores, one highest-scoring
 * category, a confidence equal to that category's score, and the real active model's name and
 * version — so every downstream rule (correction, low confidence, stored feedback) behaves as it
 * will against the real service. It is not a second model and it makes no claim about the image.
 */

const softmax = (values: readonly number[]): readonly number[] => {
  const highest = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - highest));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
};

/** Turns the 64 hexadecimal characters of the digest into seven stable logits. */
const logitsFromDigest = (digest: string): readonly number[] => {
  const hexadecimal = digest.replace("sha256:", "");
  return EWASTE_CATEGORIES.map((_, index) => {
    const slice = hexadecimal.slice(index * 8, index * 8 + 8);
    return (Number.parseInt(slice, 16) / 0xffffffff) * 6;
  });
};

const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export interface VisionPrediction {
  readonly scores: readonly { readonly category: EwasteCategory; readonly score: number }[];
  readonly category: EwasteCategory;
  readonly confidence: number;
}

/**
 * Builds a contract-consistent score set: values sum close to one, the suggested category holds
 * the highest score and the confidence equals that score, which the contract enforces.
 */
export const predictFromDigest = (digest: string): VisionPrediction => {
  const probabilities = softmax(logitsFromDigest(digest)).map((value) => roundTo(value, 4));
  const scores = EWASTE_CATEGORIES.map((category, index) => ({
    category,
    score: probabilities[index] ?? 0,
  }));
  const best = scores.reduce((highest, candidate) =>
    candidate.score > highest.score ? candidate : highest,
  );
  return { scores, category: best.category, confidence: best.score };
};

export const createVisionService = (context: LocalServiceContext): VisionService => ({
  async appraise(request) {
    await pause(context.delayMilliseconds);
    const { image, ...domainRequest } = request;
    VisionAppraisalRequestSchema.parse(domainRequest);
    const model = activeModel();
    const configuration = context.repository.getModelConfiguration();
    const threshold = configuration?.confidence_threshold ?? 0.4;
    const inferredAt = nowUtc();

    if (image.size === 0) {
      return VisionAppraisalResponseSchema.parse({
        outcome: "unable_to_classify",
        reason: "invalid_image",
        model_name: model.model_name,
        model_version: model.model_version,
        inferred_at: inferredAt,
      });
    }

    const prediction = predictFromDigest(await sha256Blob(image));
    const settings = context.repository.getProgrammeSettings();
    const requiresManualReview =
      configuration?.manual_review_categories.includes(prediction.category) ?? false;

    if (prediction.confidence < threshold || requiresManualReview) {
      // Below the configured threshold the collector chooses from all supported categories
      // instead of being shown a category the model is not confident about (FR-VIS-007).
      return VisionAppraisalResponseSchema.parse({
        outcome: "unable_to_classify",
        reason: "low_confidence",
        scores: prediction.scores,
        model_name: model.model_name,
        model_version: model.model_version,
        inferred_at: inferredAt,
      });
    }

    const estimate = buildPriceEstimate({
      category: prediction.category,
      condition: domainRequest.price_estimation_inputs?.condition ?? "unknown",
      ...(domainRequest.price_estimation_inputs?.item_count !== undefined
        ? { itemCount: domainRequest.price_estimation_inputs.item_count }
        : {}),
      ...(domainRequest.price_estimation_inputs?.approximate_weight_kg !== undefined
        ? { approximateWeightKg: domainRequest.price_estimation_inputs.approximate_weight_kg }
        : {}),
      currency: settings?.currency ?? "GHS",
    });

    return VisionAppraisalResponseSchema.parse({
      outcome: "classified",
      category: prediction.category,
      scores: prediction.scores,
      confidence: prediction.confidence,
      model_name: model.model_name,
      model_version: model.model_version,
      inferred_at: inferredAt,
      ...(estimate ? { estimate } : {}),
    });
  },
});

export type VisionAppraisalResponse = z.infer<typeof VisionAppraisalResponseSchema>;
