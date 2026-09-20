export const queryKeys = {
  session: ["session"] as const,
  recoveryRecords: {
    all: ["recovery-records"] as const,
    own: ["recovery-records", "own"] as const,
    detail: (recordId: string) => ["recovery-records", "detail", recordId] as const,
  },
  locations: (category: string) => ["locations", category] as const,
  safetyGuidance: (category: string, language: string) =>
    ["safety-guidance", category, language] as const,
  reports: (scope: string) => ["reports", scope] as const,
};
