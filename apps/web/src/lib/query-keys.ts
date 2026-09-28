import type { UserRole } from "@scraptrace/contracts";

/**
 * Query keys.
 *
 * Every key is scoped by the acting role, because the same service method returns a different,
 * role-scoped result for each workspace. A mutation invalidates the `records` root, which refreshes
 * every role's view of the shared repository.
 */
export const queryKeys = {
  session: (role: UserRole) => ["session", role] as const,
  records: {
    root: ["records"] as const,
    own: (role: UserRole) => ["records", "own", role] as const,
    operational: (role: UserRole) => ["records", "operational", role] as const,
    detail: (recordId: string) => ["records", "detail", recordId] as const,
    events: (recordId: string) => ["records", "events", recordId] as const,
    evidence: (recordId: string) => ["records", "evidence", recordId] as const,
    pages: (role: UserRole, filters: string) => ["records", "pages", role, filters] as const,
    credentials: (recordId: string) => ["records", "credentials", recordId] as const,
    processingQueue: ["records", "processing-queue"] as const,
    processingDraft: (recordId: string) => ["records", "processing-draft", recordId] as const,
    reviewCases: (filters: string) => ["records", "review-cases", filters] as const,
    reviewCase: (recordId: string) => ["records", "review-case", recordId] as const,
  },
  reference: {
    programme: ["reference", "programme"] as const,
    destinations: ["reference", "destinations"] as const,
    receivingLocations: ["reference", "receiving-locations"] as const,
  },
  locations: (category: string, area: string) => ["locations", category, area] as const,
  safetyGuidance: (category: string, language: string) =>
    ["safety-guidance", category, language] as const,
  safetyCards: ["safety-cards"] as const,
  safetyCard: (cardId: string) => ["safety-cards", cardId] as const,
  report: {
    summary: (filters: string) => ["report", "summary", filters] as const,
    rows: (filters: string) => ["report", "rows", filters] as const,
  },
  model: {
    registry: ["model", "registry"] as const,
    configuration: ["model", "configuration"] as const,
    feedback: ["model", "feedback"] as const,
  },
  programmeSettings: ["programme-settings"] as const,
  localData: ["local-data"] as const,
};
