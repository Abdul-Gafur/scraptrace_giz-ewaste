import {
  ActorIdSchema,
  EvidenceSchema,
  EwasteCategorySchema,
  GeoCoordinatesSchema,
  ItemConditionSchema,
  PriceEstimateSchema,
  RecoveryRecordSchema,
  RecoveryRecordEventSchema,
  SupportedLanguageSchema,
  UserRoleSchema,
  VisionResultSchema,
  WeightSchema,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
  serviceSuccessSchema,
} from "@scraptrace/contracts";
import { z } from "zod";

import type { FrontendServices } from "@/services/ports/service-ports";
import type { CaptureInput, UpdateDraftInput } from "@/services/ports/service-ports";

import { HttpClient, ScrapTraceServiceError } from "./http-client";

const notImplemented = async (): Promise<never> => {
  throw new Error("This HTTP service is not implemented in the backend walking skeleton.");
};

const SessionTransportSchema = z.strictObject({
  actor_id: ActorIdSchema,
  role: UserRoleSchema,
  preferred_language: SupportedLanguageSchema,
  display_label: z.string().min(1).max(160),
});
const SessionResponseSchema = serviceSuccessSchema(SessionTransportSchema);
const SignedOutResponseSchema = serviceSuccessSchema(
  z.strictObject({ signed_out: z.literal(true) }),
);
const RecoveryRecordListSchema = z.array(RecoveryRecordSchema);
const SubmitResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("submitted"),
    record: RecoveryRecordSchema,
    replayed: z.boolean(),
  }),
  z.strictObject({
    outcome: z.literal("duplicate_image"),
    record: RecoveryRecordSchema,
    flag_codes: z.array(z.string().min(1).max(80)).min(1),
  }),
]);
const CaptureMetadataSchema = z.strictObject({
  category: EwasteCategorySchema,
  language: SupportedLanguageSchema,
  condition: ItemConditionSchema,
  item_count: z.number().int().positive().optional(),
  approximate_weight: WeightSchema.optional(),
  area_label: z.string().min(1).max(160),
  administrative_area: z.string().min(1).max(160).optional(),
  capture_location: GeoCoordinatesSchema.optional(),
  vision_result: VisionResultSchema.optional(),
  estimated_price: PriceEstimateSchema.optional(),
  confirmation_source: z.enum(["accepted_prediction", "manual_selection", "human_correction"]),
  correction_reason: z.string().min(1).max(500).optional(),
  offline: z.boolean(),
  destination_location_id: z.string().uuid().optional(),
  captured_at: z.iso.datetime().optional(),
  base_revision: z.number().int().nonnegative().optional(),
});

const captureMetadata = (input: CaptureInput | UpdateDraftInput) =>
  CaptureMetadataSchema.parse({
    category: input.category,
    language: input.language,
    condition: input.condition,
    ...(input.itemCount === undefined ? {} : { item_count: input.itemCount }),
    ...(input.approximateWeight ? { approximate_weight: input.approximateWeight } : {}),
    area_label: input.areaLabel,
    ...(input.administrativeArea ? { administrative_area: input.administrativeArea } : {}),
    ...(input.captureLocation ? { capture_location: input.captureLocation } : {}),
    ...(input.visionResult ? { vision_result: input.visionResult } : {}),
    ...(input.estimatedPrice ? { estimated_price: input.estimatedPrice } : {}),
    confirmation_source: input.confirmationSource,
    ...(input.correctionReason ? { correction_reason: input.correctionReason } : {}),
    offline: input.offline,
    ...(input.destinationLocationId
      ? { destination_location_id: input.destinationLocationId }
      : {}),
    ...(input.capturedAt ? { captured_at: input.capturedAt } : {}),
    ...("baseRevision" in input && input.baseRevision !== undefined
      ? { base_revision: input.baseRevision }
      : {}),
  });

const captureForm = (input: CaptureInput | UpdateDraftInput): FormData => {
  const form = new FormData();
  form.append("metadata", JSON.stringify(captureMetadata(input)));
  if (input.image) form.append("image", input.image, "evidence-upload");
  return form;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Evidence response could not be read."));
    reader.onerror = () => reject(new Error("Evidence response could not be read."));
    reader.readAsDataURL(blob);
  });

export const createHttpServices = (apiBaseUrl: string): FrontendServices => {
  const client = new HttpClient(apiBaseUrl);
  const createDraftKeys = new WeakMap<Blob, string>();
  const createDraftKey = (image: Blob) => {
    const existing = createDraftKeys.get(image);
    if (existing) return existing;
    const created = `create-draft:${crypto.randomUUID()}`;
    createDraftKeys.set(image, created);
    return created;
  };
  const toSession = (session: z.infer<typeof SessionTransportSchema>) => ({
    actorId: session.actor_id,
    role: session.role,
    preferredLanguage: session.preferred_language,
    displayLabel: session.display_label,
    developmentOnly: false,
  });
  return {
    authentication: {
      async getSession() {
        try {
          const response = await client.requestParsed("/v1/auth/session", SessionResponseSchema, {
            method: "GET",
            suppressSessionExpiry: true,
          });
          return toSession(response.data);
        } catch (error) {
          if (error instanceof Error && "status" in error && error.status === 401) return null;
          throw error;
        }
      },
      async signIn(input) {
        const credentials = z
          .strictObject({ email: z.email(), password: z.string().min(1) })
          .parse({ email: input.email, password: input.password });
        const response = await client.requestParsed("/v1/auth/sign-in", SessionResponseSchema, {
          method: "POST",
          body: credentials,
          suppressSessionExpiry: true,
        });
        return toSession(response.data);
      },
      async signOut() {
        await client.requestParsed("/v1/auth/sign-out", SignedOutResponseSchema, {
          method: "POST",
        });
      },
    },
    recoveryRecords: {
      listOwn: () =>
        client.requestParsed("/v1/recovery-records?scope=own", RecoveryRecordListSchema, {
          method: "GET",
        }),
      listOperational: () =>
        client.requestParsed("/v1/recovery-records?scope=operational", RecoveryRecordListSchema, {
          method: "GET",
        }),
      async getById(recordId) {
        try {
          return await client.requestParsed(
            `/v1/recovery-records/${encodeURIComponent(recordId)}`,
            RecoveryRecordSchema,
            { method: "GET" },
          );
        } catch (error) {
          if (error instanceof ScrapTraceServiceError && error.status === 404) return null;
          throw error;
        }
      },
      async saveDraft(record) {
        const parsed = RecoveryRecordSchema.parse(record);
        return client.requestParsed(
          `/v1/recovery-records/${parsed.record_id}/draft`,
          RecoveryRecordSchema,
          {
            method: "PUT",
            body: parsed,
            headers: { "If-Match": String(parsed.revision) },
          },
        );
      },
      createDraft: (input) =>
        client.requestParsed("/v1/recovery-records", RecoveryRecordSchema, {
          method: "POST",
          body: captureForm(input),
          idempotencyKey: createDraftKey(input.image),
        }),
      updateDraft: (recordId, input) =>
        client.requestParsed(
          `/v1/recovery-records/${encodeURIComponent(recordId)}/draft`,
          RecoveryRecordSchema,
          {
            method: "PATCH",
            body: captureForm(input),
            ...(input.baseRevision === undefined
              ? {}
              : { headers: { "If-Match": String(input.baseRevision) } }),
          },
        ),
      async submit(recordId) {
        const result = await client.requestParsed(
          `/v1/recovery-records/${encodeURIComponent(recordId)}/submissions`,
          SubmitResponseSchema,
          {
            method: "POST",
            body: {},
            idempotencyKey: `submit-record:${recordId}`,
          },
        );
        return result.outcome === "duplicate_image"
          ? {
              outcome: result.outcome,
              record: result.record,
              flagCodes: result.flag_codes,
            }
          : result;
      },
      lookupForHandoff: notImplemented,
      listEvents: (recordId) =>
        client.requestParsed(
          `/v1/recovery-records/${encodeURIComponent(recordId)}/events`,
          z.array(RecoveryRecordEventSchema),
          { method: "GET" },
        ),
      listEvidence: (recordId) =>
        client.requestParsed(
          `/v1/recovery-records/${encodeURIComponent(recordId)}/evidence`,
          z.array(EvidenceSchema),
          { method: "GET" },
        ),
      async getEvidenceImage(evidenceId) {
        try {
          const blob = await client.requestBlob(
            `/v1/evidence/${encodeURIComponent(evidenceId)}/content`,
            { method: "GET", headers: { Accept: "image/*" } },
          );
          return blob.type.startsWith("image/") ? blobToDataUrl(blob) : null;
        } catch (error) {
          if (error instanceof ScrapTraceServiceError && error.status === 404) return null;
          throw error;
        }
      },
    },
    vision: {
      async appraise(request) {
        const { image, ...domainRequest } = request;
        const parsed = VisionAppraisalRequestSchema.parse(domainRequest);
        const form = new FormData();
        const uploadName =
          typeof File !== "undefined" && image instanceof File ? image.name : "upload";
        form.append("image", image, uploadName);
        form.append("evidence_id", parsed.evidence_id);
        const payload = await client.request("/v1/vision/appraise", {
          method: "POST",
          body: form,
        });
        return VisionAppraisalResponseSchema.parse(payload);
      },
    },
    safetyGuidance: { getGuidance: notImplemented },
    locations: { search: notImplemented },
    handoffs: { record: notImplemented, confirmReceipt: notImplemented },
    processing: { record: notImplemented, submitProcessing: notImplemented },
    reviews: {
      decide: notImplemented,
      submitDecision: notImplemented,
      listQueue: notImplemented,
    },
    reporting: { summarize: notImplemented, listForReport: notImplemented },
    dataExports: { build: notImplemented },
    safetyContent: {
      list: notImplemented,
      getById: notImplemented,
      createDraft: notImplemented,
      updateDraft: notImplemented,
      approve: notImplemented,
      changeStatus: notImplemented,
    },
    modelAdministration: {
      listRegistry: notImplemented,
      getConfiguration: notImplemented,
      saveConfiguration: notImplemented,
      listFeedback: notImplemented,
      decideFeedback: notImplemented,
    },
    programmeSettings: { get: notImplemented, save: notImplemented },
    synchronization: { synchronize: notImplemented },
    localData: { summary: notImplemented, clear: notImplemented },
  };
};
