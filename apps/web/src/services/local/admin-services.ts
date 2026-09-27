import { PermissionSchema } from "@scraptrace/contracts";

import { newUuid } from "@/services/domain/identifiers";
import {
  ModelConfigurationSchema,
  PredictionFeedbackSchema,
  type ModelConfiguration,
} from "@/services/domain/model-administration";
import {
  ProgrammeSettingsSchema,
  validateProgrammeSettings,
} from "@/services/domain/programme-settings";
import {
  SafetyCardSchema,
  canTransitionSafetyCard,
  nextCardVersion,
  type SafetyCard,
} from "@/services/domain/safety-content";
import { nowUtc } from "@/services/domain/time";
import type {
  ModelAdministrationService,
  ProgrammeSettingsService,
  SafetyCardApprovalInput,
  SafetyCardDraftInput,
  SafetyContentService,
} from "@/services/ports/service-ports";

import { pause, requirePermission, type LocalServiceContext } from "./context";
import { notFound, validationFailed } from "./errors";
import { MODEL_REGISTRY, findModelVersion } from "./model-registry-data";

const permission = PermissionSchema.enum;

/**
 * Safety-content administration (FR-SAF-001, FR-SAF-002, FR-SAF-008).
 *
 * Publishing a card archives the version it replaces rather than overwriting it, so approved
 * history survives. A draft can never be published directly: it must be approved with a named
 * approver, an approval date and a review date first.
 */
export const createSafetyContentService = (context: LocalServiceContext): SafetyContentService => {
  const { repository, actor } = context;

  const requireDraft = (cardId: string): SafetyCard => {
    const card = repository.findSafetyCard(cardId);
    if (!card) throw notFound();
    return card;
  };

  return {
    async list() {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["safety_content:manage"]);
      return [...repository.listSafetyCards()].sort(
        (first, second) =>
          first.category.localeCompare(second.category) ||
          first.language.localeCompare(second.language) ||
          second.version.localeCompare(first.version),
      );
    },

    async getById(cardId) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["safety_content:manage"]);
      return repository.findSafetyCard(cardId);
    },

    async createDraft(input: SafetyCardDraftInput) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["safety_content:manage"]);
      const existing = repository
        .listSafetyCards()
        .filter((card) => card.category === input.category && card.language === input.language);
      const highestVersion = existing
        .map((card) => card.version)
        .sort((first, second) => second.localeCompare(first))[0];
      const timestamp = nowUtc();
      return repository.putSafetyCard(
        SafetyCardSchema.parse({
          card_id: newUuid(),
          version: highestVersion ? nextCardVersion(highestVersion) : "1.0.0",
          category: input.category,
          language: input.language,
          status: "draft",
          answers: input.answers,
          sources: input.sources,
          ...(input.translatedFrom ? { translated_from: input.translatedFrom } : {}),
          ai_assisted: input.aiAssisted,
          ...(actor.programmeId ? { programme_id: actor.programmeId } : {}),
          created_at: timestamp,
          updated_at: timestamp,
          updated_by: actor.actorId,
        }),
      );
    },

    async updateDraft(cardId, input) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["safety_content:manage"]);
      const card = requireDraft(cardId);
      if (card.status !== "draft") {
        throw validationFailed(
          "Only a draft can be edited. Create a new draft version instead.",
          [{ field: "status", reason: "not_editable" }],
          "errors.cardNotEditable",
        );
      }
      return repository.putSafetyCard(
        SafetyCardSchema.parse({
          ...card,
          ...(input.answers ? { answers: input.answers } : {}),
          ...(input.sources ? { sources: input.sources } : {}),
          ...(input.translatedFrom ? { translated_from: input.translatedFrom } : {}),
          ...(input.aiAssisted === undefined ? {} : { ai_assisted: input.aiAssisted }),
          updated_at: nowUtc(),
          updated_by: actor.actorId,
        }),
      );
    },

    async approve(input: SafetyCardApprovalInput) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["safety_content:manage"]);
      const card = requireDraft(input.cardId);
      if (!canTransitionSafetyCard(card.status, "approved")) {
        throw validationFailed(
          "Only a draft can be approved.",
          [{ field: "status", reason: "invalid_transition" }],
          "errors.cardTransition",
        );
      }
      if (input.reviewDate <= input.approvalDate) {
        throw validationFailed(
          "The review date must be after the approval date.",
          [{ field: "reviewDate", reason: "must_be_after_approval" }],
          "errors.validationFailed",
        );
      }
      return repository.putSafetyCard(
        SafetyCardSchema.parse({
          ...card,
          status: "approved",
          approved_by: input.approvedBy,
          approval_date: input.approvalDate,
          review_date: input.reviewDate,
          updated_at: nowUtc(),
          updated_by: actor.actorId,
        }),
      );
    },

    async changeStatus(cardId, status) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["safety_content:manage"]);
      const card = requireDraft(cardId);
      if (!canTransitionSafetyCard(card.status, status)) {
        throw validationFailed(
          "That status change is not allowed for this card.",
          [{ field: "status", reason: "invalid_transition" }],
          "errors.cardTransition",
        );
      }
      if (status === "published") {
        // The published version this card replaces is archived, never overwritten.
        for (const other of repository.listSafetyCards()) {
          if (
            other.card_id !== card.card_id &&
            other.category === card.category &&
            other.language === card.language &&
            other.status === "published"
          ) {
            repository.putSafetyCard(
              SafetyCardSchema.parse({ ...other, status: "archived", updated_at: nowUtc() }),
            );
          }
        }
      }
      return repository.putSafetyCard(
        SafetyCardSchema.parse({
          ...card,
          status,
          updated_at: nowUtc(),
          updated_by: actor.actorId,
        }),
      );
    },
  };
};

/**
 * Model administration (FR-VIS-008, FR-VIS-009, BR-012).
 *
 * The registry is read-only factual metadata about the trained artefact. Configuration changes
 * the confidence threshold and the manual-review routing the application uses; it never retrains
 * or redeploys anything, and approving feedback only marks it usable in a future dataset release.
 */
export const createModelAdministrationService = (
  context: LocalServiceContext,
): ModelAdministrationService => {
  const { repository, actor } = context;

  return {
    async listRegistry() {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["model_performance:view"]);
      return MODEL_REGISTRY;
    },

    async getConfiguration() {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["model_performance:view"]);
      const stored = repository.getModelConfiguration();
      if (stored) return stored;
      throw notFound();
    },

    async saveConfiguration(configuration) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["model_correction:review"]);
      if (!findModelVersion(configuration.active_model_version)) {
        throw validationFailed(
          "That model version is not in the registry.",
          [{ field: "active_model_version", reason: "not_registered" }],
          "errors.modelVersionUnknown",
        );
      }
      const candidate: ModelConfiguration = ModelConfigurationSchema.parse({
        ...configuration,
        updated_at: nowUtc(),
        updated_by: actor.actorId,
      });
      return repository.putModelConfiguration(candidate);
    },

    async listFeedback() {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["model_correction:review"]);
      return [...repository.listPredictionFeedback()].sort((first, second) =>
        second.created_at.localeCompare(first.created_at),
      );
    },

    async decideFeedback(feedbackId, state) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["model_correction:review"]);
      const feedback = repository
        .listPredictionFeedback()
        .find((item) => item.feedback_id === feedbackId);
      if (!feedback) throw notFound();
      return repository.putPredictionFeedback(
        PredictionFeedbackSchema.parse({
          ...feedback,
          feedback_state: state,
          reviewed_by: actor.actorId,
          reviewed_at: nowUtc(),
        }),
      );
    },
  };
};

/** Programme settings. Only a programme manager may change them. */
export const createProgrammeSettingsService = (
  context: LocalServiceContext,
): ProgrammeSettingsService => {
  const { repository, actor } = context;
  return {
    async get() {
      await pause(context.delayMilliseconds);
      const settings = repository.getProgrammeSettings();
      if (!settings) throw notFound();
      return settings;
    },

    async save(settings) {
      await pause(context.delayMilliseconds);
      requirePermission(context, permission["programme_report:view"]);
      const candidate = {
        ...settings,
        updated_at: nowUtc(),
        updated_by: actor.actorId,
      };
      const validated = validateProgrammeSettings(candidate);
      if (!validated.success) {
        throw validationFailed(
          "The programme settings are not valid.",
          validated.error.issues.map((issue) => ({
            field: issue.path.join(".") || "settings",
            reason: issue.message.slice(0, 120),
          })),
        );
      }
      return repository.putProgrammeSettings(ProgrammeSettingsSchema.parse(candidate));
    },
  };
};
