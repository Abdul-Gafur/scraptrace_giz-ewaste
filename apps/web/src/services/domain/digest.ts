import { Sha256DigestSchema, sha256CanonicalJson, type JsonValue } from "@scraptrace/contracts";

/**
 * Content digests. A digest detects later change to recorded content. It is not proof that the
 * recorded event happened or that the content is truthful (ADR-004), and no screen may present
 * it that way.
 */

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * Copies the bytes into a view created in this realm. A `Blob` supplied by another realm — a
 * browser file input, or jsdom under test — hands back an `ArrayBuffer` that the Web Crypto
 * brand check rejects, so the copy is what makes the digest work in both.
 */
const localBytes = (data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> => {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);
  return copy;
};

export const sha256Bytes = async (data: ArrayBuffer | Uint8Array) =>
  Sha256DigestSchema.parse(
    `sha256:${toHex(await globalThis.crypto.subtle.digest("SHA-256", localBytes(data)))}`,
  );

export const sha256Blob = async (blob: Blob) => sha256Bytes(await blob.arrayBuffer());

export const sha256Text = async (value: string) => sha256Bytes(new TextEncoder().encode(value));

export const sha256Json = (value: JsonValue) => sha256CanonicalJson(value);
