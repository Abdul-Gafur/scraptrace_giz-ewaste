import { CONTRACT_SCHEMA_VERSION, QrPayloadSchema } from "@scraptrace/contracts";

import {
  QR_PREFIX,
  decodeQrPayload,
  encodeQrPayload,
  normalizeTransferCode,
} from "@/services/domain/qr-payload";
import { newLookupToken, newRecoveryRecordId } from "@/services/domain/identifiers";

const payload = () =>
  QrPayloadSchema.parse({
    contract_version: CONTRACT_SCHEMA_VERSION,
    record_id: newRecoveryRecordId(),
    lookup_token: newLookupToken(),
  });

describe("QR payload", () => {
  it("encodes only the contract version, record identifier and lookup token", () => {
    const value = payload();
    const encoded = encodeQrPayload(value);
    expect(encoded.split(":")).toEqual([
      QR_PREFIX,
      CONTRACT_SCHEMA_VERSION,
      value.record_id,
      value.lookup_token,
    ]);
  });

  it("round-trips through a decode", () => {
    const value = payload();
    const decoded = decodeQrPayload(encodeQrPayload(value));
    expect(decoded).toEqual({ ok: true, payload: value });
  });

  it("tolerates surrounding whitespace from a scanner", () => {
    const value = payload();
    expect(decodeQrPayload(`\n  ${encodeQrPayload(value)}  \n`)).toEqual({
      ok: true,
      payload: value,
    });
  });

  it("rejects an unsupported contract version without guessing", () => {
    const value = payload();
    const text = `${QR_PREFIX}:9.9.9:${value.record_id}:${value.lookup_token}`;
    expect(decodeQrPayload(text)).toEqual({ ok: false, reason: "unsupported_contract_version" });
  });

  it("rejects anything that is not a ScrapTrace payload", () => {
    for (const text of [
      "",
      "hello",
      "OTHER:1.0.0:a:b",
      `${QR_PREFIX}:1.0.0:a`,
      "https://example.test/x",
    ]) {
      expect(decodeQrPayload(text).ok).toBe(false);
    }
  });

  it("rejects a payload whose identifier is not a contract identifier", () => {
    const value = payload();
    const text = `${QR_PREFIX}:${CONTRACT_SCHEMA_VERSION}:not-a-uuid:${value.lookup_token}`;
    expect(decodeQrPayload(text)).toEqual({ ok: false, reason: "malformed" });
  });

  it("carries no personal data: the encoded text is exactly the three contract fields", () => {
    const value = payload();
    const encoded = encodeQrPayload(value);
    const allowed = new Set([
      QR_PREFIX,
      CONTRACT_SCHEMA_VERSION,
      value.record_id,
      value.lookup_token,
    ]);
    for (const part of encoded.split(":")) expect(allowed.has(part)).toBe(true);
  });

  it("normalises a typed transfer code", () => {
    expect(normalizeTransferCode(" st-ab12 cd34 ")).toBe("ST-AB12CD34");
  });
});
