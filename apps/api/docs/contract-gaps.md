# Contract gaps and their disposition

`packages/contracts` is the source of truth. Backend Phase 1 found 23 places where the API needed a shape or rule that the contracts did not define. Integration Phase 1 resolved them in the contracts, with generated schemas that the API loads for request and response validation. No transport shape is now defined only in the API. The dispositions were triaged in [docs/integration/phase-1-reconciliation.md](../../../docs/integration/phase-1-reconciliation.md).

| # | Gap | Disposition | Resolution |
|---|---|---|---|
| 1 | No request contract for creating a draft | Closed | `RecoveryRecordDraftCreate` (+ `OriginalImageUpload`), multipart `record` + `original_image`. |
| 2 | No request contract for editing a draft | Closed | `RecoveryRecordDraftUpdate`; `revision` is the `If-Match`/`ETag` concurrency token. |
| 3 | `DestinationSelection` let the client assert facility type and verification | Closed | Clients send `destination_location_id` only; the server fills `DestinationSelection` from the directory. `GET /v1/programmes/{id}/receiving-locations` provides the choices. |
| 4 | No submission result contract | Closed | `RecordSubmissionResponse` (`submitted` / `duplicate_image`, typed flag codes). |
| 5 | No list or page contract | Closed | `pageSchema`, `RecoveryRecordPage`, `ReviewCasePage`, `RecoveryRecordListRequest`, `ReviewQueueFilters`; per-record evidence and timelines are bounded arrays (`EvidenceMetadataList`, `RecoveryRecordEventList`). |
| 6 | No evidence upload contract | Closed | `EvidenceUploadRequest` with `EVIDENCE_UPLOAD_TYPES`. |
| 7 | Server-generated evidence has no device instance | Closed | `SYSTEM_DEVICE_INSTANCE_ID` with `capture_source: "system_generated"`. |
| 8 | Provenance cannot say metadata was stripped | Closed | `Evidence.storage_transform` (`reencoded_without_metadata`). |
| 9 | Flag and reason codes lived only in the web app | Closed | `REVIEW_FLAG_CODES`, `REVIEW_REASON_CODES`, `REASON_CODES_BY_DECISION`, `MANUAL_REVIEW_REASON` in the contracts; parity-tested against Python. |
| 10 | Multi-role and delegation policy undecided | Deferred to Phase 2 | An identity/product decision (ADR-006 follow-up). Phase 1 demo accounts hold one role, and sign-in refuses multi-role accounts. |
| 11 | No authentication/session contract | Closed | `SignInRequest`, `SessionCreated` (the credential is only in the HttpOnly cookie, never in the body), `CurrentUser`, `DemoAccountList`. |
| 12 | `RecoveryRecord.sync` is client-oriented | Closed (documentation) | A server response describes the canonical copy: `sync_state: "synchronized"`, `local_revision = server_revision = revision`. |
| 13 | No QR lookup contract; the web port exposed the full record | Closed | `HandoffLookupRequest`, `HandoffPreview`, `HandoffLookupResponse`. |
| 14 | A typed code had no credential, so lookup returned the QR token | Closed (security) | [ADR-009](../../../docs/decisions/ADR-009-handoff-credentials.md): separate manual transfer code, digest-only storage, shared expiry/rotation, and `HandoffRequest` carries exactly one presented credential. No endpoint exchanges one credential for the other. |
| 15 | `rejected` handoff had no reason codes | Closed | `HandoffRejectionReason` (`RECORD_NOT_AWAITING_HANDOFF`). Invalid credentials are `RESOURCE_NOT_FOUND` errors, not outcomes. |
| 16 | Handoff notes had no field | Closed | `HandoffRequest.notes` (≤ 1,000), stored in the recycler-receipt evidence document. |
| 17 | Token issuance, expiry and rotation undefined | Closed | `QrCredentials` with `status`, `issued_at`, `activated_at`, `expires_at`, `used_at`; `GET …/qr-credentials` and `POST …/qr-token-rotations`. |
| 18 | No processing-draft contract | Closed | `ProcessingDraftUpdate`, `MaterialEntry`, `MaterialEntryUpdate`, `ProcessingDetail`; drafts are server-held and survive refresh. |
| 19 | Processing notes (1,000) vs result (500) mismatch | Closed | `ProcessingRequest.notes` is required and `ProcessingInformation.result` allows 1,000 characters; the result is stored unabridged (migration 0002). |
| 20 | Processing flag rules not in the contracts | Closed | The codes are shared; the rules stay server-side (they need persisted weights and evidence). |
| 21 | No review case or queue contract | Closed | `ReviewCaseSummary`, `ReviewCaseDetail`, `ReviewDecisionView`, `ReviewQueueFilters`; filtering is server-side. |
| 22 | Review request semantics and operation name ambiguous | Closed | `ProgrammeReviewRequest` documents the optimistic-concurrency and timestamp rules and enforces reason codes per decision; `IDEMPOTENT_OPERATIONS.recordReviewDecision = "record_review_decision"` is the only accepted operation. |
| 23 | No reviewer-initiated flag contract | Rejected for Phase 1 | No Phase 1 screen or requirement needs manual flagging; server rules raise every flag. Adding it would widen audit policy. Revisit with product owners in Phase 2. |

Related consistency corrections made at the same time:

- Absent optional fields are omitted, never `null`, including actor references and review-case fields.
- `RecoveryRecordEvent` gained persisted record facts (`draft_created`, `evidence_added`, `appraisal_recorded`, `category_confirmed`, `category_corrected`, `qr_issued`, `qr_rotated`, `review_opened`) with `evidence_id` and `flag_codes`.
- Evidence responses no longer expose storage object keys (`EvidenceMetadata`).
