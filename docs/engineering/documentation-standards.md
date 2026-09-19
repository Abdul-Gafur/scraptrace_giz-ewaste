# Documentation standards

## Purpose

Documentation is part of the product and engineering system. It must help a defined reader act safely, distinguish requirements from implementation status, and remain traceable to decisions. The [final SRS](<../product/ScrapTrace_Software_Requirements_Specification (2).docx>) is authoritative for requirements and acceptance; the [Concept Note](../../concept_note.md) remains the source for original problem context and intent.

## Document ownership

Every material document has an identifiable owning role, even if repository ownership automation is not yet configured:

- product owners maintain scope, requirements, journeys, and success claims;
- architecture owners maintain system boundaries and ADRs;
- component owners maintain public interfaces and operational behaviour;
- data/ML owners maintain dataset and model documentation;
- safety-content and responsible-AI owners maintain approved sources, prompts/policies, evaluations, and fallbacks;
- security/privacy owners review threat, data, access, and retention decisions; and
- operations owners maintain deployment and runbooks once environments exist.

Named owners and review cadence are **to be decided**.

## Status language

Use these terms consistently:

- **Current/implemented:** verified to exist in the repository or operating environment.
- **Proposed:** recommended but not accepted or implemented.
- **Accepted:** approved through the relevant decision process; implementation may still be incomplete and must be stated separately.
- **Deferred:** intentionally postponed with a reason or dependency.
- **Future:** outside current scope and requiring separate implementation/authorisation.
- **To be decided:** no accountable decision exists yet.

Never use future tense alone to imply commitment. Never describe a hackathon demonstration as field evidence, a directory listing as recycler approval, a local save as verification, an estimate as a price offer, or a future integration as live.

## Structure and style

- Use sentence-case headings and one top-level `#` heading.
- Start with purpose, scope/status, and the action a reader needs.
- Use plain professional language and defined ScrapTrace terms from Phase 1.
- Prefer short sections, tables for repeated fields, and diagrams only when relationships are clearer visually.
- Define acronyms on first use unless universally understood in the target audience.
- Use numbered steps for ordered procedures and bullets for unordered conditions.
- Use normative `must`, `must not`, and `should` deliberately; state whether a standard is proposed or accepted.
- Avoid generic filler, unsupported claims, marketing superlatives, and content duplicated from another authoritative page.
- Link to the authoritative source instead of copying large sections. Summarise only the context required by the reader.

## Links and navigation

- Use relative links for repository documents.
- Link directly to the most relevant document/heading and use descriptive labels.
- Update [docs/README.md](../README.md) when adding a major document.
- Update local indexes when a document is renamed, moved, deprecated, or superseded.
- Validate links before review. Do not leave placeholder “Read source” text without recording that the URL is unavailable.

## Requirements and traceability

- Product requirements use stable IDs and testable acceptance conditions.
- API fields and state transitions link to the relevant requirement or decision when the reason is not obvious.
- Pull requests link the issue and list documents/contracts changed.
- Significant architecture choices use the [ADR process](../decisions/README.md); accepted ADRs are not rewritten to hide history.
- When standards conflict, resolve through the topic owner and record a durable decision rather than silently editing one side.

## API and contract documentation

Document purpose, authentication and authorisation, request fields, response fields, units, timestamps, examples, errors, pagination, idempotency, limits, compatibility, and deprecation. Examples contain synthetic values and no secrets or personal data. Contract and implementation changes ship together.

## Model and AI documentation

A model release documents model/data/config versions and checksums, intended use, prohibited use, category definitions, dataset rights/provenance, splits, per-category evaluation, calibration/thresholds, limitations, latency/size, approver, and rollback.

An LLM/prompt release documents approved-card source/version, system/prompt policy version, provider/model, structured output, validation, evaluation languages/cases, known failures, privacy/data handling, fallback, approver, and rollback. Never publish hazardous prompt examples or provider logs containing user data.

## Security and privacy documentation

Record data purpose, classification, source, fields, access, third-party transfers, storage, retention/deletion, consent or other basis, subject/correction handling, threats, controls, residual risk, owner, and review date. Keep secrets, exploitable operational detail, and personal data out of general documentation; use access-controlled records where necessary and link only safe summaries.

## Operational documentation

Future runbooks must state when to use them, prerequisites/access, safe steps, verification, rollback, escalation, and last test date. Commands identify environment and avoid ambiguous destructive targets. No runbook may imply a backup or recovery process works until it has been tested.

## Comments and docstrings

Comments explain why, invariants, unusual constraints, safety/privacy decisions, units, or external workarounds. Remove comments that restate code or no longer match it. Public interfaces and non-obvious domain operations document inputs, outputs, errors, side effects, idempotency, and concurrency where relevant.

## Review and freshness

Documentation is reviewed in the same pull request as behaviour. Reviewers verify correctness, status, terminology, links, examples, privacy, accessibility of diagrams/tables, and absence of unsupported claims. Material documents should name or infer review triggers: implementation change, contract/version change, incident, provider change, model/content release, regulation/programme change, or scheduled review. Calendar cadence remains to be decided.

## Deprecation

Do not delete decision history or documentation still referenced by supported behaviour. Mark obsolete documents deprecated or superseded, link the replacement, explain scope and date, update inbound links, and remove only when history and active consumers are protected.

## Documentation completion checklist

- Audience, purpose, owner, and status are clear.
- Current, proposed, deferred, and future behaviour are not mixed.
- Terms match product and architecture documentation.
- Claims have authoritative support and limitations.
- Procedures and examples are safe, synthetic, and testable.
- Security/privacy and accessibility implications are covered.
- Relative links resolve and indexes are current.
- No empty headings, placeholder prose, stale TODO, or duplicated authority remains.
