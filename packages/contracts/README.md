# ScrapTrace contracts

`@scraptrace/contracts` is the shared, runtime-validatable contract package for ScrapTrace. It owns domain and service schemas, inferred TypeScript types, lifecycle rules, evidence provenance, offline synchronization semantics, permissions, safe errors, and generated JSON Schema artifacts.

The package contains no interface code, routes, controllers, persistence, storage, provider SDKs, model execution, safety facts, analytics logic, or deployment configuration. Services enforce these contracts; importing a type never grants access or proves a real-world claim.

## Status and authority

Contract schema version `1.0.0` is the first implementation baseline. Package version `0.1.0` describes this package release independently. The [final SRS](<../../docs/product/ScrapTrace_Software_Requirements_Specification (2).docx>) governs product requirements, and [ADRs 002–007](../../docs/decisions/README.md) govern the decisions implemented here.

Two SRS inconsistencies are explicit:

- `Saved offline` and `Pending synchronization` are synchronization conditions, not recovery business states.
- `Completed` means evidence-complete but not programme-approved. Only `Approved and completed` contributes to verified totals. An unflagged completed record requires the server/system checks transition; a flagged record requires a reviewer decision.

## Install and use

For package development:

```bash
cd packages/contracts
npm ci
npm run check
```

Until repository-wide workspace tooling is selected, a local consumer can declare `"@scraptrace/contracts": "file:../../packages/contracts"` using the correct relative path. Consumers import only the package entry point:

```ts
import { RecoveryRecordSchema, type RecoveryRecord } from "@scraptrace/contracts";

const result = RecoveryRecordSchema.safeParse(untrustedPayload);
if (!result.success) {
  // Map the validation issues to the standard safe error envelope.
  throw new Error("Recovery record validation failed");
}

const record: RecoveryRecord = result.data;
```

Do not import private paths under `src/` or reproduce these enums in an application.

## Recovery-record dimensions

The contract keeps these dimensions independent:

- Business: `draft`, `submitted`, `awaiting_handoff`, `received`, `processing_recorded`, `completed`, `under_review`, `approved_and_completed`, `rejected`.
- Handoff: `not_started`, `awaiting`, `received`, `disputed`.
- Processing: `not_started`, `in_progress`, `evidence_recorded`, `completed`.
- Review: `not_required`, `open`, `awaiting_information`, `approved`, `rejected`.
- Synchronization: `offline`, `pending_synchronization`, `synchronizing`, `synchronized`, `action_required`.

`approved_and_completed` and `rejected` are terminal. A later correction needs a separately reviewed amendment event; terminal state is never silently reopened.

## Transition matrix

| Current state | Event | Required actor | Required evidence | Result | Offline | Retry safe |
|---|---|---|---|---|---|---|
| `draft` | `submit_record` | Collector | Original item photograph | `submitted` | No | Yes |
| `submitted` | `publish_for_handoff` | System | Original item photograph | `awaiting_handoff` | No | Yes |
| `awaiting_handoff` | `record_handoff` | Recycler | QR scan, receipt, handoff photograph, weight measurement | `received` | Queued command allowed | Yes |
| `received` | `record_processing` | Recycler | Processing/completion evidence | `processing_recorded` | Queued command allowed | Yes |
| `processing_recorded` | `mark_processing_complete` | Recycler | Processing/completion evidence | `completed` | No | Yes |
| `processing_recorded` | `flag_for_review` | System or programme reviewer | Named reason in command | `under_review` | No | Yes |
| `completed` | `flag_for_review` | System or programme reviewer | Named reason in command | `under_review` | No | Yes |
| `completed` | `approve_unflagged_completion` | System | Handoff photograph, weight and processing evidence; no unresolved flag | `approved_and_completed` | No | Yes |
| `under_review` | `approve_review` | Programme reviewer | Reviewer decision evidence | `approved_and_completed` | No | Yes |
| `under_review` | `request_correction` | Programme reviewer | Reviewer decision evidence | `under_review` | No | Yes |
| `under_review` | `reject_review` | Programme reviewer | Reviewer decision evidence | `rejected` | No | Yes |

“Offline: queued command allowed” means the recycler may capture the command locally. The business transition occurs only after server validation and acknowledgement.

Use `transitionRecoveryRecord` to evaluate the matrix without database or network side effects. Invalid state, role, evidence, flag and offline conditions return typed failures.

## Evidence and provenance

Evidence contains an opaque evidence/record ID, purpose type, private object reference, MIME type, size, SHA-256 content digest, capture source, actor, application-generated device-instance ID, capture/server times, optional consented coordinates, application version, connectivity state, and AI/correction provenance where relevant.

Storage references are object keys, not raw bytes or public URLs. Hardware fingerprints such as IMEI, MAC address or device serial number do not belong in contracts. The original prediction and human correction are separate facts; corrections do not overwrite model output or trigger automatic learning.

## Identifiers, QR and integrity

Offline-created records, events, evidence and mutations use lowercase UUIDv7 identifiers. A human-readable reference is display-only. QR payloads contain only:

```json
{
  "contract_version": "1.0.0",
  "record_id": "0199a111-1111-7111-8111-111111111111",
  "lookup_token": "opaque_demo_lookup_token_0001"
}
```

The QR contains no name, phone number, account details or coordinates. The lookup token is not authorization.

Record integrity uses deterministic canonical JSON and the form `sha256:<64 lowercase hexadecimal characters>`. The immutable payload includes initial identity, item/batch, capture, original evidence reference, prediction and confirmation facts. Revision, synchronization, current state, update time and other operational metadata are excluded. Legitimate amendments keep the previous digest and append an attributable event.

A hash helps detect whether canonical captured data changed after creation. It does not prove that a photograph is truthful, a device clock is correct, an actor is honest, or recycling occurred.

## Synchronization and idempotency

Every queued mutation includes record, mutation and device-instance UUIDv7 values; local order; base server revision; contract version; mutation type and payload; creation time; request digest; idempotency key/scope; and attempt metadata.

A batch reports each item independently:

- `accepted`: newly created or replayed logical result with server revision/time;
- `rejected`: permanent validation, permission, state, version or integrity failure;
- `conflicting`: safe version/idempotency/duplicate information requiring explicit resolution; or
- `retryable`: temporary dependency, rate-limit or internal failure.

The same actor/operation/resource key with the same request digest replays the original result. The same scoped key with another digest returns `IDEMPOTENCY_CONFLICT`. Exact key retention duration remains undecided until offline-duration and persistence testing; services must document it before external use. No evidence, handoff, processing or review field uses silent last-write-wins.

## Roles and permissions

| Role | Core granted area |
|---|---|
| Collector | Create records; view and correct own records |
| Recycler | View assigned operational records; accept/record handoff and processing at an assigned facility |
| Programme reviewer | Review assigned programme evidence; flag, approve, reject or request correction |
| Programme manager | View programme reports and authorised exports within assigned programme scope |
| Safety-content administrator | Manage governed safety content |
| Data/ML reviewer | Review correction candidates and model performance |

The helper denies permissions absent from the matrix and applies ownership, facility, programme and review scope. Services must authenticate actors, enforce object/field scope server-side and return only permitted data. Interface visibility is never authorization.

## Service and error contracts

Contracts cover vision appraisal, grounded safety guidance, nearby locations, handoff, processing, programme review and reporting. Normal alternatives use explicit outcomes such as `unable_to_classify`, `safe_fallback`, `no_results`, `duplicate_scan` and `review_required`.

The safe error envelope includes contract version, stable error code, safe message/translation key, correlation ID, retryability, field issues, safe details and UTC timestamp. It excludes stack traces, tokens, prompts, personal data and infrastructure details. HTTP adapters must still select the correct status code.

## Versions and compatibility

- Additive optional fields may be backward compatible after consumer review.
- A field or enum meaning is never repurposed.
- New required fields, removals, narrowing, or changed semantics require a new contract major version and migration plan.
- Events carry an independent semantic event version.
- Unsupported versions return `UNSUPPORTED_CONTRACT_VERSION` without attempting a lossy conversion.
- Deprecation records the replacement, owner, support period and removal condition.
- Database migrations are outside this package; contracts define the migration boundary only.

## Commands

```bash
npm run typecheck       # strict TypeScript validation
npm test                # contract tests
npm run build           # independent ESM/declaration build
npm run schema:generate # rebuild committed Draft 2020-12 JSON Schemas
npm run schema:check    # fail when generated artifacts drift
npm run check           # complete package verification
```

## Contract changes

1. Link the SRS requirement or accepted ADR.
2. Change the canonical Zod schema or pure rule first.
3. Identify every consumer and classify compatibility.
4. Update fixtures, transition/permission tests and generated schemas.
5. Update this README and add/supersede an ADR for a durable semantic decision.
6. Run `npm run check` and include results in review.

## Invalid payload example

This QR is invalid because it contains personal data and omits the opaque lookup token:

```json
{
  "contract_version": "1.0.0",
  "record_id": "0199a111-1111-7111-8111-111111111111",
  "collector_phone": "+000000000"
}
```

Strict runtime validation rejects unknown or missing fields. Fixtures use only fictional identifiers and general demonstration locations.

## Ownership and review

Platform architecture owns this package. Changes require affected web/API/service owners; security/privacy review for identity, evidence, QR, integrity, permissions or errors; and product/data/safety review where requirements, labels or guidance boundaries change.
