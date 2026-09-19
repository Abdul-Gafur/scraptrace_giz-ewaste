# Definition of done

## How to use this definition

A feature, fix, or material documentation change is done only when every applicable item is satisfied. “Not applicable” requires a short rationale in the pull request. A merged change with deferred required work is not done; the exception must be explicitly approved, risk-owned, time-bound, and linked to a follow-up issue.

## Scope and correctness

- [ ] The linked issue has current acceptance criteria and each is satisfied with evidence.
- [ ] Behaviour matches the [product requirements](../product/functional-requirements.md) and does not silently expand the hackathon scope.
- [ ] Source evidence, predictions, estimates, measurements, confirmations, and review decisions remain distinct.
- [ ] Important uncertainty and limitations are visible to users and operators.

## Architecture and contracts

- [ ] [Architecture boundaries](../architecture/component-boundaries.md) and allowed dependency directions are respected.
- [ ] Public interfaces are explicit; no private cross-application or cross-service imports were added.
- [ ] API/event/shared contracts and all affected consumers are updated together.
- [ ] Significant architecture changes have an accepted or explicitly proposed ADR and migration/rollout plan.

## Quality evidence

- [ ] Appropriate unit, component, integration, contract, and end-to-end tests were added or updated and pass.
- [ ] A regression test accompanies every defect fix.
- [ ] Error, loading, empty, stale, retry, conflict, and offline states are handled where applicable.
- [ ] The critical user journey is demonstrated in a representative environment.
- [ ] Performance/resource impact is measured or justified as negligible; unresolved targets are not invented.
- [ ] Future required CI checks pass once CI exists. Until then, equivalent local/manual evidence is recorded.

## Accessibility, security, and privacy

- [ ] Semantic structure, keyboard access, focus, non-colour communication, responsive behaviour, and relevant language/direction are reviewed.
- [ ] Authentication/authorisation, input/output handling, secrets, uploads, abuse, and dependency risk are reviewed.
- [ ] Personal, image, location, LLM, and training-data collection is minimised and has documented purpose, access, retention, and consent/rights where required.
- [ ] No secrets, personal data, production exports, or restricted data are committed or included in fixtures/evidence.

## AI and offline integrity

- [ ] Model, dataset, prompt/policy, provider, and safety-card versions are recorded where they affect output.
- [ ] Model uncertainty and human correction/review remain visible; no immediate learning occurs from unreviewed corrections.
- [ ] LLM output is grounded, validated, safely rendered, and falls back to approved content without invented safety advice.
- [ ] Local IDs, sync states, retries, idempotency, conflicts, and duplicate prevention are covered where relevant.
- [ ] Locally saved, server received, recycler confirmed, programme approved, and verified states cannot be confused.

## Documentation and review

- [ ] User, API, architecture, model, safety-content, operational, and engineering documentation is updated as applicable.
- [ ] Known limitations, debt, temporary code, and follow-up work have owned issues.
- [ ] The author completed self-review and supplied reproducible test and demonstration evidence.
- [ ] Required component and specialist reviews are complete with no unresolved blocking threads.
- [ ] The change is safe to merge and has documented rollout, migration, and rollback considerations where applicable.

## Current repository status

There is no CI implementation. References to CI are future gates, not claims that automated checks currently exist.

For a hackathon release, apply the broader [delivery checklist](../prototype/delivery-checklist.md) in addition to this change-level definition.
