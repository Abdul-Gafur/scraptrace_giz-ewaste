# Observability

## Status and objective

This document proposes observability outcomes; no monitoring product, telemetry pipeline, dashboard, alert, or on-call owner exists. Telemetry must support safe operation without becoming an uncontrolled store of identity, images, locations, prompts, or recovery evidence.

## Signal types

### Operational logs

Structured events for service behaviour and failure diagnosis: UTC timestamp, severity, service/environment, stable event/error code, safe request/correlation/operation IDs, outcome, duration, dependency category, and relevant version identifiers. Do not log full bodies, images, precise location, secrets, provider credentials, or user-bearing prompts/responses.

### Security events

Restricted events for authentication/authorisation failures, privileged access, suspicious object/QR access, upload rejection, abuse/rate controls, secret lifecycle, integrity failure, and security configuration changes. Security events need dedicated access, retention, triage, and escalation; not every denial is an operational error.

### Business audit events

Durable attributable history for record/evidence creation and change, handoff, measured weight, processing assertion, review decision, directory status, restricted export, role assignment, and model/content/dataset release. Audit events are append-only/tamper-evident under a future design and do not copy unnecessary evidence. Operational logs cannot substitute for them.

### Model monitoring

Privacy-minimised signals for model version distribution, inference outcome/latency, confidence and low-confidence rates, invalid/out-of-scope inputs, reviewed corrections, category/slice behaviour where lawful, drift indicators, fallback, and rollback. Corrections are not ground truth until reviewed. Monitoring never turns operational images into training data automatically.

## Proposed capabilities

| Capability | Proposed requirement |
|---|---|
| Structured logs | Machine-readable, allow-listed fields, consistent event/error names, redaction before emission |
| Metrics | Bounded labels for request outcome/latency, queue depth, uploads, dependencies, review flow, resource use, and availability |
| Tracing | Propagate privacy-safe correlation across web/API/services/providers with controlled sampling and retention |
| Health checks | Separate liveness from readiness; disclose no secret, topology, or sensitive dependency detail publicly |
| Audit events | Attribute actor/action/target/time/reason/version for material business/security changes |
| Correlation identifiers | One journey-safe correlation ID across calls plus request ID per attempt and stable idempotent operation ID |
| Error monitoring | Group by stable code/version; preserve safe diagnostic cause; avoid raw personal/context payload capture |
| Model-version monitoring | Record exact model/category/preprocessing version with inference outcomes and release/rollback status |
| Prompt-version monitoring | Record policy/template/provider/model/validator/safety-card versions and validation/fallback outcome, not full content |
| Offline sync monitoring | Count queue/sync/retry/conflict/rejection age and outcomes without exposing local record content; separate device-local from server-visible state |
| Dashboard availability | Measure authorised dashboard/API health and data freshness; distinguish unavailable, stale, and partial data |
| Privacy and redaction | Data inventory, field allow-list, classification, retention, access, sampling, deletion, and provider-transfer review for every signal |
| Alert ownership | Every actionable alert has service owner, severity, playbook, escalation, and review; exact owners and thresholds are to be decided |

## Correlation and identity

Correlation IDs must be random/opaque, length-limited, safe for logs, and must not grant access or embed personal data. Request IDs distinguish retries; idempotency keys distinguish logical mutations. User or record identifiers appear only when necessary, pseudonymous references still retain their classification, and high-cardinality identity labels are prohibited in metrics.

## Alerts and dashboards

Proposed alert areas include service unavailability, elevated error/latency, failed uploads, sync backlog/age, repeated integrity conflicts, provider degradation, unsafe LLM validation failures, model-version mismatch, unexpected low-confidence shift, audit pipeline failure, secret/auth anomaly, and stale verified-report projections. Numeric thresholds require baselines and risk approval; none are invented here.

Dashboards must show definition, environment, time window, freshness, version, missing-data state, and owner. Operational dashboards must not expose collector identity or raw evidence. Business dashboards remain governed product views, not observability shortcuts.

## Retention and access

Define separate schedules and permissions for operational logs, security events, audit events, traces, metrics, and model monitoring. Do not retain content “just in case.” Provider-side telemetry, backups, exports, and incident snapshots follow the same classification/deletion rules.

## Release readiness

Before a deployed hackathon or future production release, owners should define minimum health/smoke signals, expected baselines, alert routing, privacy review, dashboard access, known blind spots, and rollback triggers. A green dashboard does not establish correct recycling verification or safe field impact.
