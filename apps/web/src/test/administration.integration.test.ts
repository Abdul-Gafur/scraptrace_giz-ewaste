import { EwasteCategorySchema, SupportedLanguageSchema } from "@scraptrace/contracts";

import { DEMO_ACTORS } from "@/auth/actors";
import { newEvidenceId } from "@/services/domain/identifiers";
import { buildSafetyCoverage, isServableSafetyCard } from "@/services/domain/safety-content";
import { toCalendarDate, addDays, todayCalendarDate } from "@/services/domain/time";
import { ScrapTraceServiceError } from "@/services/http/http-client";
import { createTestServices } from "@/services/local/local-services";
import { seedRepository, ensureSeeded } from "@/services/local/seed";
import type { FrontendServices } from "@/services/ports/service-ports";
import type { ScrapTraceRepository } from "@/services/local/repository";

const image = (label: string): Blob =>
  new Blob([`administration-evidence:${label}`], { type: "image/jpeg" });

interface Harness {
  readonly repository: ScrapTraceRepository;
  readonly collector: FrontendServices;
  readonly safety: FrontendServices;
  readonly model: FrontendServices;
}

const harness = (): Harness => {
  const { repository } = createTestServices({ role: "collector", seed: false });
  seedRepository(repository);
  const bind = (role: keyof typeof DEMO_ACTORS) =>
    createTestServices({ role: DEMO_ACTORS[role].role, repository, seed: false }).services;
  return {
    repository,
    collector: bind("collector"),
    safety: bind("safety_content_administrator"),
    model: bind("data_ml_reviewer"),
  };
};

const answers = (suffix: string) => ({
  what_is_it: `What it is (${suffix})`,
  possible_dangers: `Possible dangers (${suffix})`,
  prohibited_actions: `Prohibited actions (${suffix})`,
  safe_actions_now: `Safe actions now (${suffix})`,
  suitable_destination: `Suitable destination (${suffix})`,
});

const sources = [{ label: "Reviewed guidance", reference: "Programme safety source" }];

describe("safety-card publication boundary", () => {
  it("keeps a draft out of the collector-facing guidance until it is approved and published", async () => {
    const services = harness();

    // Nothing is published for this language and category yet, so the collector gets the fallback.
    const before = await services.collector.safetyGuidance.getGuidance({
      category: "compressors",
      requested_language: "ar",
      transformation_mode: "none",
      offline: false,
    });
    expect(before.outcome).toBe("safe_fallback");
    if (before.outcome === "safe_fallback") {
      expect(before.reason).toBe("no_approved_card");
      expect(before.llm_called).toBe(false);
      expect(before.referral).toBe(
        "Contact a programme-verified receiving location or trained technician.",
      );
    }

    const draft = await services.safety.safetyContent.createDraft({
      category: "compressors",
      language: "ar",
      answers: answers("ar"),
      sources,
      translatedFrom: "en",
      aiAssisted: false,
    });
    expect(draft.status).toBe("draft");
    expect(isServableSafetyCard(draft)).toBe(false);

    // A draft must not be served.
    const withDraft = await services.collector.safetyGuidance.getGuidance({
      category: "compressors",
      requested_language: "ar",
      transformation_mode: "none",
      offline: false,
    });
    expect(withDraft.outcome).toBe("safe_fallback");

    // A draft cannot be published directly: it has to be approved first.
    await expect(
      services.safety.safetyContent.changeStatus(draft.card_id, "published"),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);

    const approved = await services.safety.safetyContent.approve({
      cardId: draft.card_id,
      approvedBy: "Programme safety review panel",
      approvalDate: todayCalendarDate(),
      reviewDate: toCalendarDate(addDays(Date.now(), 365)),
    });
    expect(approved.status).toBe("approved");
    expect(isServableSafetyCard(approved)).toBe(false);

    // Approved but not yet current: still not served.
    const withApproved = await services.collector.safetyGuidance.getGuidance({
      category: "compressors",
      requested_language: "ar",
      transformation_mode: "none",
      offline: false,
    });
    expect(withApproved.outcome).toBe("safe_fallback");

    const published = await services.safety.safetyContent.changeStatus(draft.card_id, "published");
    expect(published.status).toBe("published");

    const after = await services.collector.safetyGuidance.getGuidance({
      category: "compressors",
      requested_language: "ar",
      transformation_mode: "none",
      offline: false,
    });
    expect(after.outcome).toBe("approved_guidance");
    if (after.outcome !== "approved_guidance") throw new Error("expected approved guidance");
    expect(after.language.language).toBe("ar");
    expect(after.language.direction).toBe("rtl");
    expect(after.safety_card_version).toBe(published.version);
    expect(after.approval_date).toBe(published.approval_date);
    expect(after.review_date).toBe(published.review_date);
    expect(after.source_references).toEqual(["Programme safety source"]);
    expect(after.answers).toEqual(answers("ar"));
    expect(after.ai_assisted).toBe(false);
  });

  it("archives the version a publication replaces rather than overwriting its history", async () => {
    const services = harness();
    const existing = (await services.safety.safetyContent.list()).find(
      (card) =>
        card.category === "televisions" && card.language === "en" && card.status === "published",
    );
    expect(existing).toBeDefined();

    const replacement = await services.safety.safetyContent.createDraft({
      category: "televisions",
      language: "en",
      answers: answers("v2"),
      sources,
      aiAssisted: false,
    });
    expect(replacement.version).not.toBe(existing?.version);

    await services.safety.safetyContent.approve({
      cardId: replacement.card_id,
      approvedBy: "Panel",
      approvalDate: todayCalendarDate(),
      reviewDate: toCalendarDate(addDays(Date.now(), 200)),
    });
    await services.safety.safetyContent.changeStatus(replacement.card_id, "published");

    const cards = await services.safety.safetyContent.list();
    const previous = cards.find((card) => card.card_id === existing?.card_id);
    expect(previous?.status).toBe("archived");
    expect(previous?.answers).toEqual(existing?.answers);

    const served = await services.collector.safetyGuidance.getGuidance({
      category: "televisions",
      requested_language: "en",
      transformation_mode: "none",
      offline: false,
    });
    if (served.outcome !== "approved_guidance") throw new Error("expected approved guidance");
    expect(served.answers).toEqual(answers("v2"));
  });

  it("stops serving a published card once its review date has passed", async () => {
    const services = harness();
    const card = (await services.safety.safetyContent.list()).find(
      (candidate) =>
        candidate.category === "microwaves" &&
        candidate.language === "en" &&
        candidate.status === "published",
    );
    expect(card).toBeDefined();

    services.repository.putSafetyCard({
      ...(card as NonNullable<typeof card>),
      review_date: toCalendarDate(addDays(Date.now(), -1)),
    });

    const served = await services.collector.safetyGuidance.getGuidance({
      category: "microwaves",
      requested_language: "en",
      transformation_mode: "none",
      offline: false,
    });
    expect(served.outcome).toBe("safe_fallback");
  });

  it("refuses to edit a card that is no longer a draft", async () => {
    const services = harness();
    const published = (await services.safety.safetyContent.list()).find(
      (card) => card.status === "published",
    );
    await expect(
      services.safety.safetyContent.updateDraft(published?.card_id ?? "", {
        answers: answers("tampered"),
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });

  it("refuses an approval whose review date is not after the approval date", async () => {
    const services = harness();
    const draft = await services.safety.safetyContent.createDraft({
      category: "mixed_scrap",
      language: "pt",
      answers: answers("pt"),
      sources,
      aiAssisted: false,
    });
    await expect(
      services.safety.safetyContent.approve({
        cardId: draft.card_id,
        approvedBy: "Panel",
        approvalDate: "2026-06-01",
        reviewDate: "2026-06-01",
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });

  it("never substitutes English for a language with no published card", async () => {
    const services = harness();
    const english = await services.collector.safetyGuidance.getGuidance({
      category: "microwaves",
      requested_language: "en",
      transformation_mode: "none",
      offline: false,
    });
    expect(english.outcome).toBe("approved_guidance");

    const arabic = await services.collector.safetyGuidance.getGuidance({
      category: "microwaves",
      requested_language: "ar",
      transformation_mode: "none",
      offline: false,
    });
    expect(arabic.outcome).toBe("safe_fallback");
    if (arabic.outcome !== "safe_fallback") throw new Error("expected the fallback");
    if (english.outcome !== "approved_guidance") throw new Error("expected guidance");
    expect(JSON.stringify(arabic)).not.toContain(english.answers.what_is_it);
  });

  it("reports coverage for every category and language, marking gaps as missing", async () => {
    const services = harness();
    const coverage = buildSafetyCoverage(
      await services.safety.safetyContent.list(),
      SupportedLanguageSchema.options,
    );
    expect(coverage).toHaveLength(
      EwasteCategorySchema.options.length * SupportedLanguageSchema.options.length,
    );
    expect(coverage.filter((cell) => cell.status === "missing").length).toBeGreaterThan(0);
    expect(coverage.filter((cell) => cell.status === "published").length).toBeGreaterThan(0);
    // The seeded French microwave card stays a draft and the French compressor card stays approved,
    // so both authoring states are visible and neither is served.
    expect(
      coverage.find((cell) => cell.category === "microwaves" && cell.language === "fr")?.status,
    ).toBe("draft");
    expect(
      coverage.find((cell) => cell.category === "compressors" && cell.language === "fr")?.status,
    ).toBe("approved");
  });

  it("reports guidance as not AI assisted, because no wording is generated locally", async () => {
    const services = harness();
    const served = await services.collector.safetyGuidance.getGuidance({
      category: "refrigerators",
      requested_language: "en",
      transformation_mode: "simplify",
      offline: false,
    });
    if (served.outcome !== "approved_guidance") throw new Error("expected guidance");
    expect(served.ai_assisted).toBe(false);
    // The requested transformation was not performed, so the response says so rather than implying it.
    expect(served.transformation_mode).toBe("none");
    expect(served.grounding_references[0]).toContain(served.safety_card_id);
  });
});

describe("model feedback recording", () => {
  it("stores a collector's confirmation as labelled feedback without changing the model", async () => {
    const services = harness();
    await ensureSeeded(services.repository);

    const before = await services.model.modelAdministration.listFeedback();
    const configurationBefore = await services.model.modelAdministration.getConfiguration();

    const photo = image("feedback");
    const appraisal = await services.collector.vision.appraise({
      evidence_id: newEvidenceId(),
      image: photo,
      price_estimation_inputs: { condition: "damaged" },
    });
    if (appraisal.outcome !== "classified") throw new Error("expected a classified appraisal");

    const corrected = EwasteCategorySchema.options.find((value) => value !== appraisal.category);
    const draft = await services.collector.recoveryRecords.createDraft({
      category: corrected as (typeof EwasteCategorySchema.options)[number],
      language: "en",
      condition: "damaged",
      ...(corrected === "mixed_scrap"
        ? { approximateWeight: { value: 12, unit: "kg" as const } }
        : { itemCount: 1 }),
      areaLabel: "Greater Accra",
      confirmationSource: "human_correction",
      correctionReason: "The photographed item is not what the model suggested.",
      image: photo,
      offline: false,
      visionResult: {
        prediction_id: newEvidenceId(),
        model_name: appraisal.model_name,
        model_version: appraisal.model_version,
        inferred_at: appraisal.inferred_at,
        scores: appraisal.scores,
        suggested_category: appraisal.category,
        confidence: appraisal.confidence,
        low_confidence: false,
      },
    });
    await services.collector.recoveryRecords.submit(draft.record_id);

    const after = await services.model.modelAdministration.listFeedback();
    expect(after.length).toBe(before.length + 1);
    const stored = after.find((item) => item.recovery_record_id === draft.record_id);
    expect(stored).toBeDefined();
    expect(stored?.predicted_category).toBe(appraisal.category);
    expect(stored?.confirmed_category).toBe(corrected);
    expect(stored?.confirmation_source).toBe("human_correction");
    expect(stored?.correction_reason).toContain("not what the model suggested");
    expect(stored?.feedback_state).toBe("stored_for_review");
    expect(stored?.model_version).toBe(appraisal.model_version);

    // Storing feedback changed no configuration and no registry entry.
    expect(await services.model.modelAdministration.getConfiguration()).toEqual(
      configurationBefore,
    );
  });

  it("keeps the original prediction alongside the correction on the evidence provenance", async () => {
    const services = harness();
    await ensureSeeded(services.repository);
    const feedback = await services.model.modelAdministration.listFeedback();
    const correction = feedback.find((item) => item.predicted_category !== item.confirmed_category);
    expect(correction).toBeDefined();
    const evidence = services.repository.findEvidence(correction?.evidence_id ?? "");
    expect(evidence?.provenance.ai_observation?.original_prediction).toBe(
      correction?.predicted_category,
    );
    expect(evidence?.provenance.human_correction?.corrected_value).toBe(
      correction?.confirmed_category,
    );
  });

  it("approving feedback marks it for a future dataset and starts no training", async () => {
    const services = harness();
    await ensureSeeded(services.repository);
    const stored = (await services.model.modelAdministration.listFeedback()).find(
      (item) => item.feedback_state === "stored_for_review",
    );
    expect(stored).toBeDefined();

    const registryBefore = await services.model.modelAdministration.listRegistry();
    const decided = await services.model.modelAdministration.decideFeedback(
      stored?.feedback_id ?? "",
      "approved_for_training_dataset",
    );
    expect(decided.feedback_state).toBe("approved_for_training_dataset");
    expect(decided.reviewed_by).toBe(DEMO_ACTORS.data_ml_reviewer.actorId);
    expect(decided.reviewed_at).toBeDefined();

    // The registry, including the active version, is untouched.
    expect(await services.model.modelAdministration.listRegistry()).toEqual(registryBefore);
  });

  it("rejecting feedback records that decision without deleting the item", async () => {
    const services = harness();
    await ensureSeeded(services.repository);
    const stored = (await services.model.modelAdministration.listFeedback()).find(
      (item) => item.feedback_state === "stored_for_review",
    );
    const decided = await services.model.modelAdministration.decideFeedback(
      stored?.feedback_id ?? "",
      "rejected_for_training",
    );
    expect(decided.feedback_state).toBe("rejected_for_training");
    expect(
      (await services.model.modelAdministration.listFeedback()).some(
        (item) => item.feedback_id === stored?.feedback_id,
      ),
    ).toBe(true);
  });

  it("reports the registered artefact's own metadata, with no invented figures", async () => {
    const services = harness();
    const registry = await services.model.modelAdministration.listRegistry();
    expect(registry).toHaveLength(1);
    const entry = registry[0];
    expect(entry?.task).toBe("single_label_image_classification");
    expect(entry?.supported_categories).toEqual(EwasteCategorySchema.options);
    // The training run recorded no checksum, so none is shown.
    expect(entry?.checkpoint_sha256).toBeNull();
    expect(entry?.known_limitations.length).toBeGreaterThan(0);
    expect(entry?.metadata_conflicts.length).toBeGreaterThan(0);
    expect(Object.keys(entry?.per_category_metrics ?? {}).sort()).toEqual(
      [...EwasteCategorySchema.options].sort(),
    );
  });

  it("validates the configuration it is asked to save", async () => {
    const services = harness();
    const current = await services.model.modelAdministration.getConfiguration();

    const saved = await services.model.modelAdministration.saveConfiguration({
      ...current,
      confidence_threshold: 0.6,
      manual_review_categories: ["mixed_scrap"],
    });
    expect(saved.confidence_threshold).toBe(0.6);
    expect(saved.updated_by).toBe(DEMO_ACTORS.data_ml_reviewer.actorId);

    await expect(
      services.model.modelAdministration.saveConfiguration({
        ...current,
        confidence_threshold: 0.99,
      }),
    ).rejects.toBeTruthy();

    await expect(
      services.model.modelAdministration.saveConfiguration({
        ...current,
        active_model_version: "9.9.9",
      }),
    ).rejects.toBeInstanceOf(ScrapTraceServiceError);
  });

  it("applies the saved confidence threshold to the next appraisal", async () => {
    const services = harness();
    const current = await services.model.modelAdministration.getConfiguration();
    await services.model.modelAdministration.saveConfiguration({
      ...current,
      confidence_threshold: 0.95,
      manual_review_categories: [],
    });

    const appraisal = await services.collector.vision.appraise({
      evidence_id: newEvidenceId(),
      image: image("threshold"),
    });
    // With the threshold at its maximum, a suggestion is withheld and the collector chooses.
    expect(appraisal.outcome).toBe("unable_to_classify");
    if (appraisal.outcome === "unable_to_classify") expect(appraisal.reason).toBe("low_confidence");
  });

  it("always asks for manual confirmation for a configured category", async () => {
    const services = harness();
    const current = await services.model.modelAdministration.getConfiguration();
    await services.model.modelAdministration.saveConfiguration({
      ...current,
      confidence_threshold: 0.05,
      manual_review_categories: EwasteCategorySchema.options,
    });
    const appraisal = await services.collector.vision.appraise({
      evidence_id: newEvidenceId(),
      image: image("manual"),
    });
    expect(appraisal.outcome).toBe("unable_to_classify");
  });
});
