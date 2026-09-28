# Known limitations

Genuine limitations of Backend Phase 1 at the time of writing. Each one names what would remove it.

| Area | Limitation | To resolve |
|---|---|---|
| Identity | Local username/password provider with shared demo accounts. No account recovery, MFA, self-registration or role administration API. One role per account. | Identity ADR; external provider behind `AuthenticationService`; ADR-006 multi-role policy. |
| Sessions | Revocation works per user (session version), not per device. Tokens are not refreshable, so users sign in again after 30 minutes. | Session table or refresh tokens if the product needs per-device sign-out or longer sessions. |
| Rate limiting | In-process memory: limits are per API instance and reset on restart. | Shared store (for example Redis) before running more than one instance. |
| Evidence storage | Local filesystem only. The S3-compatible adapter is specified by the `EvidenceStorage` interface but not implemented. There is no malware scanning or quarantine workflow (`validation_status` is always `accepted`). | S3 adapter with server-side encryption and signed short-lived reads; scanning pipeline that sets `pending`/`quarantined`. |
| Evidence access | Recyclers can open a record's photographs only once the record is destined for or received at their facility. A record with no selected destination shows only the lookup preview before handoff. | Product decision on pre-acceptance comparison evidence. |
| QR tokens | Rotating `SCRAPTRACE_QR_TOKEN_SECRET` invalidates every issued QR. There is no key-versioning. | Add a key identifier to token rows for staged rotation. |
| Offline sync | `POST /v1/sync` (`SyncBatchRequest`) is not implemented. Idempotent creation, client-generated IDs, `If-Match` and replays make the individual endpoints safe for a future sync layer. | Implement the sync batch contract (out of Phase 1 scope). |
| Amendments | Post-submission and post-terminal amendments (FR-REC-006, ADR-003 follow-up) are not implemented; submitted records are immutable apart from lifecycle events. | Reviewed-amendment workflow and event. |
| Review assignment | Cases are unassigned until a reviewer decides; the first deciding reviewer is recorded as assignee. No assignment API. | Assignment endpoints if programmes need them. |
| Reporting | No reporting or export endpoints (`ReportingSummary`). Records reach `approved_and_completed` so a reporting layer can count them. | Reporting milestone. |
| Retention | Only idempotency outcomes have an expiry and purge command. Record, evidence and audit retention need the approved policies in `docs/data/data-retention.md`. | Retention jobs once policies are approved. |
| Scale | Queue flag filtering uses JSONB containment on PostgreSQL without a GIN index; list endpoints load the full record graph per page (bounded at 100). | Add indexes and projections when volumes justify them. |
| Dependencies | `npm run api:audit` reports advisories in runtime packages pinned before this phase: Pillow 11.3.0, Starlette 0.46.2 (via FastAPI 0.115.12), anyio 4.9.0, python-multipart 0.0.20 and torch 2.7.1. There are also advisories in development tooling. None of the packages added in Phase 1 (SQLAlchemy, Alembic, asyncpg, aiosqlite, argon2-cffi, PyJWT) is affected. Upgrading FastAPI/Starlette, Pillow and torch changes the vision runtime and needs the vision owner's review. | Coordinated dependency upgrade with vision regression and real-checkpoint smoke tests. |
