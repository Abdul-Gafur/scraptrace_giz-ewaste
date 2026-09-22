/**
 * Fictional sample records taken from the approved Figma frames. Identifiers are opaque
 * display labels; all descriptive text lives in the `samples` message namespace.
 */
export const SAMPLE_RECORDS = [
  {
    key: "leadAcid",
    id: "ST-0941",
    status: "pending_synchronization",
    reviewStatus: "awaiting_handoff",
    gps: "verified_gps",
  },
  {
    key: "crt",
    id: "ST-0832",
    status: "action_required",
    reviewStatus: "action_required",
    gps: "unverified_gps",
  },
  {
    key: "telecom",
    id: "ST-0192",
    status: "synchronized",
    reviewStatus: "synchronized",
    gps: "verified_gps",
  },
] as const;

export type SampleRecord = (typeof SAMPLE_RECORDS)[number];
