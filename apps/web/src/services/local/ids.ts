import {
  ClientMutationIdSchema,
  EvidenceIdSchema,
  HumanReadableReferenceSchema,
  IdempotencyKeySchema,
  OpaqueLookupTokenSchema,
  RecoveryRecordIdSchema,
  createUuidV7,
  sha256CanonicalJson,
  type ActorReference,
  type IdempotencyMetadata,
  type JsonValue,
} from "@scraptrace/contracts";

/**
 * Identifier helpers for the in-browser programme store. Every value is produced through the
 * contract schema that owns it, so a shape the backend would reject cannot be created here.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomValues = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

export const newRecordId = () => RecoveryRecordIdSchema.parse(createUuidV7());
export const newEvidenceId = () => EvidenceIdSchema.parse(createUuidV7());
export const newClientMutationId = () => ClientMutationIdSchema.parse(createUuidV7());
export const newUuid = () => createUuidV7();

/** `ST-` plus eight unambiguous characters, as the contract's reference pattern requires. */
export const newHumanReference = () =>
  HumanReadableReferenceSchema.parse(
    `ST-${Array.from(randomValues(8), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")}`,
  );

/** The opaque token a QR carries. It identifies nothing on its own and is never a record id. */
export const newLookupToken = () =>
  OpaqueLookupTokenSchema.parse(
    Array.from(randomValues(32), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join("")
      .toLowerCase(),
  );

/**
 * Idempotency metadata for one operation. The digest covers the request body, so replaying an
 * identical request is recognised as a replay and a different body under the same key is a
 * conflict (`compareIdempotencyRequest`).
 */
export const createIdempotency = async ({
  actor,
  operation,
  resourceId,
  request,
}: {
  actor: ActorReference;
  operation: string;
  resourceId?: string;
  request: JsonValue;
}): Promise<IdempotencyMetadata> => ({
  idempotency_key: IdempotencyKeySchema.parse(
    `${operation}:${resourceId ?? "new"}:${createUuidV7()}`,
  ),
  request_digest: await sha256CanonicalJson(request),
  scope: {
    actor_id: actor.actor_id,
    operation,
    ...(resourceId ? { resource_id: RecoveryRecordIdSchema.parse(resourceId) } : {}),
  },
});

export const nowTimestamp = (): string => new Date().toISOString();
