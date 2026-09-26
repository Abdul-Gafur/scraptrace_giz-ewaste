import { z } from "zod";

import { EventIdSchema } from "../common/identifiers.js";
import { sha256CanonicalJson, type JsonValue } from "../common/integrity.js";
import { RecoveryRecordIntegrityPayloadSchema, type RecoveryRecord, type RecoveryRecordIntegrityPayload } from "./recovery-record.schema.js";

export const IntegrityAmendmentSchema = z.strictObject({
  previous_digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  amendment_reason: z.string().min(1).max(1_000),
  amendment_event_id: EventIdSchema,
});

const RecoveryRecordIntegritySelectorSchema = RecoveryRecordIntegrityPayloadSchema.strip();

export const selectRecoveryRecordIntegrityPayload = (record: RecoveryRecord): RecoveryRecordIntegrityPayload =>
  RecoveryRecordIntegritySelectorSchema.parse(record);

export const computeRecoveryRecordDigest = async (record: RecoveryRecord) =>
  sha256CanonicalJson(selectRecoveryRecordIntegrityPayload(record) as unknown as JsonValue);
