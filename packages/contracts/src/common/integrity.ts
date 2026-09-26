import { z } from "zod";

export const Sha256DigestSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "Expected sha256 followed by 64 lowercase hexadecimal characters.")
  .brand<"Sha256Digest">();

export const IntegrityVerificationSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("verified"), digest: Sha256DigestSchema }),
  z.strictObject({
    status: z.literal("failed"),
    expected_digest: Sha256DigestSchema,
    actual_digest: Sha256DigestSchema,
    error_code: z.literal("INTEGRITY_FAILURE"),
  }),
]);

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const canonicalizeValue = (value: JsonValue, ancestors: Set<object>): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers.");
    }
    return JSON.stringify(value === 0 ? 0 : value);
  }

  if (ancestors.has(value)) {
    throw new TypeError("Canonical JSON does not support cyclic structures.");
  }

  ancestors.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => canonicalizeValue(item, ancestors)).join(",")}]`;
  } else {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key] as JsonValue, ancestors)}`);
    result = `{${entries.join(",")}}`;
  }
  ancestors.delete(value);
  return result;
};

export const canonicalizeJson = (value: JsonValue): string => canonicalizeValue(value, new Set());

export const sha256CanonicalJson = async (value: JsonValue): Promise<z.infer<typeof Sha256DigestSchema>> => {
  const input = new TextEncoder().encode(canonicalizeJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return Sha256DigestSchema.parse(`sha256:${hexadecimal}`);
};

export const verifyCanonicalJsonDigest = async (
  value: JsonValue,
  expected: z.infer<typeof Sha256DigestSchema>,
): Promise<z.infer<typeof IntegrityVerificationSchema>> => {
  const actual = await sha256CanonicalJson(value);
  return actual === expected
    ? { status: "verified", digest: actual }
    : {
        status: "failed",
        expected_digest: expected,
        actual_digest: actual,
        error_code: "INTEGRITY_FAILURE",
      };
};

