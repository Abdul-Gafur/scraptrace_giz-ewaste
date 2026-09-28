import {
  CONTRACT_SCHEMA_VERSION,
  MANUAL_TRANSFER_CODE_ALPHABET,
  ManualTransferCodeSchema,
  QrCredentialsSchema,
  type ManualTransferCode,
  type QrCredentials,
  type RecoveryRecord,
} from "@scraptrace/contracts";

import { sha256Text } from "@/services/domain/digest";

import { localQrPayload } from "./record-factory";

/**
 * Handoff credentials of the browser-backed demonstration repository, which stands in for the
 * API (ADR-009). The repository already issues each local record an opaque lookup token; the
 * manual transfer code is derived from it with a separate label. The real API derives both
 * independently from a server secret and stores only digests; this mock never runs in
 * production and is used for isolated tests and the offline demonstration only.
 */
export const localTransferCode = async (record: RecoveryRecord): Promise<ManualTransferCode> => {
  const digest = await sha256Text(
    `scraptrace-demo-manual-transfer-code:${localQrPayload(record).lookup_token}`,
  );
  let value = BigInt(`0x${digest.slice(7, 23)}`) >> 4n;
  const symbols: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    symbols.unshift(MANUAL_TRANSFER_CODE_ALPHABET[Number(value & 31n)] ?? "0");
    value >>= 5n;
  }
  const compact = symbols.join("");
  return ManualTransferCodeSchema.parse(
    `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`,
  );
};

/** Mirrors the API's credential status rules for a local record. */
export const localCredentials = async (record: RecoveryRecord): Promise<QrCredentials> => {
  const status = record.handoff
    ? "used"
    : record.business_state === "draft"
      ? "inactive"
      : record.business_state === "awaiting_handoff"
        ? "active"
        : "used";
  const usable = status === "inactive" || status === "active";
  return QrCredentialsSchema.parse({
    record_id: record.record_id,
    status,
    ...(usable
      ? {
          qr_payload: {
            contract_version: CONTRACT_SCHEMA_VERSION,
            record_id: record.record_id,
            lookup_token: localQrPayload(record).lookup_token,
          },
          manual_transfer_code: await localTransferCode(record),
        }
      : {}),
    issued_at: record.created_at,
    ...(status === "inactive" ? {} : { activated_at: record.updated_at }),
    ...(record.handoff ? { used_at: record.handoff.server_received_at } : {}),
  });
};
