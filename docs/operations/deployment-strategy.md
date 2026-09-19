# Deployment strategy

## Status

This is a proposed future approach. Phase 4 creates no deployment files, containers, workflows, infrastructure, environments, or releases. Technology, hosting, release cadence, and production authority remain undecided.

## Deployment units

The web application, application API, vision service, and safety-assistant service should remain independently deployable possibilities with versioned contracts. Independence is not a requirement to create separate infrastructure for the hackathon release. The location capability and programme dashboard may initially remain API/web modules as documented in [System overview](../architecture/system-overview.md).

Each releasable unit should identify source revision, contract/config version, dependencies, artefact checksum, required migrations, compatible model/content/prompt versions, health checks, owner, and rollback target.

## Environment promotion

Promote immutable reviewed artefacts through local/shared development, testing/staging, and only later authorised production. Do not rebuild a different artefact for each environment when avoidable; inject validated environment configuration separately. A release advances only after its environment-specific acceptance evidence and approval. Production is future-only.

## Configuration and secrets separation

- Keep non-secret schemas/defaults separate from environment values.
- Use dedicated environment/provider identities and credentials; never copy production secrets downward.
- Validate required values before accepting traffic and fail safely on invalid/missing configuration.
- Record configuration version/change without logging secret values.
- Follow [Secrets management](../security/secrets-management.md); tool choice is undecided.

## Database migration controls

If a database is adopted, all schema changes use reviewed forward migrations; applied migrations are never edited. Test against representative synthetic data and backup/restore procedures. Prefer backward-compatible expand/migrate/contract sequences for independently deployable consumers. Define transaction/lock/runtime impact, data validation, rollback or forward-fix, and deployment ordering before release. No migration exists in Phase 4.

## Model deployment

Release only immutable approved models with artefact/data/config/category/preprocessing checksums, evaluation, runtime compatibility, thresholds, owner, and rollback. Verify server or edge target behaviour before promotion. Allow controlled version selection/canary or shadow evaluation only after privacy and user-impact review. Never train or promote directly from user corrections.

## Prompt and safety-content deployment

Prompt/policy, output schema, validator, provider/model compatibility, and approved safety cards are independently versioned governed artefacts. Only approved card/language versions publish. Release validates grounding, prohibited outputs, fallback, cache manifest, and withdrawal. Content rollback/withdrawal must account for offline copies; LLM generation cannot replace unavailable approved content.

## Release sequence

1. Freeze scope and identify artefacts/contracts/migrations/models/content/flags.
2. Confirm reviews, tests, licences, data rights, security/privacy, AI/safety, and documentation.
3. Produce immutable artefacts and provenance; verify checksums/signatures where adopted.
4. Deploy to testing/staging and run smoke, critical journey, offline, migration, accessibility, security, and AI fallback checks.
5. Review observability baseline and pre-agreed rollback triggers.
6. Obtain release approvals and record the decision.
7. Deploy the approved hackathon environment or future production using the least risky strategy supported.
8. Verify health plus the complete collection-to-dashboard journey with controlled data.
9. Monitor for an approved period, record outcome, and close or roll back.

No step is automated or operational today.

## Rollback

Rollback planning precedes deployment and covers web/API/service artefacts, contract compatibility, configuration, database changes, model, prompt/policy, safety content, cached/offline artefacts, and feature flags. Define triggers from correctness, security/privacy, evidence integrity, unsafe output/content, data loss, migration failure, availability, and performance. Rollback must not restore a withdrawn unsafe card, compromised secret, or incompatible schema. When reversal is unsafe, use a tested forward fix or disablement path.

## Health verification

Verify liveness/readiness, dependency access, contract/version compatibility, storage/database integrity, upload, inference/manual fallback, safety retrieval/LLM fallback, location/cache, offline sync/idempotency, handoff, processing/review, and dashboard status separation. Health checks do not replace user-journey tests or audit verification.

## Release approval and audit

Proposed approvals include release owner, affected component owners, product, QA, security/privacy, data/ML, safety/responsible-AI, accessibility, and operations according to change risk. Record actor, time, environment, source/artefact/config/model/prompt/content versions, migrations, flags, evidence, approvals, outcome, and rollback. Exact quorum and emergency process remain to be decided.

## Feature flags

Flags are temporary release/risk controls, not permanent hidden configuration. Each has owner, purpose, default, environments, exposure rules, dependencies, expiry/removal, audit, test combinations, and safe fallback. Do not use a client-controlled flag to bypass server authorisation, safety grounding, verification, or privacy. Stale flags are removed.

## Hackathon release versus production

| Dimension | Hackathon release | Future production |
|---|---|---|
| Goal | Demonstrate one complete controlled journey | Sustain authorised real programme operation |
| Data | Fictional/controlled/licensed demonstration data | Real data only after legal/privacy/programme approval |
| Scale/availability | Demonstration needs with rehearsed fallback | Accepted service, capacity, recovery, and support objectives |
| Integrations | Controlled providers and simulated future payment/reporting | Contracted, secured, authorised and reconciled integrations |
| Security | Risk-focused hackathon controls and explicit limitations | Threat-modelled, tested, monitored, audited controls and response |
| Release | Manual or simple future process may suffice | Controlled promotion, segregation, rollback, audit, and on-call ownership |

The hackathon release must never be presented as production-ready solely because a deployment succeeds.
