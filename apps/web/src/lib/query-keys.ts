export const queryKeys = {
  session: ["session"] as const,
  recoveryRecords: {
    all: ["recovery-records"] as const,
    own: ["recovery-records", "own"] as const,
    detail: (recordId: string) => ["recovery-records", "detail", recordId] as const,
    events: ["recovery-records", "events"] as const,
    lookup: (code: string) => ["recovery-records", "lookup", code] as const,
  },
  evidence: (evidenceId: string) => ["evidence", evidenceId] as const,
  locations: (scope: string) => ["locations", scope] as const,
  safetyGuidance: (category: string, language: string) =>
    ["safety-guidance", category, language] as const,
  priceEstimate: (scope: string) => ["price-estimate", scope] as const,
  safetyCards: ["safety-cards"] as const,
  modelLabels: ["model-labels"] as const,
  dataExports: ["data-exports"] as const,
  settings: {
    programme: ["settings", "programme"] as const,
    facility: ["settings", "facility"] as const,
  },
  consent: ["consent"] as const,
  device: ["device", "summary"] as const,
  outbox: ["outbox"] as const,
  reports: (scope: string) => ["reports", scope] as const,
};
