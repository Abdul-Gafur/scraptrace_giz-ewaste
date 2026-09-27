import {
  LANGUAGE_DIRECTION,
  SafetyGuidanceRequestSchema,
  SafetyGuidanceResponseSchema,
  type EwasteCategory,
  type SupportedLanguage,
} from "@scraptrace/contracts";

import { isServableSafetyCard, type SafetyCard } from "@/services/domain/safety-content";
import { nowUtc } from "@/services/domain/time";
import type { SafetyGuidanceService } from "@/services/ports/service-ports";

import { pause, type LocalServiceContext } from "./context";
import type { ScrapTraceRepository } from "./repository";

/**
 * Approved-guidance boundary (FR-SAF-002, FR-SAF-006, FR-SAF-007, BR-003, BR-004).
 *
 * Only a published, unexpired card for the requested category and language may be served. There
 * is no silent English substitution: when the requested language has no servable card the
 * response is the approved fallback, which names no hazard of its own and refers the reader to an
 * approved receiving location or a trained technician. No text is generated here, so a missing
 * card can never become invented safety advice.
 */

export const findServableCard = (
  repository: ScrapTraceRepository,
  category: EwasteCategory,
  language: SupportedLanguage,
): SafetyCard | null =>
  repository
    .listSafetyCards()
    .filter(
      (card) =>
        card.category === category && card.language === language && isServableSafetyCard(card),
    )
    .sort((first, second) => second.version.localeCompare(first.version))[0] ?? null;

const languageMetadata = (language: SupportedLanguage, reviewed: boolean) => ({
  language,
  direction: LANGUAGE_DIRECTION[language],
  reviewed,
});

export const createSafetyGuidanceService = (
  context: LocalServiceContext,
): SafetyGuidanceService => ({
  async getGuidance(request) {
    await pause(context.delayMilliseconds);
    const parsed = SafetyGuidanceRequestSchema.parse(request);
    const card = findServableCard(context.repository, parsed.category, parsed.requested_language);

    if (!card) {
      return SafetyGuidanceResponseSchema.parse({
        outcome: "safe_fallback",
        category: parsed.category,
        language: languageMetadata(parsed.requested_language, false),
        reason: "no_approved_card",
        message:
          "No approved safety guide is available for this item in the selected language. Do not open, break or burn the item.",
        referral: "Contact a programme-verified receiving location or trained technician.",
        llm_called: false,
      });
    }

    return SafetyGuidanceResponseSchema.parse({
      outcome: "approved_guidance",
      category: card.category,
      language: languageMetadata(card.language, true),
      safety_card_id: card.card_id,
      safety_card_version: card.version,
      source_references: card.sources.map((source) => source.reference),
      approval_date: card.approval_date,
      review_date: card.review_date,
      answers: card.answers,
      // No transformation is applied locally: the approved wording is returned unchanged, so the
      // requested mode is reported as `none` rather than implying an explanation was generated.
      transformation_mode: "none",
      grounding_references: [`card:${card.card_id}:${card.version}`],
      generated_at: nowUtc(),
      offline_available: true,
      ai_assisted: false,
    });
  },
});
