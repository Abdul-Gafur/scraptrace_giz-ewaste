# Security controls

This document lists the controls the API implements and where each one lives. The policy sources are [access control](../../../docs/security/access-control.md), [secrets management](../../../docs/security/secrets-management.md), [ADR-006](../../../docs/decisions/ADR-006-roles-permissions.md) and [error handling and logging](../../../docs/engineering/error-handling-and-logging.md).

## Authentication

No ADR selects a production identity provider. Phase 1 therefore ships a replaceable local provider (`app/services/authentication.py`). Only `sign_in` and `resolve` would change to adopt an external provider; the `Actor` they produce, and every rule that consumes it, stay the same.

| Control | Implementation |
|---|---|
| Password storage | Argon2id (`argon2-cffi`): time cost 3, 64 MiB, parallelism 2 by default. Hashes are upgraded on sign-in when parameters change. |
| Uniform failure | Unknown user, wrong password, suspended account and unusable role all return `401 AUTHENTICATION_REQUIRED` with one message. An unknown username is verified against a decoy hash, so timing stays flat. |
| Rate limiting | Sliding window per account and per client address (default 5 failures per 15 minutes), `429 RATE_LIMIT_REACHED` with `Retry-After`. In-process state; see limitations. |
| Tokens | HS256 JWTs with a pinned algorithm, issuer, audience, `typ`, `jti`, `iat`/`nbf`/`exp`, and a default 30-minute lifetime. Claims contain only the user ID, role and session version. |
| Revocation | Sign-out increments `users.session_version`, which invalidates every earlier token. Suspending an account or changing its role invalidates its tokens immediately. |
| Browser sessions | The same token is set as an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie, `Secure` in production. A cookie-authenticated `POST/PUT/PATCH/DELETE` must carry an allowed `Origin` (or `Referer`) header, otherwise `403`. Sign-in from a foreign origin is refused (login CSRF). |
| API clients | `Authorization: Bearer <token>`, which takes precedence over the cookie. The sign-in response body includes the token for non-browser clients; browsers must not persist it. |
| Multiple roles | One distinct role per account until ADR-006's multi-role policy is decided. An account with several roles cannot sign in. |
| Demo discovery | `GET /v1/auth/demo-accounts` exists only when `SCRAPTRACE_ENABLE_DEMO_ACCOUNT_DISCOVERY=true` in development or test (404 otherwise; production refuses the setting). It returns usernames and roles only. |

## Authorisation

Every protected route authenticates, then authorises in the service layer against persisted facts (`app/services/authorization.py`):

- `is_permission_allowed` is a port of the contract helper. `tests/test_authorization.py` evaluates the TypeScript original on all 3,648 role × permission × context combinations and requires identical answers.
- Context comes from the database, never from the request:
  - **ownership**: the record's collector is the actor;
  - **programme**: the record's programme is one of the actor's assignments;
  - **facility**: the record's receiving location, or its destination before handoff, is one of the actor's facility locations. The programme must match too. Handoff alone admits records with no selected destination, because the QR token proves presentation;
  - **review**: the actor is a reviewer and the case is unassigned or assigned to them.
- **Role-level refusals** (the role never holds the permission) return `403 PERMISSION_DENIED`. **Object-level refusals** return `404 RESOURCE_NOT_FOUND`, so the existence of another collector's record or another facility's data is never confirmed. Both write an `authorization.denied` audit event in a separate transaction.
- **Separation of duties:** safety-content and data/ML administrators hold no record, handoff or review permission. Managers cannot decide reviews. Recyclers cannot review. The internal `system` actor is not a user role: no account can sign in as it, and a token claiming it is rejected.
- **Field shaping:** consented coordinates are returned only to the owning collector and to roles holding `personal_data:view`. Reviewer notes are returned only to review roles.

Reusable FastAPI dependencies (`app/api/security.py`): `get_current_actor` (authenticated user), `require_roles`, `require_permission`, `require_programme_scope`, `require_facility_scope`. Record ownership and record facility/review scope are enforced by `Authorizer.require` inside the service transaction that loads the record.

## Vision policy

`POST /v1/vision/appraise` requires any authenticated role by default. `SCRAPTRACE_VISION_REQUIRES_AUTHENTICATION=false` restores the walking skeleton's open behaviour for local classifier work only, and production refuses that setting. Appraisal grants no record access and stores nothing. The health routes `/health/live`, `/health/ready` and `/health/database` are public by policy and return status only.

## Evidence

- **Separate from vision:** `POST /v1/vision/appraise` still stores nothing. Evidence is a distinct, authorised upload.
- **Validation:** content type is checked, and so is the decoded signature (JPEG, PNG, WebP only). Uploads are bounded by `SCRAPTRACE_MAXIMUM_UPLOAD_BYTES`, width, height and total pixels. Decompression bombs and truncated or corrupt files are rejected. Uploaded filenames are ignored.
- **Metadata removal:** images are decoded, EXIF orientation is applied, and they are re-encoded in their original format without EXIF (including GPS), text chunks or colour-profile metadata. `metadata_stripped` records this.
- **Integrity:** SHA-256 of the stored bytes is recorded as `content_digest` and re-verified on every read; a mismatch returns `409 INTEGRITY_FAILURE`. A digest detects change; it does not prove the photograph is truthful.
- **Storage:** `EvidenceStorage` is the replaceable boundary (local filesystem now, S3-compatible later). Keys are generated (`evidence/<record>/<evidence>`), must match a strict pattern, and must resolve inside the storage root, which prevents path traversal. Objects are written atomically with `0600` permissions and are immutable. If the metadata transaction fails, the stored object is deleted.
- **Access:** content is served only through `GET /v1/evidence/{id}/content` to callers who may view the record, with `Cache-Control: private, no-store`, `nosniff` and a sandboxing CSP. Reviewer-decision evidence is limited to review roles. Every content read writes an `evidence.content-accessed` audit event.
- **Upload policy:** collectors add photographs only to their own drafts. Recyclers add handoff and weight photographs to records awaiting handoff, processing photographs to records they received, and corrections when a reviewer requests them. Evidence types are restricted per role and state, and capture sources per role.

## Transport and headers

- CORS allows only the configured origins, with credentials. A wildcard is rejected in every environment.
- Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `Cross-Origin-Resource-Policy: same-site`. `/v1/*` responses also carry `Cache-Control: no-store`.
- Request IDs are validated against a strict pattern, or generated, and returned in `X-Request-ID`.

## Logging and audit

- Structured request logs contain the request ID, route, status, duration, actor role and error code. They never contain headers, tokens, passwords, bodies, usernames, coordinates or image data. `tests/test_auth.py` asserts that tokens and passwords do not reach captured logs.
- Audit events (`audit_events`, append-only by trigger) record sign-in success and failure, sign-out, authorisation denials and business mutations. Details are allow-listed codes, never request content.

## Secrets and environment validation

- `SCRAPTRACE_DATABASE_URL`, `SCRAPTRACE_AUTH_TOKEN_SECRET` and `SCRAPTRACE_QR_TOKEN_SECRET` are required at startup; the two secrets must differ. A missing variable stops the process with a message naming it; values are never echoed.
- Secrets must be at least 32 characters and are rejected when they look like placeholders.
- Production additionally refuses non-`Secure` cookies, demo discovery, unauthenticated vision and SQLite.
- No secret is committed. `.env.example` holds placeholders only, and demo passwords come from `SCRAPTRACE_SEED_DEMO_PASSWORD` at seed time.
