# Testing strategy

## Purpose and status

This strategy defines the proposed evidence needed to trust ScrapTrace changes. It complements the testable [functional](../product/functional-requirements.md) and [non-functional requirements](../product/non-functional-requirements.md). Frameworks, device matrix, numeric coverage thresholds, model acceptance thresholds, and CI implementation are **to be decided**.

## Principles

- Put most tests at the lowest layer that proves the behaviour; reserve end-to-end tests for critical cross-component confidence.
- Test business-critical paths, boundary failures, access control, data integrity, safety constraints, and offline interruption before cosmetic detail.
- A passing happy path is insufficient when failure could lose evidence, expose data, provide unsafe advice, or overstate verification.
- Tests must be deterministic where possible, fast enough for their intended feedback loop, and owned with the behaviour they protect.
- Production personal data, credentials, restricted images, and invented business claims are prohibited in fixtures.

## Test layers

| Layer | Purpose | Typical scope | Expected use |
|---|---|---|---|
| Static checks | Detect type, lint, format, contract, link, and dependency-boundary issues | One repository/component | Every change once tooling exists |
| Unit | Prove a rule or transformation in isolation | State transition, estimate labelling, retry classification, card selection | Many, fast |
| Component/UI | Prove rendered behaviour and interaction | Form validation, focus, state display, language/direction | Many around important UI |
| Integration | Prove owned adapters and infrastructure interaction | API/database, object upload, local queue, provider adapter | For every boundary |
| Contract | Prove producer/consumer compatibility | Web/API, API/vision, API/safety, events and errors | Every cross-component contract |
| End-to-end | Prove a complete user outcome | Collector-to-recycler journey and review | Few, critical |
| Non-functional/evaluation | Prove qualities and AI behaviour | Accessibility, security, offline, performance, CV/LLM evaluation | Risk- and release-based |

## Unit and component tests

Unit tests cover state transitions, verification eligibility, price-range inputs and labelling, duplicate/idempotency decisions, permissions expressed as policy, error classification, mapping, validation, and safety-card selection. UI tests cover semantic controls, validation recovery, accessible names, focus, and loading/empty/error/offline/conflict states.

Avoid testing framework implementation, trivial accessors, or snapshots with no behavioural assertion. Use Arrange, Act, Assert and scenario names that state the outcome.

## Integration tests

Integration suites should use representative local/test implementations to prove:

- migrations, constraints, transactions, concurrency, and append-only evidence behaviour;
- request/response validation and authorisation through the HTTP layer;
- protected object upload, checksum/reference behaviour, and failure cleanup;
- offline queue persistence, restart, retry, and canonical ID mapping;
- provider-adapter timeout, malformed response, rate limit, and fallback translation;
- audit event creation distinct from operational logs; and
- privacy-safe telemetry and redaction.

Mocks belong at providers the team does not control, not between every internal function.

## Contract tests

Every public boundary has versioned examples and compatibility checks. Tests verify success, validation, authorisation, retryable failure, and stable error shapes. Provider adapters use recorded/synthetic payloads allowed by provider terms. A contract change cannot merge until affected producers and consumers are identified and compatible or have an approved rollout plan.

## End-to-end journeys

The primary end-to-end test is:

```text
Capture image
→ receive category and confidence
→ retrieve safety guidance
→ view price estimate
→ choose location
→ create record and QR code
→ confirm recycler handoff
→ display verified journey
```

It must assert that:

1. capture provenance and a new image are recorded;
2. category, confidence, and model version are shown and correction is possible;
3. guidance has approved-card provenance and no unsupported content;
4. price is a dated, indicative range rather than a promise;
5. location type and verification status remain distinct;
6. item/batch identity and QR reference expose no unnecessary personal data;
7. recycler measurement and final buying price remain distinct from estimates;
8. required scale and processing evidence exists;
9. only a complete, policy-conforming record becomes verified; and
10. the journey preserves ordered actors, versions, evidence, and review state.

Additional end-to-end tests cover household guidance without a record, category correction and reviewer decision, suspected duplicate handling, missing evidence, invalid/duplicate QR, and programme totals excluding pending/flagged/rejected/unsynchronised records.

## Accessibility testing

- Run automated WCAG checks on components and critical pages.
- Manually test keyboard order, focus visibility/restoration, dialogs, errors, status announcements, zoom/reflow, touch targets, and screen-reader names.
- Test confidence, verification, hazards, and offline state without colour.
- Test English, French, Portuguese, and Arabic layouts, including right-to-left behaviour.
- Use the agreed representative device/browser/assistive-technology matrix; it remains to be approved.

## Offline and synchronisation testing

Test initial offline capture, cache present/absent/stale, process restart, storage pressure, network loss at every upload/sync stage, timeout, repeated request, reordered operation, authentication expiry, conflict, server rejection, and recovery. Assert:

- acknowledged local work is retained;
- one local ID maps to one canonical ID;
- the same idempotency key creates one effect;
- pending status never appears verified;
- unsafe last-write-wins does not overwrite evidence;
- cached card/directory freshness is visible; and
- missing cloud LLM or vision has the approved fallback.

## Security and privacy testing

Risk-based tests cover unauthenticated and unauthorised role/programme/resource access, object-reference guessing, upload spoofing/oversize/malicious content, injection, XSS including LLM output, CSRF where applicable, secret exposure, rate-limit behaviour, sensitive cache headers, QR disclosure, log redaction, and data deletion/retention when implemented. Threat modelling determines additional abuse cases.

## Computer-vision evaluation

Use immutable, rights-cleared, leakage-resistant train/validation/test manifests. Report category-level metrics, confusion, calibration/confidence, failure slices, correction routing, latency, size, and field limitations with model/data/config versions and checksums. Threshold selection needs documented costs of false outcomes and human-review capacity. Edge models require conversion-parity and target-device tests.

## LLM safety evaluation

For all hackathon languages and categories, test faithful coverage of the approved five-question card, source metadata, translation preservation, unsupported additions/omissions, prompt injection, hazardous dismantling requests, medical diagnosis requests, price/payment promises, invented locations/recycler status, missing content, timeout, invalid structure, and provider refusal. Release fails if the system displays unapproved safety claims; fallback must remain available.

## Performance and reliability

Establish baselines before numeric budgets. Measure local interaction, upload, API, inference, guide generation, directory search, synchronisation backlog, dashboard queries, object size, and resource use on agreed targets. Reliability tests cover retries, concurrency, partial failure, restart, and restore. Load, availability, and recovery objectives require later pilot/operations approval.

## Fixtures, mocks, and determinism

- Use minimal synthetic or explicitly licensed fixtures with provenance.
- Fix clocks, seeds, IDs, locales, and network responses when the behaviour does not depend on variation.
- Never place personal data, production exports, credentials, unrestricted challenge images, or real payment details in tests.
- Mock external providers at owned adapter interfaces; do not mock the code under test.
- Document unavoidable nondeterminism and use statistically appropriate evaluation rather than flaky pass/fail assertions.

## Regression and coverage policy

Every defect receives a test that fails before the fix at the lowest meaningful layer. High-risk defects also receive an integration or journey guard. Coverage reports help find untested code, but no percentage overrides review of critical branches, errors, permissions, state transitions, and AI safety. Initial numeric thresholds are **to be decided** after tools and baselines exist.

## Test ownership and release evidence

The owning component maintains its unit/integration tests. `tests/` owns cross-component and end-to-end orchestration with affected owners. ML owners maintain vision evaluation; safety/AI owners jointly maintain LLM safety sets; accessibility and security need specialist review. A PR records tests run and limitations; a release retains results, versions, known failures, and approvals.

## Current gap

No application code, test framework, test data, device matrix, evaluation set, or CI currently exists. This document defines the required strategy only and does not claim test coverage.

The [demo journey](../prototype/demo-journey.md) and [delivery checklist](../prototype/delivery-checklist.md) translate this strategy into rehearsal and release evidence for the hackathon release.
