# Error handling and logging

## Purpose

This document is authoritative for failure semantics, operational telemetry, and audit separation. Error handling must preserve user work, evidence integrity, privacy, and safe fallbacks. Errors are never silently ignored.

## Error taxonomy

| Class | Meaning | Typical response | Retry default |
|---|---|---|---|
| Validation | Input cannot be safely interpreted or violates shape/range | Field-safe correction message | No, until corrected |
| Authentication | Identity/session is missing or invalid | Reauthenticate without leaking resource existence | No automatic retry |
| Authorisation | Identity lacks role/programme/resource permission | Safe denial and security signal | No |
| Domain | Request violates a business invariant or state transition | Stable domain code and corrective action | Usually no |
| Conflict | Concurrent/offline intent conflicts with current state | Preserve both facts and request resolution | After resolution |
| Infrastructure | Database, queue, storage, or runtime unavailable | Preserve intent; degrade or fail safely | Often, if bounded |
| External service | Vision, LLM, map, or provider fails/is invalid | Adapter-specific safe fallback | Depends on cause |
| Unexpected | Unclassified defect or invariant breach | Generic user response; protected diagnostic | No blind retry |

Each error has a stable code, safe message, retryability, correlation ID, and optional field/detail data that reveals no sensitive internals. Internal exceptions retain cause/context in protected telemetry but never cross client boundaries as stack traces.

## Handling rules

1. Validate at the earliest owned boundary and repeat authoritative validation server-side.
2. Raise/return a typed domain error rather than parsing exception text.
3. Catch only where the code can recover, compensate, translate, attach useful context, or terminate safely.
4. Preserve the original cause without duplicating the same error log at every layer.
5. Define transaction/cleanup behaviour; partial success must be explicit and recoverable.
6. Tell the user whether work is local, queued, rejected, or acknowledged and what action is safe.
7. Do not convert provider success into domain verification without domain rules.

## Retry rules

Retries are bounded, observable, idempotent, and limited to failures known to be transient. Use exponential backoff with jitter when appropriate. Honour provider retry guidance without trusting it blindly. Do not automatically retry validation, permission, conflict, unsafe model output, or terminal state errors. Reuse the same idempotency key for one logical mutation and create a new one only for a new intent.

Retry budgets, timeout values, and circuit-breaker settings remain **to be decided** after baseline and provider validation.

## Component fallbacks

- **Offline/client:** Preserve the local record and queue when safe. Show last attempt, retry action, and distinction from server receipt/verification.
- **Vision:** Offer manual category selection and approved generic guidance where available. Never fabricate a category or confidence.
- **Safety/LLM:** Return the approved card or reviewed generic fallback. Reject output that adds unsupported safety facts; never improvise instructions.
- **Map/location:** Use a dated cached directory or manual area search. Do not invent a destination or approval status.
- **Object storage:** Keep evidence pending; do not attach a nonexistent object or advance completeness. Clean up orphaned partial objects through a documented process.
- **Database:** Roll back the affected transaction and return a safe retry/non-retry outcome. Never acknowledge a canonical state not durably stored.
- **Reporting:** Mark data stale/unavailable and preserve status separation rather than returning partial totals as complete.

## User-facing messages

Messages use plain language, avoid blame, preserve safety warnings, and provide a next step. They do not expose SQL, paths, provider names unless useful/approved, stack traces, credentials, role logic, or whether an inaccessible record exists. Critical messages must be localisable and accessible.

Example:

```json
{
  "error": {
    "code": "SAFETY_CONTENT_UNAVAILABLE",
    "message": "Approved guidance is not available for this category right now.",
    "retryable": false
  },
  "meta": { "correlation_id": "8a2d-example" }
}
```

## Structured operational logging

Use machine-readable fields rather than interpolated prose where possible:

- timestamp in UTC;
- severity and stable event name;
- service/component and environment;
- request ID, correlation ID, and safe operation ID;
- safe pseudonymous entity reference only when necessary;
- outcome, duration, retry count, dependency category, and stable error code;
- model, prompt/policy, safety-card, and contract version where relevant.

Log once at the boundary responsible for the failed operation. Additional layers add traces/fields, not duplicate alarming entries.

## Log levels

- `DEBUG`: temporary diagnostic detail with production redaction/disable policy.
- `INFO`: significant expected lifecycle event, not every function call.
- `WARN`: degraded but recovered behaviour, approaching limits, or action-worthy anomaly.
- `ERROR`: an operation failed, an invariant broke, or intervention may be needed.

User input validation, expected not-found responses, and ordinary authorisation denial are not automatically `ERROR`; security monitoring may record structured events separately.

## Prohibited logged data

Do not log passwords, tokens, secrets, session cookies, raw authorisation headers, full request/response bodies, images or unrestricted object URLs, precise location, direct identity, payment details, safety prompts containing user data, model-training candidates, or sensitive stack locals. Redaction is allow-list based. Hashing personal data can still create linkable personal data and needs review.

## Metrics, traces, and health

- Metrics cover traffic/outcomes/latency, queue and sync states, retries, uploads, provider health, review workflow, integrity failures, model versions/confidence distribution, and LLM fallback/validation without personal high-cardinality labels.
- Traces propagate context across services with privacy-safe attributes and controlled sampling/retention.
- Liveness says the process can run; readiness says it can safely receive relevant work. Public health responses disclose no topology, secrets, or sensitive errors.
- Alert rules, service levels, and retention require later operational approval; no numeric targets are invented here.

## Audit events versus operational logs

Audit events answer who performed a business/security-significant action, what changed, when, within which programme/resource, and why. They include record creation, handover confirmation, evidence addition, review outcome, privileged access, role/status change, and material content/model release.

Operational logs diagnose software and infrastructure. They may be sampled or expire sooner. Audit events require stronger integrity, access, retention, and append-only semantics. An operational log does not satisfy audit requirements, and audit history must not become a dumping ground for stack traces or secrets.

## Review checklist

- Are all failure modes classified and surfaced at the right layer?
- Is retry safe, bounded, idempotent, and observable?
- Can any error lose or overstate evidence?
- Is the fallback approved and safer than guessing?
- Are user messages useful and non-sensitive?
- Is telemetry sufficient without personal data?
- Is an audit event required separately?
