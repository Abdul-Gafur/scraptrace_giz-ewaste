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

export const createUuidV7 = (): z.infer<typeof UuidV7Schema> => UuidV7Schema.parse(uuidv7());
