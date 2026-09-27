import {
  ActorIdSchema,
  ClientMutationIdSchema,
  DeviceInstanceIdSchema,
  EventIdSchema,
  EvidenceIdSchema,
  HumanReadableReferenceSchema,
  IdempotencyKeySchema,
  OpaqueLookupTokenSchema,
  RecoveryRecordIdSchema,
  UuidV7Schema,
  createUuidV7,
  type RecoveryRecordId,
} from "@scraptrace/contracts";

/**
 * Identifier factories. Every value is produced through the contract schema so an invalid
 * identifier can never reach the repository, and branded types stay honest without assertions.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

export const newRecoveryRecordId = () => RecoveryRecordIdSchema.parse(createUuidV7());
export const newEvidenceId = () => EvidenceIdSchema.parse(createUuidV7());
export const newEventId = () => EventIdSchema.parse(createUuidV7());
export const newActorId = () => ActorIdSchema.parse(createUuidV7());
export const newDeviceInstanceId = () => DeviceInstanceIdSchema.parse(createUuidV7());
export const newClientMutationId = () => ClientMutationIdSchema.parse(createUuidV7());
export const newUuid = () => UuidV7Schema.parse(createUuidV7());

/** `ST-` plus eight Crockford-free base32 characters, matching HumanReadableReferenceSchema. */
export const newHumanReference = () =>
  HumanReadableReferenceSchema.parse(
    `ST-${Array.from(randomBytes(8), (byte) => BASE32_ALPHABET[byte % BASE32_ALPHABET.length]).join("")}`,
  );

/**
 * Opaque handoff lookup token. It carries no personal data and no record identifier, so a
 * scanned QR symbol reveals nothing on its own (FR-REC-003).
 */
export const newLookupToken = () =>
  OpaqueLookupTokenSchema.parse(
    Array.from(randomBytes(24), (byte) => BASE32_ALPHABET[byte % BASE32_ALPHABET.length])
      .join("")
      .toLowerCase(),
  );

/**
 * Stable idempotency key for one logical mutation on one record (BR-007). The same operation
 * on the same record from the same actor always produces the same key, so a repeated
 * submission replays instead of creating a second state change.
 */
export const idempotencyKeyFor = (
  operation: string,
  recordId: RecoveryRecordId,
  actorId: string,
): ReturnType<typeof IdempotencyKeySchema.parse> =>
  IdempotencyKeySchema.parse(`${operation}:${recordId}:${actorId}`.slice(0, 128));
