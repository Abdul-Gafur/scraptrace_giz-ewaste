# Frontend screen-to-endpoint matrix

The HTTP adapter is selected with `NEXT_PUBLIC_API_MODE=http`; the browser-backed implementation remains available with `NEXT_PUBLIC_API_MODE=mock`. All HTTP calls use secure-cookie credentials, a request ID and runtime response validation. Mutation routes also receive an idempotency key.

The endpoint paths below are the frontend integration contract for Phase 1. As of 2026-09-28, only `POST /v1/vision/appraise` exists in `apps/api`; every other row is implemented in the frontend adapter but remains a backend integration dependency.

| Screen or flow                  | Method and endpoint                                    | Request                                                    | Validated response                                               |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Sign in                         | `POST /v1/auth/sign-in`                                | JSON credentials                                           | Frontend session transport schema                                |
| Session restoration             | `GET /v1/auth/session`                                 | Secure cookie                                              | Frontend session transport schema                                |
| Sign out                        | `POST /v1/auth/sign-out`                               | Secure cookie                                              | Signed-out acknowledgement                                       |
| Collector dashboard and records | `GET /v1/recovery-records?scope=own`                   | Query scope                                                | `RecoveryRecordSchema[]`                                         |
| Operational record lists        | `GET /v1/recovery-records?scope=operational`           | Query scope                                                | `RecoveryRecordSchema[]`                                         |
| Record detail                   | `GET /v1/recovery-records/:recordId`                   | Path identifier                                            | `RecoveryRecordSchema`                                           |
| New collector draft             | `POST /v1/recovery-records`                            | Multipart metadata and image                               | `RecoveryRecordSchema`                                           |
| Resume collector draft          | `PATCH /v1/recovery-records/:recordId/draft`           | Multipart metadata, optional replacement image, `If-Match` | `RecoveryRecordSchema`                                           |
| Contract-shaped draft update    | `PUT /v1/recovery-records/:recordId/draft`             | JSON record, `If-Match`                                    | `RecoveryRecordSchema`                                           |
| Submit collector record         | `POST /v1/recovery-records/:recordId/submissions`      | Empty JSON                                                 | Frontend submit outcome schema containing `RecoveryRecordSchema` |
| Vision appraisal                | `POST /v1/vision/appraise`                             | Multipart image and evidence identifier                    | `VisionAppraisalResponseSchema`                                  |
| Record evidence list            | `GET /v1/recovery-records/:recordId/evidence`          | Authorized request                                         | `EvidenceSchema[]`                                               |
| Protected evidence bytes        | `GET /v1/evidence/:evidenceId/content`                 | Authorized request, `Accept: image/*`                      | Image bytes                                                      |
| Record history                  | `GET /v1/recovery-records/:recordId/events`            | Authorized request                                         | `RecoveryRecordEventSchema[]`                                    |
| Recycler QR/manual lookup       | `POST /v1/handoff-lookups`                             | JSON transfer code or encoded QR payload                   | Frontend handoff lookup outcome schema                           |
| Recycler handoff                | `POST /v1/recovery-records/:recordId/handoffs`         | Multipart handoff metadata and two evidence images         | `HandoffResponseSchema`                                          |
| Contract-shaped handoff         | `POST /v1/recovery-records/:recordId/handoffs`         | `HandoffRequestSchema` JSON                                | `HandoffResponseSchema`                                          |
| Recycler processing             | `POST /v1/recovery-records/:recordId/processing`       | Multipart processing metadata and completion evidence      | `ProcessingResponseSchema`                                       |
| Contract-shaped processing      | `POST /v1/recovery-records/:recordId/processing`       | `ProcessingRequestSchema` JSON                             | `ProcessingResponseSchema`                                       |
| Reviewer queue                  | `GET /v1/reviews?status=open`                          | Authorized request                                         | `RecoveryRecordSchema[]`                                         |
| Review decision                 | `POST /v1/recovery-records/:recordId/review-decisions` | JSON decision, reason, note and optional correction        | `ProgrammeReviewResponseSchema`                                  |
| Contract-shaped review decision | `POST /v1/recovery-records/:recordId/review-decisions` | `ProgrammeReviewRequestSchema` JSON                        | `ProgrammeReviewResponseSchema`                                  |

## Integration gaps for the integration branch

- The API currently has no authentication, recovery-record, evidence, event, handoff, processing or review routes. Those backend routes, persistence, authorization and secure-cookie session behavior must be implemented before HTTP-mode end-to-end verification is possible.
- Shared contracts do not define authentication payloads, record create/update/submit payloads, list or pagination envelopes, handoff lookup outcomes, protected evidence delivery, or the multipart orchestration requests used by the screens. The frontend validates these transport shapes locally without changing `packages/contracts`.
- `RecoveryRecordEventSchema` cannot represent draft creation, evidence addition, appraisal completion, category confirmation/correction or QR issuance. The timeline therefore renders only persisted lifecycle events defined by the contract and never synthesizes the missing events.
- `VisionResultSchema` includes `inferred_at` but no inference-duration field. The UI displays the recorded inference timestamp, not a fabricated duration.
- `QrPayloadSchema` has no expiry, revoked or availability fields. Eligibility is inferred from the record lifecycle; token expiry/revocation cannot be displayed until the backend and shared contract expose it.
- The shared contracts do not define a persisted processing-draft resource. Material rows are editable before final submit, but a processing draft cannot survive navigation or refresh in HTTP mode.
- Review contracts do not define queue pagination, search or filter parameters/envelopes. The existing queue provides pagination, search, status, reason, date and facility filters over the authorized result set in the browser. Server-side filtering remains a backend contract gap.
- The Fetch API provides no portable upload-progress events. The UI exposes pending/loading state, prevents repeated submission and maps `413`/`415` errors, but cannot show byte-level upload progress without an agreed upload transport.
- Programme currency is carried from the configured programme setting into handoff metadata. The API must remain authoritative for allowed currency and receiving-location assignment.

These are integration dependencies, not claims that offline synchronization, token revocation, server-side queue pagination or upload-byte progress already work.
