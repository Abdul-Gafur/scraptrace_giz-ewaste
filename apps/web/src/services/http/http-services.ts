import type { FrontendServices } from "@/services/ports/service-ports";

const notImplemented = async (): Promise<never> => {
  throw new Error("HTTP services are not implemented in this frontend foundation.");
};

export const createHttpServices = (): FrontendServices => ({
  authentication: { getSession: notImplemented, signOut: notImplemented },
  recoveryRecords: { listOwn: notImplemented, getById: notImplemented, saveDraft: notImplemented },
  vision: { appraise: notImplemented },
  safetyGuidance: { getGuidance: notImplemented },
  locations: { search: notImplemented },
  handoffs: { record: notImplemented },
  processing: { record: notImplemented },
  reviews: { decide: notImplemented },
  reporting: { summarize: notImplemented },
  synchronization: { synchronize: notImplemented },
});
