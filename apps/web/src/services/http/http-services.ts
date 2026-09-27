import { VisionAppraisalRequestSchema, VisionAppraisalResponseSchema } from "@scraptrace/contracts";

import type { FrontendServices } from "@/services/ports/service-ports";

import { HttpClient } from "./http-client";

const notImplemented = async (): Promise<never> => {
  throw new Error("This HTTP service is not implemented in the backend walking skeleton.");
};

export const createHttpServices = (apiBaseUrl: string): FrontendServices => {
  const client = new HttpClient(apiBaseUrl);
  return {
    authentication: { getSession: notImplemented, signOut: notImplemented },
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
