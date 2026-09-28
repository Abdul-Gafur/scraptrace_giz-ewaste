# Frontend screen-to-endpoint matrix

`NEXT_PUBLIC_API_MODE=http` selects the HTTP adapter (`apps/web/src/services/http/http-services.ts`). `NEXT_PUBLIC_API_MODE=mock` keeps the browser-backed demonstration services for isolated tests. Every Phase 1 screen works in HTTP mode against `apps/api`.

## How every call behaves

- Calls go to `NEXT_PUBLIC_API_BASE_URL` with `credentials: "include"`, an `X-Request-ID`, and `Accept: application/json`.
- The session is the API's HttpOnly `scraptrace_session` cookie. No credential is readable by JavaScript or kept in browser storage. A `401` from any call other than session restoration dispatches the session-expired event.
- Successful JSON bodies are the standard success envelope. Each `data` is parsed with the named `@scraptrace/contracts` schema, and a contract-invalid response is rejected. Errors are parsed as `ErrorEnvelope`; an empty error body becomes a safe fallback envelope for its status.
- Contract commands carry `idempotency` in the body. The key is derived from the request digest, so a retried identical request replays and a changed request is a new command. Operation names come from `IDEMPOTENT_OPERATIONS`.
- `consumed-operations.json` lists every operation below. The API test `test_frontend_operations.py` checks each one against the generated OpenAPI document, and the adapter tests fail if the adapter calls anything not listed or stops calling something listed.

## Matrix

| Screen or flow | Method and endpoint | Request | Response contract |
| --- | --- | --- | --- |
| Sign in | `POST /v1/auth/sessions` | `SignInRequest` (username, password) | `SessionCreated` (no credential in the body) |
| Session restore, identity, scope | `GET /v1/auth/me` | cookie | `CurrentUser` |
| Sign out | `DELETE /v1/auth/sessions/current` | cookie, allowed `Origin` | `204` |
| Development demo accounts | `GET /v1/auth/demo-accounts` | — | `DemoAccountList` (usernames only; `404` when disabled) |
| Handoff currency and threshold | `GET /v1/programmes/{programme_id}` | — | `ProgrammeView` |
| Capture destination picker, location names | `GET /v1/programmes/{programme_id}/receiving-locations` | — | `ReceivingLocationList` |
| Recycler receiving locations | `GET /v1/facilities/{facility_id}/receiving-locations` | — | `ReceivingLocationList` |
| Collector and recycler record lists, dashboards | `GET /v1/recovery-records` | `RecoveryRecordListRequest` query (`state`, `category`, dates, `sort`, `cursor`, `limit`) | `RecoveryRecordPage` |
| Record detail | `GET /v1/recovery-records/{record_id}` | — | `RecoveryRecord` (never embeds a QR credential) |
| New draft (capture) | `POST /v1/recovery-records` | multipart `record` = `RecoveryRecordDraftCreate`, `original_image`; `Idempotency-Key` | `RecoveryRecord` |
| Resume draft | `PATCH /v1/recovery-records/{record_id}` | `RecoveryRecordDraftUpdate`, `If-Match` | `RecoveryRecord` |
| Confirm or correct category | `POST /v1/recovery-records/{record_id}/category-confirmations` | `CategoryConfirmationRequest`, `If-Match` | `RecoveryRecord` |
| Further draft photograph | `POST /v1/recovery-records/{record_id}/evidence` | multipart `EvidenceUploadRequest` + `image` | `EvidenceMetadata` |
| Submit | `POST /v1/recovery-records/{record_id}/submissions` | — | `RecordSubmissionResponse` |
| Collector QR and manual code | `GET /v1/recovery-records/{record_id}/qr-credentials` | owner only | `QrCredentials` |
| Reissue QR and manual code | `POST /v1/recovery-records/{record_id}/qr-token-rotations` | owner only | `QrCredentials` |
| Timeline | `GET /v1/recovery-records/{record_id}/events` | — | `RecoveryRecordEventList` |
| Evidence list | `GET /v1/recovery-records/{record_id}/evidence` | — | `EvidenceMetadataList` (no storage paths) |
| Evidence image | `GET /v1/evidence/{evidence_id}/content` | `Accept: image/*` | bytes; `ProtectedEvidenceDelivery` headers, digest verified in the browser |
| Vision appraisal | `POST /v1/vision/appraise` | multipart `image`, `evidence_id` | `VisionAppraisalResponse` (bare) |
| Recycler QR or manual lookup | `POST /v1/handoff-lookups` | `HandoffLookupRequest` (`qr_text` or `manual_transfer_code`) | `HandoffLookupResponse` (preview only; `404` → not found) |
| Handoff photographs | `POST /v1/recovery-records/{record_id}/evidence` | `handoff_photo`, `weight_measurement` | `EvidenceMetadata` |
| Confirm handoff | `POST /v1/handoffs` | `HandoffRequest` with the presented credential | `HandoffResponse` (incl. `duplicate_scan`, `discrepancy`) |
| Processing queue | `GET /v1/processing-queue` | `cursor`, `limit` | `RecoveryRecordPage` |
| Load processing draft | `GET /v1/recovery-records/{record_id}/processing` | — | `ProcessingDetail` (`404` → none) |
| Save processing draft | `PUT /v1/recovery-records/{record_id}/processing` | `ProcessingDraftUpdate`, `If-Match` | `ProcessingDetail` |
| Material rows | `POST`, `PATCH`, `DELETE` `/v1/recovery-records/{record_id}/processing/material-entries[/{entry_id}]` | `MaterialEntry` / `MaterialEntryUpdate`, `If-Match` | `ProcessingDetail` |
| Completion photograph | `POST /v1/recovery-records/{record_id}/evidence` | `processing_completion` | `EvidenceMetadata` |
| Submit processing | `POST /v1/processing-submissions` | `ProcessingRequest` | `ProcessingResponse` |
| Review queue, assigned cases | `GET /v1/review-cases` | `ReviewQueueFilters` query (`status`, `flag_code`, dates, `facility_id`, `record_id`, `cursor`) | `ReviewCasePage` |
| Review detail | `GET /v1/review-cases` (`record_id`) then `GET /v1/review-cases/{case_id}` | — | `ReviewCaseDetail` |
| Review decision | `POST /v1/review-decisions` | `ProgrammeReviewRequest` built from the case detail | `ProgrammeReviewResponse` |

## Deliberately unavailable in HTTP mode (Phase 2)

Safety guidance, nearby-location search, reporting and exports, safety-content administration, model administration, programme-settings editing, offline synchronization and local-device data controls have no Phase 1 API. In HTTP mode their services fail immediately with a non-retryable `DEPENDENCY_UNAVAILABLE` ("not available in this release") and make no network call. Phase 1 screens that show these features (for example the safety-guide panel on the capture screen) display the unavailable state and continue working.
