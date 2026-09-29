# Frontend integration

How `apps/web`'s HTTP adapter (`src/services/http/http-services.ts`) uses this API. The screen-by-screen route list is in [docs/frontend/screen-endpoint-matrix.md](../../../docs/frontend/screen-endpoint-matrix.md). The operations the web consumes are listed in `apps/web/src/services/http/consumed-operations.json` and checked against the OpenAPI document by `tests/test_frontend_operations.py`.

## Transport rules

- **Base URL:** `NEXT_PUBLIC_API_BASE_URL` (for example `http://127.0.0.1:8000`). Application routes are under `/v1`. Use `127.0.0.1` for both web and API in local HTTP mode so browser cookies and the configured origin agree. The web CSP allows only its own origin and this configured API origin for connections.
- **Contracts:** every request and response body is a generated `@scraptrace/contracts` schema, published as an OpenAPI component of the same name. The API validates requests against these schemas and checks its own responses before sending them. The web parses every response with the same schema.
- **Envelopes:** success bodies are `{success: true, contract_version: "1.0.0", data, meta}`; failures are `ErrorEnvelope`. Only `POST /v1/vision/appraise` returns a bare `VisionAppraisalResponse`.
- **Authentication:** `POST /v1/auth/sessions` sets the HttpOnly, `SameSite=Lax` `scraptrace_session` cookie. The body (`SessionCreated`) carries no credential. Browsers send the cookie with `credentials: "include"`. Cookie-authenticated `POST/PUT/PATCH/DELETE` requests must come from an origin in `SCRAPTRACE_ALLOWED_ORIGINS`. Non-browser clients may send the cookie value as `Authorization: Bearer`.
- **CORS:** credentialed, explicit origins only. The API exposes `X-Request-ID`, `ETag`, `Idempotent-Replayed`, `Retry-After` and `X-Content-Digest` to the browser.
- **Correlation:** `X-Request-ID` (8–128 of `[A-Za-z0-9._:-]`) is echoed in `meta.correlation_id` and the response header.
- **Concurrency:** records carry `revision` (and `ETag`), and processing drafts carry `version`. Send it as `If-Match` on draft edits, category confirmations and processing-draft changes. A stale value returns `409 VERSION_CONFLICT`; a missing required `If-Match` returns `428`.
- **Idempotency:** draft creation takes an `Idempotency-Key` header. Handoff, processing and review commands carry `idempotency` in the body, with one operation name each (`IDEMPOTENT_OPERATIONS`). The web derives each key from the request digest, so an identical retry replays the first result.
- **Errors:** `401` → sign in again. `403` → the role may not act. `404` also covers resources outside the caller's scope. `422` has allow-listed `field_issues`. `429` has `Retry-After`. `503` is retryable.

## Handoff credentials (ADR-009)

- A record resource never contains a QR credential. The owning collector reads `QrCredentials` from `GET /v1/recovery-records/{id}/qr-credentials` and reissues both credentials with `POST …/qr-token-rotations`.
- A recycler looks up exactly one presented credential: `{qr_text}` (scanned symbol text), `{qr_payload}` or `{manual_transfer_code}` (canonical form from `normalizeManualTransferCode`). The response is a `HandoffPreview` and never contains either credential. Unknown, revoked, expired and malformed credentials all return `404`.
- `HandoffRequest` repeats the credential the recycler presented (`lookup_token` or `manual_transfer_code`) and is verified again. The client never derives or generates a credential.
- Failed manual codes are throttled per user (`SCRAPTRACE_MANUAL_CODE_FAILURE_LIMIT_*`) in addition to the lookup limit.

## Rules the frontend must respect

- `category_confirmation.confirmed_by` is the signed-in collector's `actor_reference` from `CurrentUser`.
- `source: "accepted_prediction"` needs a non-low-confidence `vision_result` suggesting the same category. A low-confidence result needs `manual_selection` or `human_correction`.
- Mixed scrap is a batch with an approximate weight.
- A draft's existing `vision_result` is never replaced; a further photograph is `additional_item_photo` evidence.
- `final_price.currency` is the programme currency (`ProgrammeView.currency`).
- A review decision uses the case's flags (or `MANUAL_REVIEW`) as `review_reason_codes` and the case's `status` and `record_business_state` as the previous states; the reason code must suit the decision.
- Timestamps are UTC with a `Z` suffix and must not lie in the future beyond `SCRAPTRACE_CLOCK_SKEW_SECONDS`.
