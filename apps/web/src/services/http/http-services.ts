import {
  ActorIdSchema,
  SupportedLanguageSchema,
  UserRoleSchema,
  VisionAppraisalRequestSchema,
  VisionAppraisalResponseSchema,
  serviceSuccessSchema,
} from "@scraptrace/contracts";
import { z } from "zod";

import type { FrontendServices } from "@/services/ports/service-ports";

import { HttpClient } from "./http-client";

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

export const createHttpServices = (apiBaseUrl: string): FrontendServices => {
  const client = new HttpClient(apiBaseUrl);
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
      listOwn: notImplemented,
      listOperational: notImplemented,
      getById: notImplemented,
      saveDraft: notImplemented,
      createDraft: notImplemented,
      submit: notImplemented,
      lookupForHandoff: notImplemented,
      listEvents: notImplemented,
      listEvidence: notImplemented,
      getEvidenceImage: notImplemented,
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
