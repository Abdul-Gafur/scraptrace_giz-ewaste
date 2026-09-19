# Security and privacy

## Status

This document defines a proposed governance baseline; documentation alone implements no safeguards. Before a pilot, the team needs an approved threat model, data inventory, legal/privacy analysis, access model, retention schedule, provider review, security testing, incident process, and verified technical controls.

## Hackathon release expectations

- Use synthetic or explicitly authorised demonstration data; do not use production personal data or unrestricted challenge images.
- Demonstrate role-separated journeys without claiming production-grade identity or access assurance.
- Keep secrets out of source, documentation, QR codes, logs, screenshots, and browser bundles.
- Minimise identity, location precision, image metadata, LLM payloads, and telemetry.
- Distinguish local, submitted, received, completed, under-review, and programme-approved states.
- Keep evidence protected and programme-scoped in any demonstration environment.
- Label security, duplicate, QR, and verification checks as initial indicators rather than guarantees.
- Conduct focused review of upload, access control, offline storage, LLM grounding, and public dashboard exposure before demonstration.

## Production requirements

Production or field use would require, at minimum:

- approved identity, authentication, session, role/programme/resource authorisation, account recovery, and privileged-access controls;
- supported encryption in transit/at rest, key/secrets management, secure configuration, and environment separation;
- hardened upload/object access, malware/content policy, integrity checks, and signed/short-lived operations;
- secure software/dependency lifecycle, testing, vulnerability handling, logging/monitoring, response, backup and verified recovery;
- privacy notices, lawful basis/consent where applicable, subject/correction/deletion processes, retention enforcement, provider agreements, and transfer/region decisions;
- model/data/content/prompt release controls and AI safety evaluation;
- abuse/rate controls, availability planning, audit integrity, and periodic access/recycler/directory review; and
- independent review appropriate to risk and applicable programme/regulatory requirements.

Exact controls and targets are to be decided; this list does not certify readiness.

## Current limitations

There is no application, security architecture implementation, identity provider, database, object store, AI provider, operational environment, incident contact, data-protection determination, or tested recovery process. The repository's public/private hosting and collaborator-access model are outside this documentation and require confirmation.

## Sensitive assets

Restricted or high-impact assets include credentials and provider keys; account/session/recovery material; collector identity/contact; precise or linked location; raw images and evidence; recovery/review/audit history; future financial references/instructions; private safety drafts; model/dataset artefacts; evaluation sets; system/prompt/validator policies where disclosure enables bypass; directory verification evidence; and administrative/export capability.

## Data minimisation and consent

Every field/provider transfer needs purpose, owner, class, access, retention, and deletion. Prefer approximate/manual location where sufficient and keep public aggregates separate from underlying identity. Participation in collection must not silently authorise model training. Training, provider processing, optional location, and future payment purposes require distinct, understandable treatment approved by legal/privacy and programme owners.

## Location protection

Request permission, explain purpose, collect the least precision, record source/precision, provide manual alternatives, limit background collection, avoid public record-level display, strip unintended image metadata, and define offline/provider/cache retention. Location must not be treated as proof of capture, ownership, handoff, or processing.

## Image protection

Treat all images as untrusted Restricted evidence by default. Validate uploads, minimise metadata, isolate storage, use controlled references and integrity checks, prevent public listing, authorise every access, and define derivative/cache/deletion handling. Operational evidence does not enter training without a separate approved copy and lineage.

## Public dashboard aggregation

Public output must exclude direct collector identity and sensitive record evidence. Aggregation requires approved geography/time/category granularity, small-group and linkage-risk controls, status separation, freshness/definition labels, and review of rare combinations. Search counts or location patterns can still expose communities and require privacy assessment.

## Audit requirements

Proposed audit events cover record/evidence creation and changes, handoff/weight/processing assertions, reviews, directory/status changes, role/permission/admin actions, sensitive access/export, content/model/dataset releases, secret lifecycle, and security events. They are append-only/tamper-evident under an approved design, restricted, privacy-minimised, time-synchronised, monitored, and retained under a separate schedule. Operational logs are not audit records.

## Third-party services

Before any LLM, map, storage, monitoring, identity, or future payment/government provider is used, review data sent, purpose, controller/processor roles, terms/training use, retention/deletion, region/transfers, subprocessors, security evidence, authentication, logging, availability, incident notification, cost, exit/export, and fallback. Keep provider schemas behind owned adapters.

## LLM privacy

Send only approved safety-card content, target language, allowed transformation, and non-identifying technical context. Do not send images, identity, precise location, recovery evidence, prices, programme decisions, secrets, or unrelated text. Full prompt/response logging is prohibited by default. Provider training and retention must be disabled or contractually controlled as approved.

## Model and dataset security

Protect restricted datasets, manifests, evaluation sets, model artefacts, registries, release approvals, and inference interfaces against unauthorised access, poisoning, leakage, replacement, extraction, denial, and unsafe rollback. Use immutable versions/checksums, least privilege, lineage, protected test sets, signed/verified distribution where selected, and review of model/provider dependencies. These are proposed requirements, not implemented controls.

## Privacy and security review gates

Review is required before collecting pilot data, changing sensitive fields/purpose/retention, adding providers, publishing aggregates, enabling offline personal data, admitting training data, releasing a model/prompt/card, changing roles, exposing uploads/exports, or implementing future financial/regulatory connections.
