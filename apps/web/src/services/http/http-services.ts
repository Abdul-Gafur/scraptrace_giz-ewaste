import type { FrontendServices } from "@/services/ports/service-ports";

/**
 * The seam a backend fills. Every port the frontend uses is listed here, so the set of
 * endpoints the API has to provide is the set of functions in this file.
 */
const notImplemented = async (): Promise<never> => {
  throw new Error("HTTP services are not implemented in this frontend foundation.");
};

export const createHttpServices = (): FrontendServices => ({
  authentication: { getSession: notImplemented, signIn: notImplemented, signOut: notImplemented },
  recoveryRecords: {
    listOwn: notImplemented,
    list: notImplemented,
    getById: notImplemented,
    saveDraft: notImplemented,
    create: notImplemented,
    submit: notImplemented,
    lookup: notImplemented,
    events: notImplemented,
  },
  evidence: { store: notImplemented, read: notImplemented },
  prices: { estimate: notImplemented },
  safetyContent: {
    listCards: notImplemented,
    createCard: notImplemented,
    approve: notImplemented,
    requestChanges: notImplemented,
    requestTranslationReview: notImplemented,
  },
  modelLabels: { list: notImplemented, commit: notImplemented },
  dataExports: { list: notImplemented, request: notImplemented, build: notImplemented },
  settings: {
    getProgramme: notImplemented,
    saveProgramme: notImplemented,
    getFacility: notImplemented,
    saveFacility: notImplemented,
  },
  consent: { get: notImplemented, set: notImplemented },
  device: { summary: notImplemented, clearLocalData: notImplemented },
  outbox: { pending: notImplemented, flush: notImplemented },
  vision: { appraise: notImplemented },
  safetyGuidance: { getGuidance: notImplemented },
  locations: { search: notImplemented },
  handoffs: { record: notImplemented },
  processing: { record: notImplemented },
  reviews: { decide: notImplemented },
  reporting: { summarize: notImplemented },
  synchronization: { synchronize: notImplemented },
});
