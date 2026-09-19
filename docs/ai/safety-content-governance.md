# Safety-content governance

## Purpose and status

This document defines the structure and approval lifecycle for safety cards. It contains no health, handling, emergency, repair, or recycling facts. No card is currently authored or approved.

`packages/safety-content` is the canonical published-content boundary. The LLM is never the author or approver of safety facts.

## Safety-card structure

| Field | Purpose |
|---|---|
| Identifier | Stable, opaque content identity |
| Item category | Versioned supported category to which the card applies |
| Item description | Approved identification context |
| Possible hazards | Reviewed category-level hazard statements |
| Actions to avoid | Reviewed prohibited-action statements |
| Safe immediate actions | Reviewed actions within the intended user's role |
| Emergency warning signs | Reviewed triggers and referral wording, if authorised |
| Repair or reuse guidance | Reviewed conditions and boundaries for referral or reuse |
| Suitable destination | Approved destination type/status language, not an invented business |
| Source | Traceable authoritative references and relevant sections |
| Approval status | `draft`, `in-review`, `approved`, `withdrawn`, `superseded`, or other accepted controlled value |
| Approver | Accountable qualified person/role; identity access follows policy |
| Approval date | UTC date/time of approval |
| Review date | Required next or completed review date according to policy |
| Version | Immutable semantic/content version |
| Supported languages | Approved language variants and their review status |

Additional metadata includes owner, creation/update times, change reason, source publication/version, jurisdiction/scope, translation lineage, checksum, effective/expiry rules, and superseding version. Exact schema remains to be decided.

## Trusted-source selection

Before drafting, a qualified content owner records source authority, relevance, jurisdiction, publication/version date, stability, access/licence terms, and conflicts with other sources. Regulatory, public-health, manufacturer, standards, and recycling sources require subject-matter judgement; this document does not rank or invent them. Unattributed web content, generated text, or user submissions cannot serve as authoritative safety sources.

## Lifecycle

1. **Drafting:** A named author translates selected sources into the defined fields without expanding beyond them and records citations at claim level where practical.
2. **Subject-matter review:** A qualified e-waste safety/recycling reviewer checks accuracy, scope, omissions, dangerous ambiguity, audience suitability, and referral boundaries.
3. **Approval:** A separate authorised approver records decision, rationale, version, date, next review, and any limitations. Separation requirements are to be approved.
4. **Publishing:** Only immutable approved versions enter the published content store. Publishing validates schema, source metadata, language status, checksum, and compatible retrieval/LLM tests.
5. **Distribution:** Approved signed/checksummed bundles may be distributed online or offline with manifest, version, language, effective state, and withdrawal mechanism.

## Translation governance

English, French, Arabic, and Portuguese translations derive from one approved source version and preserve meaning, warnings, qualifications, destination status, and fallback language. Critical translations require qualified language review plus subject-matter confirmation; machine/LLM output is a draft only. Each language has its own approval status, reviewer, version linkage, and review date. Missing translation must not silently fall back to generated safety facts.

## Versioning and change control

Published versions are immutable. Any material wording, source, field, category, or translation change creates a new version with reason and diff. Compatible metadata corrections follow a defined policy. Records and generated responses retain the version used. Supersession does not delete historical evidence, subject to retention and access rules.

## Scheduled review

Review triggers include the recorded review date, source update/withdrawal, regulatory or programme change, incident or user report, translation concern, category change, or evaluation failure. Review periods are not invented here; safety, legal, and programme owners must approve them. An overdue card's serving behaviour is a risk-based policy decision to be accepted before implementation.

## Emergency withdrawal

An authorised safety owner may mark a version withdrawn when continued use may be unsafe, inaccurate, unauthorised, or compromised. Withdrawal handling stops new retrieval/generation, invalidates or warns on cached bundles at next contact, activates separately approved fixed fallback text, notifies owners, preserves audit history, investigates affected responses, and publishes an approved replacement. Offline revocation limits must be documented and tested.

## Audit history

Retain attributable events for draft creation, source changes, reviews, approvals/rejections, translation decisions, publishing, distribution, supersession, withdrawal, and restoration. The audit record references versions/checksums and reasons without exposing unnecessary personal data. Operational logs do not replace this history.

## Offline distribution

Offline bundles contain only approved language variants and necessary provenance, with an immutable manifest and integrity check. The client exposes version/freshness and must not merge incompatible versions. Update and withdrawal checks occur when connectivity returns. Bundle retention, signing method, maximum staleness, and behaviour after withdrawal remain to be decided with safety and product owners.

## Required approvals

Subject-matter qualifications, named owners, trusted-source criteria, separation of duties, translation acceptance, review cadence, emergency authority, fallback content, and offline expiry require safety, legal/programme, language, privacy, and responsible-AI approval as applicable.
