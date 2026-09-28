import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { CONTRACT_SCHEMA_VERSION } from "../schema-version.js";

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const UuidV7Schema = z
  .string()
  .regex(UUID_V7_PATTERN, "Expected a lowercase RFC 9562 UUIDv7.");

export const RecoveryRecordIdSchema = UuidV7Schema.brand<"RecoveryRecordId">();
export const EvidenceIdSchema = UuidV7Schema.brand<"EvidenceId">();
export const EventIdSchema = UuidV7Schema.brand<"EventId">();
export const ActorIdSchema = UuidV7Schema.brand<"ActorId">();
export const DeviceInstanceIdSchema = UuidV7Schema.brand<"DeviceInstanceId">();
export const ClientMutationIdSchema = UuidV7Schema.brand<"ClientMutationId">();
export const CorrelationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .brand<"CorrelationId">();

export const HumanReadableReferenceSchema = z
  .string()
  .regex(/^ST-[A-Z0-9]{8,16}$/)
  .brand<"HumanReadableReference">();

export const OpaqueLookupTokenSchema = z
  .string()
  .min(24)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/)
  .brand<"OpaqueLookupToken">();

/**
 * Crockford base32: digits and upper-case letters without I, L, O and U, so a code read aloud
 * or copied by hand is unambiguous.
 */
export const MANUAL_TRANSFER_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * A typed alternative to scanning the QR (FR-HND-001). Twelve base32 symbols carry 60 random
 * bits, shown as three groups of four. It is a separate credential from the QR lookup token:
 * the server stores only its digest, it expires, rotates and is revoked with the QR, and no
 * endpoint exchanges it for the lookup token (ADR-009).
 */
export const ManualTransferCodeSchema = z
  .string()
  .regex(
    /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    "Expected three groups of four Crockford base32 symbols.",
  )
  .brand<"ManualTransferCode">();

/**
 * Canonical form of a typed code: upper case, separators removed, the Crockford aliases
 * (O→0, I/L→1) applied, then regrouped. Returns `null` for anything that cannot be a code.
 */
export const normalizeManualTransferCode = (value: string): z.infer<typeof ManualTransferCodeSchema> | null => {
  const compact = value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (compact.length !== 12) return null;
  const parsed = ManualTransferCodeSchema.safeParse(`${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`);
  return parsed.success ? parsed.data : null;
};

/**
 * Device-instance identifier recorded on evidence the API generates itself (QR scan, receipt
 * and reviewer-decision documents), whose capture source is `system_generated`.
 */
export const SYSTEM_DEVICE_INSTANCE_ID = "0199c0de-0000-7000-8000-000000000001" as const;

export const IdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency keys must be opaque and contain no whitespace.")
  .brand<"IdempotencyKey">();

export const ActorReferenceSchema = z.strictObject({
  actor_id: ActorIdSchema,
  programme_id: UuidV7Schema.optional(),
  facility_id: UuidV7Schema.optional(),
});

export const QrPayloadSchema = z.strictObject({
  contract_version: z.literal(CONTRACT_SCHEMA_VERSION),
  record_id: RecoveryRecordIdSchema,
  lookup_token: OpaqueLookupTokenSchema,
});

export type RecoveryRecordId = z.infer<typeof RecoveryRecordIdSchema>;
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;
export type ActorReference = z.infer<typeof ActorReferenceSchema>;
export type QrPayload = z.infer<typeof QrPayloadSchema>;
export type ManualTransferCode = z.infer<typeof ManualTransferCodeSchema>;

export const createUuidV7 = (): z.infer<typeof UuidV7Schema> => UuidV7Schema.parse(uuidv7());
