# ADR-009: Separate QR and manual transfer credentials for handoff

- **Status:** Accepted
- **Date:** 2026-09-28
- **Owners:** Platform architecture; security owner
- **Supplements:** [ADR-004](ADR-004-identifiers-qr-integrity.md) (resolves its lookup-token follow-up)

## Context

A recycler records a handoff only after the collector presents the item. ADR-004 defined the QR payload (`contract_version`, `record_id`, opaque `lookup_token`) but left issuance, expiry and rotation to the API design. FR-HND-001 also requires a typed alternative for when scanning is impossible.

The first backend used the human reference (`ST-` plus ten base32 characters) as the typed code. Because the handoff request needs `lookup_token`, a successful typed lookup returned the lookup token. That design had three defects:

1. A short, displayable reference could be exchanged for the QR secret.
2. The human reference is printed on records and receipts, so it is not a secret at all.
3. The record resource embedded `qr_payload`, so every role that could read the record, including a recycler whose facility was the selected destination, received the lookup token without the item being presented.

## Decision

1. **Two independent credentials per issued token row.** Each `qr_lookup_tokens` row has the QR `lookup_token` and a **manual transfer code**. Both are derived with HMAC-SHA256 from the server-held `SCRAPTRACE_QR_TOKEN_SECRET`, the row ID and a random nonce, under **different context labels**. Neither can be computed from the other without the secret.
2. **Manual code format.** Twelve Crockford base32 symbols (60 bits), shown as `XXXX-XXXX-XXXX`. `normalizeManualTransferCode` in `@scraptrace/contracts` (mirrored in Python and parity-tested) upper-cases the code, removes separators and maps `O→0` and `I/L→1`. The human reference is no longer a transfer credential.
3. **Digest-only storage.** The database stores a SHA-256 digest of the lookup token and a **keyed** HMAC digest of the manual code. The keyed digest means that a copy of the database alone does not allow an offline search of the 60-bit code space. Plaintext credentials are re-derived only for the owning collector.
4. **Shared lifecycle.** The two credentials are issued inert with the draft and activated when the record is published for handoff. They expire after `SCRAPTRACE_QR_TOKEN_TTL_DAYS`, are marked used at handoff, and are revoked together by `POST /v1/recovery-records/{id}/qr-token-rotations`. `QrCredentials.status` reports `inactive`, `active`, `expired` or `used`.
5. **Credentials leave the record resource.** `RecoveryRecord.qr_payload` is now optional and appears only on a collector's local device copy. The API serves credentials only through `GET /v1/recovery-records/{id}/qr-credentials`, which only the owning collector can call (`Cache-Control: private, no-store`).
6. **No exchange.** `POST /v1/handoff-lookups` accepts exactly one of `qr_payload`, `qr_text` or `manual_transfer_code` and returns a minimised `HandoffPreview`. It never returns a lookup token or a manual code. `HandoffRequest` carries exactly one presented credential (`lookup_token` or `manual_transfer_code`), and the server verifies it again inside the handoff transaction. The generated QR-scan evidence document records which kind of credential was presented, never its value.
7. **Generic failures and throttling.** Unknown, malformed, revoked, expired and cross-record credentials all return the same `404 RESOURCE_NOT_FOUND`. All lookups share a per-user rate limit. Failed manual-code presentations have a separate, stricter per-user limit (`SCRAPTRACE_MANUAL_CODE_FAILURE_LIMIT_*`, default 10 per 15 minutes), after which even a correct manual code is refused until the window passes. Scanning the QR is unaffected. Both limits are in-process (see limitations).

## Alternatives considered

### Short-lived lookup grant returned by a typed lookup

A typed lookup could return a one-time server grant that the handoff request then presents. This is secure, but it adds a third credential type, a grant table and grant expiry, and it gives no benefit over presenting the manual code again at handoff.

### Longer human reference

This was rejected because the human reference is display data on receipts and lists. Making it a secret would change its meaning (ADR-004).

### Keep `qr_payload` in the record and mask it by role

This was rejected because it keeps a credential inside a resource that clients cache widely. It would also require every mapper to know which viewer may see a secret.

## Consequences

### Positive

- A code that is typed or read aloud can never be converted into the QR secret, and the QR secret never reaches roles that were not handed the item.
- Rotation revokes both paths at once, so a lost printout or a leaked code is handled by one action.
- The record resource no longer carries any credential, so its representations are safe to cache and share across screens.

### Negative and trade-offs

- `RecoveryRecord.qr_payload` changed from required to optional within contract version `1.0.0`. This is acceptable because the only consumers of the pre-release baseline are in this repository and were changed together. Older clients that required the field must read `QrCredentials` instead.
- Rotating `SCRAPTRACE_QR_TOKEN_SECRET` still invalidates every issued credential (no key versioning yet).

### Risks

- 60 bits resist online guessing under the throttle, but rate limits are per process. A multi-instance deployment needs a shared limiter first (see [known limitations](../../apps/api/docs/limitations.md)).

## Security and privacy impact

Neither credential encodes personal data. Plaintexts are never logged, stored or written into evidence documents; audit events record only the credential kind and outcome. The owner endpoint is uncacheable.

## Follow-up actions

- [x] Define issuance, activation, expiry, rotation and revocation (ADR-004 follow-up).
- [ ] Add key identifiers to token rows so the QR secret can be rotated without invalidating live credentials.
- [ ] Move rate limits to a shared store before horizontal scaling.

## Related documents

- [Phase 1 reconciliation](../integration/phase-1-reconciliation.md)
- [API security notes](../../apps/api/docs/security.md)
- [Threat model](../security/threat-model.md)
