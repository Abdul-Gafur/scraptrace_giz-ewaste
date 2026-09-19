# Offline-first design

## Required behaviour

Offline operation is an SRS requirement. ScrapTrace is an installable PWA that saves a validated draft locally before network submission and uses a service worker plus user-scoped browser storage. Storage implementation and encryption mechanism still require validation, but the behaviours and state names below are fixed by FR-OFF-001–008.

## Available offline after provisioning

- Language selection and reviewed interface strings in English, French, Arabic and Portuguese.
- Current-image capture, validation/compression metadata and local draft create/edit/reopen.
- Manual category confirmation or correction when cloud inference is unavailable.
- Cached current approved safety cards, translations, fixed emergency wording and previously validated explanations with provenance.
- Latest reviewed compact receiving-location directory with update date.
- Local record reference and queued submission; QR/canonical server status remains pending until acknowledged.
- Visible connectivity, storage and synchronization states.

## Requires internet

- Fresh cloud inference or LLM explanation.
- Canonical server creation, authoritative lifecycle state and cross-device access.
- Live map, geocoding, directions, current reference refresh and reviewer/dashboard actions.
- Server-wide duplicate checks, evidence uploads and programme approval.

## Record lifecycle versus synchronization state

These are independent dimensions and must not be collapsed.

**Recovery-record lifecycle:** `Draft` → `Saved offline` → `Pending synchronization` → `Submitted` → `Awaiting handoff` → `Received` → `Processing recorded` → `Completed` or `Under review` → `Approved and completed`/`Rejected` as applicable. The normative model is [Figure 13](analysis-models.md#figure-13-recovery-record-state-transition-model).

**User-visible synchronization status:**

| Status | Meaning |
|---|---|
| `Offline` | Network unavailable; current action has not reached the server. |
| `Pending synchronization` | Durable local mutation is queued. |
| `Synchronizing` | A network attempt is active. |
| `Synchronized` | Server durably acknowledged and returned the logical result. |
| `Action required` | Conflict, non-retryable validation/authorisation issue or storage problem needs intervention. |

## Local mutation envelope

Every queued mutation contains client-generated identifier, idempotency key, creation time, local version, actor/session scope, operation type, dependency/order metadata, safe payload reference, attempt metadata and sync state. It is acknowledged/removed only after durable server response.

## Retry and idempotency

- Retry transient connectivity, timeout, rate-limit and temporary-service failures with bounded exponential backoff and jitter.
- Pause on expired authentication until sign-in; preserve recoverable local work.
- Do not automatically retry validation, forbidden transition, permission or version-conflict responses.
- One idempotency key means one logical mutation. Replays return the existing result.
- One client record ID maps to one canonical server ID.
- Repeated QR scan never creates another recovery record.

## Conflict and duplicate handling

No evidence uses silent last-write-wins. On version mismatch, preserve both local/server values, stop automatic overwrite and show `Action required`. Collector and recycler assertions remain separate; stale terminal transitions fail; material category/weight/destination/evidence disagreement creates review work. Image digest reuse creates a flag, not automatic fraud or rejection.

## Storage failure and user control

The application monitors quota where supported, warns before exhaustion and never claims success after a failed write. It may offer image reduction or later retry. Sensitive cache is scoped to the signed-in user; explicit sign-out/clear removes locally cached personal records. A second seeded account on the same device cannot access the first account's records.

## LLM and safety fallback

New cloud-generated wording requires connectivity. Offline guidance comes from reviewed cached cards/translations or previously validated explanations. Missing approved content produces the reviewed referral and no provider call. Emergency wording is fixed, reviewed and locally available. Cache displays category, language, source, version, approval/review dates and freshness.

## Verification evidence

Tests cover initial offline capture, close/reopen, network loss at every stage, reordered/repeated retry, quota failure, stale/missing cache, session expiry, server rejection, version conflict, duplicate image/key, user switch and final canonical mapping. NFR-PERF-001 requires local save within 2 seconds for 95 of 100 attempts with no accepted-data loss; NFR-REL-001 requires recovery in ten interruption scenarios.
