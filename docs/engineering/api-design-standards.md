# API design standards

## Status and scope

These standards are proposed for ScrapTrace-owned HTTP APIs if the proposed OpenAPI approach is accepted. They document conventions only; no API currently exists. Internal services may use another accepted protocol, but equivalent contract, validation, error, idempotency, security, and compatibility rules apply.

## Contract first

- `packages/contracts` owns shared interface definitions; the source-of-truth and generation workflow are to be decided.
- Define request, response, error, authentication, authorisation, pagination, and examples before or with implementation.
- The OpenAPI document, implementation, consumer types, contract tests, and examples change together.
- Contracts distinguish user assertions, predictions, estimates, measurements, evidence, and review decisions.
- Provider-specific schemas remain inside adapters and do not leak into ScrapTrace public contracts.

## Versioning and resources

- Prefix public routes with a major version such as `/v1`.
- Use plural lower-case kebab-case nouns: `/v1/recovery-records`, `/v1/participating-locations`.
- Use opaque stable IDs in paths; never expose sequential identifiers when that increases enumeration risk without compensating control.
- Model actions as resource creation or state transition where clear, for example `POST /v1/recovery-records/{id}/handover-confirmations`.
- Avoid verbs in routes unless the operation cannot honestly be represented as a resource and the exception is documented.
- Nested routes express ownership only when it materially scopes the resource; avoid deep nesting.

## Request and response conventions

- Use JSON for structured data and a documented multipart or signed-upload flow for files.
- Validate content type, schema, bounds, formats, enums, units, unknown fields policy, and cross-field invariants.
- Use consistent field naming; proposed JSON convention is snake_case to align OpenAPI/Python, but final convention is **to be decided** before contracts are accepted.
- Return only fields authorised for the caller. Absence, `null`, and empty collections have documented distinct meanings.
- Include units and currencies explicitly; never infer weight units or currency from an unlabeled number.
- Represent confidence with a defined bounded type and include model version.
- Timestamps use RFC 3339 UTC (`2026-09-18T09:15:04Z`). Local display belongs to clients; original timezone/clock metadata is separate where needed.

## Authentication and authorisation

Authentication proves identity/session. Authorisation checks the authenticated actor's role, programme, resource relationship, record state, and requested action every time. Do not rely on hidden UI controls. Apply object-level checks to records, images, exports, and signed storage operations. Denials must avoid confirming the existence of inaccessible data when that would leak information.

## HTTP status codes

| Status | Use |
|---|---|
| `200 OK` | Successful retrieval or idempotent update with a response |
| `201 Created` | New resource; include a stable reference |
| `202 Accepted` | Asynchronous work accepted but not complete; expose status resource |
| `204 No Content` | Successful operation with intentionally no body |
| `400 Bad Request` | Malformed request not attributable to field semantics |
| `401 Unauthorized` | Authentication missing/invalid |
| `403 Forbidden` | Authenticated but not authorised, when safe to reveal |
| `404 Not Found` | Missing or deliberately concealed inaccessible resource |
| `409 Conflict` | Current state/version/idempotency conflict |
| `413 Content Too Large` | Upload/request exceeds accepted limit |
| `415 Unsupported Media Type` | Unsupported content type |
| `422 Unprocessable Content` | Well-formed but semantically invalid fields |
| `429 Too Many Requests` | Rate limit reached; include safe retry guidance |
| `500 Internal Server Error` | Unexpected owned failure with generic client detail |
| `502/503/504` | Dependency invalid/unavailable/timeout when exposing distinction is useful |

Do not encode success in an error status or always return `200` with an error body.

## Standard envelopes

Proposed success:

```json
{
  "data": {
    "id": "rr_01K...",
    "status": "submitted",
    "created_at": "2026-09-18T09:15:04Z"
  },
  "meta": { "correlation_id": "8a2d-example" }
}
```

Proposed error:

```json
{
  "error": {
    "code": "RECOVERY_RECORD_INVALID_STATE",
    "message": "The record cannot be confirmed in its current state.",
    "details": [
      { "field": "status", "reason": "must_be_submitted" }
    ],
    "retryable": false
  },
  "meta": { "correlation_id": "8a2d-example" }
}
```

Error codes are stable and documented. Messages may be localised or changed for clarity and are not machine control flow. `details` is allow-listed and contains no stack, query, secret, provider payload, or inaccessible record information.

## Pagination, filtering, and sorting

- Every potentially unbounded collection is paginated with a maximum page size.
- Cursor pagination is preferred for frequently changing ordered collections; offset may be used for bounded administrative data with documented trade-offs.
- Responses include continuation information without exposing sensitive internals.
- Filters and sort fields are allow-listed, validated, documented, indexed where justified, and constrained by authorisation.
- Sorting has a stable tie-breaker. Defaults are documented.
- Do not return approximate/partial totals as exact without labelling them.

## Idempotency and concurrency

- Require an idempotency key for retryable record creation, handover confirmation, evidence attachment completion, review decisions, and future external financial instructions.
- Scope the key to actor/programme/operation as appropriate, validate payload consistency, persist the outcome for a defined lifetime, and return the original result on replay.
- A reused key with a materially different request returns a conflict.
- Use entity versions or conditional requests for concurrent edits. Evidence and state transitions must not use silent last-write-wins.
- Idempotency-key format, storage, and lifetime are to be decided with offline-duration evidence.

## Correlation identifiers

Accept a valid client correlation ID or create one; propagate and return it. Create a separate server request ID for each attempt when useful. Neither grants access. Validate length/characters to prevent log injection and do not embed personal data.

## File uploads

- Define maximum file count, compressed/uncompressed size, dimensions, type, and purpose per endpoint; numeric limits need device and threat validation.
- Validate actual signature as well as declared MIME type and extension.
- Use server-owned object names, checksums, isolated/quarantined storage where needed, and short-lived authorised operations.
- Strip or deliberately handle metadata such as EXIF location according to the privacy design.
- Never mark upload/evidence complete before durable storage and integrity checks.
- Support resumable upload only with validated chunk order/integrity and idempotent completion.

## Rate limiting and abuse

Apply differentiated controls to authentication, upload, vision inference, LLM generation, location lookup, QR retrieval, review, and exports. Scope by account, programme, device/session, IP, or resource only where privacy and fairness permit. `429` responses should provide safe retry information. Limits and exemptions require threat modelling and field testing.

## Compatibility and deprecation

- Additive optional fields are preferred, but consumers must tolerate only what the contract explicitly says.
- Do not repurpose a field or enum meaning. Add a new field/value with compatibility review.
- Breaking changes require a new version or agreed staged migration, consumer inventory, dual-support period where needed, contract tests, telemetry, and rollback.
- Announce deprecation in documentation and, if accepted, response metadata/headers. State replacement, deadline, owner, and removal condition.
- Removal cannot occur while supported consumers depend on the old contract.

## API review checklist

- Does the resource model express business meaning?
- Are identity, programme, and object authorisation explicit?
- Are evidence, predictions, estimates, and measurements separate?
- Are units, timestamps, versions, provenance, and uncertainty unambiguous?
- Are pagination and bounds safe?
- Are retry, idempotency, conflicts, and offline replay defined?
- Are upload and personal-data exposure minimised?
- Are success/error examples and compatibility tests updated?
