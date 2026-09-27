# Frontend integration

How `apps/web`'s HTTP service adapter (`src/services/http/http-services.ts`) maps onto this API. The frontend is not changed in this phase.

## Transport rules

- **Base URL:** `NEXT_PUBLIC_API_BASE_URL` (for example `http://localhost:8000`). All application routes are under `/v1`.
- **Envelopes:** success bodies are `{success: true, contract_version: "1.0.0", data, meta: {correlation_id, timestamp}}` (`serviceSuccessSchema`). Failures are `ErrorEnvelopeSchema`, so `HttpClient.request` + `normalizeServiceError` work unchanged; parse `payload.data` for successes. The existing vision endpoint still returns the bare `VisionAppraisalResponse`.
- **Authentication:** the browser keeps the HttpOnly `scraptrace_session` cookie set by sign-in. `HttpClient` already sends `credentials: "include"`. Do not store the `access_token` from the sign-in body in browser storage. Cookie-authenticated `POST/PUT/PATCH/DELETE` requests must come from an origin listed in `SCRAPTRACE_ALLOWED_ORIGINS`; browsers add `Origin` automatically.
- **Correlation:** send `X-Request-ID` (8–128 of `[A-Za-z0-9._:-]`) to correlate; it is echoed in `meta.correlation_id` and the `X-Request-ID` header.
- **Concurrency:** record responses carry `ETag: "<revision>"`. Send it back as `If-Match` on draft edits and category confirmations. `409 VERSION_CONFLICT` means refresh and show `Action required` (FR-OFF-006).
- **Idempotency:** draft creation needs an `Idempotency-Key` header (16–128 of `[A-Za-z0-9._:-]`) that stays stable across retries of one draft; `idempotencyKeyFor("create_record", recordId, actorId)` fits. Contract commands (handoff, processing, review) carry `idempotency` inside the body as the contracts define. A replay returns the first result, with `Idempotent-Replayed: true` where there is no `replayed` field.
- **Errors:** `401` → sign in again (`/session-expired`). `403` → access denied. `404` also covers "exists but not yours". `422` has `field_issues[{field, reason}]`. `429` has `Retry-After`.

## Service-port mapping

| Web port method | HTTP | Notes |
|---|---|---|
| `authentication.getSession()` | `GET /v1/auth/me` | Map `CurrentUser` → `Session` (`actorId = user_id`, `role`, `preferredLanguage`, `displayLabel = display_name`, `developmentOnly = false`). `401` → `null`. |
| `authentication.signOut()` | `DELETE /v1/auth/sessions/current` | `204`; the cookie is cleared and earlier tokens are revoked. |
| Sign-in form | `POST /v1/auth/sessions` `{username, password}` | `201`; sets the cookie. `GET /v1/auth/demo-accounts` (development only) lists demo usernames and roles for the role picker. |
| `vision.appraise()` | `POST /v1/vision/appraise` (unchanged) | Now requires the session cookie. |
| `recoveryRecords.createDraft(input)` | `POST /v1/recovery-records` multipart | `record` = JSON built from `CaptureInput`: `category`, `condition`, `item_count`, `approximate_weight`, `captured_at`, `capture_location`, `approximate_area {label, administrative_area, country_code}`, `vision_result`, `category_confirmation {confirmed_category, confirmed_by: session actor reference, confirmed_at, source, correction_reason}`, `estimated_price`, `safety_guide`, `destination_location_id`, `device_instance_id`, `original_image {captured_at, capture_source, connectivity, application_version}`, optional `record_id` and `original_image.evidence_id` for offline-created IDs. `original_image` = the `Blob`. |
| `recoveryRecords.saveDraft(record)` | `PATCH /v1/recovery-records/{id}` + `If-Match` | Send only changed fields. |
| `recoveryRecords.submit(id)` | `POST /v1/recovery-records/{id}/submissions` | `data = {outcome: "submitted" \| "duplicate_image", record, replayed, flag_codes}`, which matches `SubmitOutcome`. |
| `recoveryRecords.getById(id)` | `GET /v1/recovery-records/{id}` | `404` → `null`. |
| `recoveryRecords.listOwn()` / `listOperational()` | `GET /v1/recovery-records?limit=100` | Scoped server-side by role; follow `pagination.next_cursor`. Filters: `state`, `category`, `captured_from`, `captured_to`, `sort`. |
| `recoveryRecords.listEvents(id)` | `GET /v1/recovery-records/{id}/events` | `RecoveryRecordEvent[]`. |
| `recoveryRecords.listEvidence(id)` | `GET /v1/recovery-records/{id}/evidence` | `Evidence[]`. |
| `recoveryRecords.getEvidenceImage(evidenceId)` | `GET /v1/evidence/{id}/content` | Fetch with credentials and use `URL.createObjectURL(blob)`; the response is `no-store`. |
| Category correction (capture screen) | `POST /v1/recovery-records/{id}/category-confirmations` + `If-Match` | Body = `CategoryConfirmation` (`VisionHumanCorrectionSchema`). |
| Extra photographs | `POST /v1/recovery-records/{id}/evidence` multipart | `image` + `evidence_type`, `captured_at`, `capture_source`, `device_instance_id`, `connectivity`, `application_version`, optional `evidence_id`. |
| `recoveryRecords.lookupForHandoff(text)` | `POST /v1/handoff-lookups` | Send `{qr_text}` for scanned text or `{transfer_code}` for a typed code. `200` outcomes `ready` / `not_ready` / `already_received` / `other_facility`; `404` → `not_found`; `422 UNSUPPORTED_CONTRACT_VERSION` → `unsupported_contract_version`. `record` is a `HandoffPreview`, not a full `RecoveryRecord`. Keep `lookup_token` for the handoff request. |
| `handoffs.record(request)` | `POST /v1/handoffs` with the contract `HandoffRequest` | `201` created (`accepted` / `discrepancy`), `200` for `duplicate_scan`, `rejected` and replays. `idempotency.scope` must be `{actor_id: session actor, operation: "record_handoff", resource_id: record id}`. |
| `handoffs.confirmReceipt(input)` | Upload `handoff_photo` and `weight_measurement` via `POST /v1/recovery-records/{id}/evidence` (recycler), then `POST /v1/handoffs` with their IDs | Do not send QR-scan or receipt evidence; the server generates both. `final_price.currency` must be the programme currency (`GET /v1/programmes/{id}`). Receiving locations come from `GET /v1/facilities/{facility_id}/receiving-locations` or `receiving_location_ids` in `/auth/me`. |
| Reissue a QR (collector) | `POST /v1/recovery-records/{id}/qr-token-rotations` | Returns the new `QrPayload`; the old QR stops resolving. |

## Rules the frontend must respect

- `category_confirmation.confirmed_by.actor_id` must be the signed-in collector.
- `source: "accepted_prediction"` requires a non-low-confidence `vision_result` whose `suggested_category` equals the category. Low-confidence results need `manual_selection` or `human_correction`.
- Mixed scrap is a batch with an approximate weight.
- A draft's existing `vision_result` cannot be replaced.
- Timestamps must be contract UTC strings and not in the future beyond `SCRAPTRACE_CLOCK_SKEW_SECONDS`.
