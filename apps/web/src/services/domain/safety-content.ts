import {
  ActorIdSchema,
  EwasteCategorySchema,
  SafetyQuestionAnswersSchema,
  SemanticVersionSchema,
  SupportedLanguageSchema,
  UtcTimestampSchema,
  UuidV7Schema,
  type EwasteCategory,
  type SupportedLanguage,
} from "@scraptrace/contracts";
import { z } from "zod";

import { isBeforeToday } from "./time";

/**
 * Safety-card administration.
 *
 * `packages/contracts` defines what an *approved answer set* looks like
 * (`SafetyQuestionAnswersSchema`) and what a served guidance response looks like
 * (`SafetyGuidanceResponseSchema`), but it does not define the authoring record. This schema is
 * therefore an application-level record composed only from contract primitives; it introduces
 * no new recovery-record state, role or permission.
 *
 * Authoring states are distinct on purpose (FR-SAF-002):
 * - `draft` is being written and may never be served;
 * - `approved` has a named approver and dates but is not yet current;
 * - `published` is the current card for its category and language, and is the only state that
 *   may be displayed to a collector or used to ground an explanation;
 * - `archived` is a superseded or retired version, kept so history is not overwritten.
 *
 * A published card whose `review_date` has passed is treated as expired and is not served.
 */
export const SafetyCardStatusSchema = z.enum(["draft", "approved", "published", "archived"]);
export type SafetyCardStatus = z.infer<typeof SafetyCardStatusSchema>;

export const SafetyCardSourceSchema = z.strictObject({
  label: z.string().min(1).max(240),
  reference: z.string().min(1).max(500),
});

export const SafetyCardSchema = z
  .strictObject({
    card_id: UuidV7Schema,
    version: SemanticVersionSchema,
    category: EwasteCategorySchema,
    language: SupportedLanguageSchema,
    status: SafetyCardStatusSchema,
    answers: SafetyQuestionAnswersSchema,
    sources: z.array(SafetyCardSourceSchema).min(1).max(20),
    /** Present once the card reaches `approved`. */
    approved_by: z.string().min(2).max(160).optional(),
    approval_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    review_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /** Set when this card is a translation of an approved card in another language. */
    translated_from: SupportedLanguageSchema.optional(),
    /** True when wording was drafted with assistance; approval is still human (FR-SAF-010). */
    ai_assisted: z.boolean(),
    programme_id: UuidV7Schema.optional(),
    created_at: UtcTimestampSchema,
    updated_at: UtcTimestampSchema,
    updated_by: ActorIdSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.status !== "draft") {
      if (!value.approved_by || !value.approval_date || !value.review_date) {
        context.addIssue({
          code: "custom",
          path: ["approved_by"],
          message: "An approved card requires an approver, an approval date and a review date.",
        });
      }
    }
    if (value.approval_date && value.review_date && value.review_date <= value.approval_date) {
      context.addIssue({
        code: "custom",
        path: ["review_date"],
        message: "The review date must be after the approval date.",
      });
    }
  });

export type SafetyCard = z.infer<typeof SafetyCardSchema>;

/** The five questions every card must answer, in the order the collector reads them. */
export const SAFETY_QUESTION_KEYS = [
  "what_is_it",
  "possible_dangers",
  "prohibited_actions",
  "safe_actions_now",
  "suitable_destination",
] as const;

export type SafetyQuestionKey = (typeof SAFETY_QUESTION_KEYS)[number];

export const isExpiredSafetyCard = (card: SafetyCard): boolean =>
  card.status === "published" && card.review_date !== undefined && isBeforeToday(card.review_date);

/** Only a published, unexpired card may be served or used for grounding (FR-SAF-002, BR-003). */
export const isServableSafetyCard = (card: SafetyCard): boolean =>
  card.status === "published" && !isExpiredSafetyCard(card);

/** Allowed authoring transitions. Anything else is rejected by the service. */
export const SAFETY_CARD_TRANSITIONS = {
  draft: ["approved"],
  approved: ["published", "draft"],
  published: ["archived"],
  archived: [],
} as const satisfies Record<SafetyCardStatus, readonly SafetyCardStatus[]>;

export const canTransitionSafetyCard = (from: SafetyCardStatus, to: SafetyCardStatus): boolean =>
  (SAFETY_CARD_TRANSITIONS[from] as readonly SafetyCardStatus[]).includes(to);

/** Increments the minor version, used when a published card is superseded by a new draft. */
export const nextCardVersion = (version: string): string => {
  const [major = "1", minor = "0"] = version.split(".");
  return `${major}.${Number(minor) + 1}.0`;
};

export interface SafetyCoverageCell {
  readonly category: EwasteCategory;
  readonly language: SupportedLanguage;
  readonly status: SafetyCardStatus | "missing";
  readonly expired: boolean;
}

/**
 * Coverage of every category and language, so a missing translation is visible rather than
 * silently replaced by English (FR-SAF-009).
 */
export const buildSafetyCoverage = (
  cards: readonly SafetyCard[],
  languages: readonly SupportedLanguage[],
): readonly SafetyCoverageCell[] =>
  EwasteCategorySchema.options.flatMap((category) =>
    languages.map((language) => {
      const candidates = cards.filter(
        (card) => card.category === category && card.language === language,
      );
      const current =
        candidates.find((card) => card.status === "published") ??
        candidates.find((card) => card.status === "approved") ??
        candidates.find((card) => card.status === "draft");
      return {
        category,
        language,
        status: current?.status ?? ("missing" as const),
        expired: current ? isExpiredSafetyCard(current) : false,
      };
    }),
  );
