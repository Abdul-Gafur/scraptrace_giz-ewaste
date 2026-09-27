# Requirement-to-endpoint matrix

Backend Phase 1 traceability from the [functional requirements](../../../docs/product/functional-requirements.md), [ADRs](../../../docs/decisions/README.md) and `packages/contracts` to the API. All routes are under `/v1` unless noted. "M" is the milestone that delivers the row.

| Requirement | Endpoint(s) | Contract | M |
|---|---|---|---|
| Persistence foundation; FR-REV-008 append-only history | Schema, migrations, triggers ([database](database.md)) | All persisted types | 1 |
| Deployment health | `GET /health/live`, `GET /health/ready` (model), `GET /health/database` | — | 1 |
| FR-ACC-001 demonstration sign-in for six roles | `POST /auth/sessions`, `GET /auth/me`, `DELETE /auth/sessions/current`, `GET /auth/demo-accounts` (dev only) | `UserRole`, `Permission`, `ActorReference` | 2 |
| FR-ACC-002 server-side role enforcement, 403 + security event | `require_permission`, `require_roles`, `Authorizer` on every protected route | `isPermissionAllowed` (parity-tested) | 2 |
| ADR-006 programme and facility scope | `GET /programmes/{programme_id}`, `GET /facilities/{facility_id}/receiving-locations` | `AuthorizationContext` | 2 |
| Vision appraisal behind authentication | `POST /vision/appraise` (existing; now authenticated by default) | `VisionAppraisalResponse` | 2 |
| FR-REC-001/002 item or batch draft with owner, evidence, category, count/weight, condition, time, area, estimate, destination | `POST /recovery-records` (multipart, `Idempotency-Key`), `PATCH /recovery-records/{id}` (`If-Match`) | `RecoveryRecord` fields (gap 1–3) | 3 |
| FR-VIS-005/006/007 confirm or correct the category; keep the original prediction | `POST /recovery-records/{id}/category-confirmations`; `vision_result` associated at creation or once on a draft | `CategoryConfirmation` (= `VisionHumanCorrection`), `VisionResult` | 3 |
| FR-REC-005 server-side lifecycle with audited transitions | `POST /recovery-records/{id}/submissions` (`submit_record` → `publish_for_handoff`) | `transitionRecoveryRecord` (parity-tested), `RecoveryRecordEvent` | 3 |
| FR-REC-004 reopen and present a record | `GET /recovery-records/{id}`, `GET /recovery-records` (scoped, cursor-paginated, filtered) | `RecoveryRecord` | 3 |
| FR-REV-008 timeline from persisted events | `GET /recovery-records/{id}/events` | `RecoveryRecordEvent` | 3 |
| FR-REC-007 image digest and exact-reuse flag | Submission raises `DUPLICATE_EVIDENCE_DIGEST` on a review case | `Evidence.content_digest`, `ReviewInformation` | 3 |
| Evidence storage, provenance and controlled retrieval | `POST/GET /recovery-records/{id}/evidence`, `GET /evidence/{id}`, `GET /evidence/{id}/content` | `Evidence`, `Provenance` (gap 6–8) | 3 |
| FR-OFF-005 idempotent creation; FR-OFF-006 version conflicts | `Idempotency-Key`, `If-Match`/`ETag`, `VERSION_CONFLICT` | `IdempotencyMetadata` | 3 |
| FR-REC-003 QR with an opaque token only; FR-REC-004 present after reopening | Token issued inert with the draft, activated on publication, returned in `RecoveryRecord.qr_payload`; `POST /recovery-records/{id}/qr-token-rotations` | `QrPayload` (gap 17) | 4 |
| FR-HND-001/002 retrieve intake by QR or short code; non-sensitive preview only | `POST /handoff-lookups` | `QrPayload`, `HandoffPreview` (gap 13–14) | 4 |
| FR-HND-003/004/005 confirm category, condition, weight, price; photo and scale evidence; location, recycler, server and client time | `POST /handoffs` | `HandoffRequest` → `HandoffResponse`, `HandoffInformation` | 4 |
| FR-HND-006 discrepancy flags, not blocking | Weight, category and duplicate-evidence flags open the review case atomically | `HandoffResponse.discrepancy`, `ReviewInformation` | 4 |
| BR-007 / FR-OFF-005 one key, one logical mutation; duplicate scans | Scoped idempotency replay; `duplicate_scan` | `IdempotencyMetadata` | 4 |
