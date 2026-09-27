import { CONTRACT_SCHEMA_VERSION, QrPayloadSchema, type QrPayload } from "@scraptrace/contracts";

/**
 * QR symbol text. The symbol carries exactly the three fields of `QrPayloadSchema`:
 * contract version, recovery-record identifier and an opaque lookup token. It never carries a
 * collector name, telephone number, coordinates or any other personal data (FR-REC-003).
 *
 * The wire form is `SCRAPTRACE:1.0.0:<record id>:<lookup token>`. Colon separation keeps the
 * symbol short and alphanumeric, which keeps the printed module count low enough to scan from
 * a phone screen in poor light.
 */

export const QR_PREFIX = "SCRAPTRACE";

export const encodeQrPayload = (payload: QrPayload): string => {
  const valid = QrPayloadSchema.parse(payload);
  return [QR_PREFIX, valid.contract_version, valid.record_id, valid.lookup_token].join(":");
};

export type QrDecodeResult =
  | { readonly ok: true; readonly payload: QrPayload }
  | { readonly ok: false; readonly reason: "malformed" | "unsupported_contract_version" };

export const decodeQrPayload = (text: string): QrDecodeResult => {
  const parts = text.trim().split(":");
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return { ok: false, reason: "malformed" };
  const [, contractVersion, recordId, lookupToken] = parts;
  if (contractVersion !== CONTRACT_SCHEMA_VERSION) {
    return { ok: false, reason: "unsupported_contract_version" };
  }
  const parsed = QrPayloadSchema.safeParse({
    contract_version: contractVersion,
    record_id: recordId,
    lookup_token: lookupToken,
  });
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, reason: "malformed" };
};

/**
 * Human transfer code. A recycler can type this instead of scanning; it is the record's
 * `human_reference` (`ST-XXXXXXXX`) and is matched case-insensitively with spaces removed.
 */
export const normalizeTransferCode = (value: string): string =>
  value.replace(/\s+/g, "").toUpperCase();
