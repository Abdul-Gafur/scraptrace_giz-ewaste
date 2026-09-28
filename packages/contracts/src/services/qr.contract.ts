import { z } from "zod";

import { ApproximateAreaSchema, WeightSchema } from "../common/geography.js";
import {
  ActorReferenceSchema,
  EvidenceIdSchema,
  HumanReadableReferenceSchema,
  ManualTransferCodeSchema,
  OpaqueLookupTokenSchema,
  QrPayloadSchema,
  RecoveryRecordIdSchema,
} from "../common/identifiers.js";
import { UtcTimestampSchema } from "../common/timestamps.js";
import {
  DestinationSelectionSchema,
  EwasteCategorySchema,
  ItemConditionSchema,
  RecordKindSchema,
} from "../recovery-record/recovery-record.schema.js";
import { HandoffStateSchema, RecoveryRecordStateSchema } from "../recovery-record/recovery-record.states.js";

/**
 * State of a record's current handoff credentials (ADR-009).
 *
 * - `inactive`: issued with the draft; nothing resolves until the record is published.
 * - `active`: the record awaits handoff and both credentials resolve until `expires_at`.
 * - `expired`: past `expires_at`; the owner reissues to continue.
 * - `used`: a handoff was recorded; a later scan only reports the existing receipt.
 *
 * A reissue revokes the previous QR token and manual code together; a revoked pair never
 * resolves again and is not reported here.
 */
export const QrCredentialStatusSchema = z.enum(["inactive", "active", "expired", "used"]);

/**
 * The owning collector's handoff credentials. `qr_payload` is rendered as the QR symbol and
 * `manual_transfer_code` is read aloud or typed when scanning is impossible. They are two
 * independent secrets for the same record: neither can be derived from, or exchanged for, the
 * other. Both are omitted once they can no longer be used (`expired` or `used`).
 */
export const QrCredentialsSchema = z
  .strictObject({
    record_id: RecoveryRecordIdSchema,
    status: QrCredentialStatusSchema,
    qr_payload: QrPayloadSchema.optional(),
    manual_transfer_code: ManualTransferCodeSchema.optional(),
    issued_at: UtcTimestampSchema,
    activated_at: UtcTimestampSchema.optional(),
    expires_at: UtcTimestampSchema.optional(),
    used_at: UtcTimestampSchema.optional(),
  })
  .superRefine((value, context) => {
    const usable = value.status === "inactive" || value.status === "active";
    if (usable !== (value.qr_payload !== undefined && value.manual_transfer_code !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["qr_payload"],
        message: "Credentials are present exactly while they can still be used.",
      });
    }
    if (value.qr_payload && value.qr_payload.record_id !== value.record_id) {
      context.addIssue({ code: "custom", path: ["qr_payload", "record_id"], message: "QR record ID must match." });
    }
    if (value.status !== "inactive" && !value.activated_at) {
      context.addIssue({ code: "custom", path: ["activated_at"], message: "An issued credential records its activation." });
    }
  });

/**
 * A recycler presents exactly one credential. `qr_payload` is the decoded QR object and
 * `qr_text` the raw symbol text (`SCRAPTRACE:<contract version>:<record id>:<lookup token>`);
 * the QR's contract version is checked by the server so an unsupported version is reported as
 * `UNSUPPORTED_CONTRACT_VERSION`. `manual_transfer_code` is the canonical typed code
 * (`normalizeManualTransferCode`). Unknown, revoked or expired credentials all return the same
 * `RESOURCE_NOT_FOUND` error. Lookups are rate limited per user.
 */
export const HandoffLookupRequestSchema = z.union([
  z.strictObject({
    qr_payload: z.strictObject({
      contract_version: z.string().min(1).max(32),
      record_id: RecoveryRecordIdSchema,
      lookup_token: OpaqueLookupTokenSchema,
    }),
  }),
  z.strictObject({ qr_text: z.string().min(1).max(400) }),
  z.strictObject({ manual_transfer_code: ManualTransferCodeSchema }),
]);

/**
 * What a recycler may see before accepting an item (FR-HND-002): enough to compare the
 * delivery, with no coordinates, contact details, prediction scores or credentials.
 */
export const HandoffPreviewSchema = z.strictObject({
  record_id: RecoveryRecordIdSchema,
  human_reference: HumanReadableReferenceSchema,
  record_kind: RecordKindSchema,
  category: EwasteCategorySchema,
  item_count: z.number().int().positive().optional(),
  approximate_weight: WeightSchema.optional(),
  condition: ItemConditionSchema,
  approximate_area: ApproximateAreaSchema,
  captured_at: UtcTimestampSchema,
  collector: ActorReferenceSchema,
  original_image_evidence_id: EvidenceIdSchema,
  destination: DestinationSelectionSchema.optional(),
  business_state: RecoveryRecordStateSchema,
  handoff_state: HandoffStateSchema,
});

/**
 * Lookup outcomes. A lookup never returns either credential: the handoff request carries the
 * credential the recycler presented. `other_facility` reveals only that the item belongs to
 * another facility.
 */
export const HandoffLookupResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("ready"), record: HandoffPreviewSchema }),
  z.strictObject({ outcome: z.literal("not_ready"), record: HandoffPreviewSchema }),
  z.strictObject({
    outcome: z.literal("already_received"),
    record: HandoffPreviewSchema,
    received_at: UtcTimestampSchema,
  }),
  z.strictObject({ outcome: z.literal("other_facility") }),
]);

export type QrCredentialStatus = z.infer<typeof QrCredentialStatusSchema>;
export type QrCredentials = z.infer<typeof QrCredentialsSchema>;
export type HandoffLookupRequest = z.infer<typeof HandoffLookupRequestSchema>;
export type HandoffPreview = z.infer<typeof HandoffPreviewSchema>;
export type HandoffLookupResponse = z.infer<typeof HandoffLookupResponseSchema>;
