# Pull-request guide

## Purpose

A pull request is the reviewable evidence that a scoped change satisfies its requirements without weakening architecture, safety, privacy, accessibility, or offline integrity. Approval is accountable engineering work.

## Required description

Every PR must include:

1. **Summary and why:** the problem, intended outcome, and approach.
2. **Linked issue:** the issue that owns scope and acceptance criteria.
3. **Acceptance criteria:** checklist with evidence for each criterion.
4. **Scope boundaries:** included, excluded, and follow-up work.
5. **Test evidence:** commands/checks, environments, results, and intentionally untested areas.
6. **Screenshots or recordings:** required for visible UI states, including mobile, error, offline, keyboard/focus, and relevant languages; omit sensitive data.
7. **API examples:** required for contract changes, showing request, success, error, compatibility, and generated/OpenAPI changes when applicable.
8. **Migration/rollout notes:** schema, data, content, model, prompt, feature flag, deployment order, rollback, or “not applicable.”
9. **Impact statements:** security, privacy, accessibility, AI/model/LLM, offline/synchronisation, performance, and operations.
10. **Known limitations and risks:** unresolved uncertainty, accepted debt with issue, and fallback.
11. **Documentation:** documents, ADRs, contracts, model cards, or runbooks updated.

“No impact” must be a considered answer with a short reason, not an omitted section.

## Author responsibilities

- Keep the PR focused and small enough to review safely; split independent changes.
- Self-review the diff, remove dead/debug/temporary content, and check generated or lockfile changes when present.
- Confirm boundaries from [Monorepo architecture](../architecture/monorepo-architecture.md) and standards from [Coding standards](coding-standards.md).
- Provide reproducible evidence, not only “works locally.”
- Request the right owners: component plus specialist reviewers for contracts, security, privacy, accessibility, data, safety content, or AI.
- Respond to each review thread and avoid force-pushing over active review without warning.
- Revalidate after material review changes and keep the description current.
- Confirm the [definition of done](definition-of-done.md) before merge.

## Reviewer responsibilities

- Understand the issue and acceptance criteria before approving.
- Review correctness, failure and offline states, architecture, access control, privacy, accessibility, tests, observability, performance, migrations, documentation, and AI safety as applicable.
- Verify evidence and inspect relevant code/contracts rather than relying on the description.
- Label preference as non-blocking and explain risk for blocking comments.
- Request specialist review when outside personal competence.
- Do not approve with unresolved blocking threads or checks that no longer represent the latest change.

## Approval requirements

Proposed baseline:

- At least one qualified reviewer other than the author for every PR.
- Code-owner approval for affected component boundaries once owners are configured.
- Additional specialist approval for authentication/authorisation, sensitive data, safety content, model release, LLM policy, public contracts, schema migrations, or architecture decisions.
- Author approval does not count toward required independent review.

Exact counts, code owners, and emergency rules are **to be decided** and later enforced through repository settings.

## Merge blockers

Do not merge when any of the following applies:

- acceptance criteria are unmet or scope changed without approval;
- required review or future CI checks are missing/failing;
- a blocking thread is unresolved;
- tests are absent for material behaviour or fail nondeterministically without an owned resolution;
- an architecture boundary or contract compatibility rule is violated;
- known security, privacy, personal-data, secret, accessibility, data-loss, or evidence-integrity risk is unresolved;
- LLM output can invent safety advice, model uncertainty is hidden, or unreviewed corrections can train a model;
- offline retry can duplicate canonical actions or local state is represented as verified;
- migrations, rollback, prompt/model/content versions, or operational impact are undocumented where relevant;
- documentation is stale or known limitations are hidden; or
- the branch contains unrelated/generated noise that prevents effective review.

## Suggested PR checklist

```markdown
- [ ] Issue and acceptance criteria linked
- [ ] Scope and limitations documented
- [ ] Tests and manual evidence provided
- [ ] UI screenshots/API examples provided or not applicable explained
- [ ] Security and privacy impact reviewed
- [ ] Accessibility impact reviewed
- [ ] AI and safety-content impact reviewed
- [ ] Offline and idempotency impact reviewed
- [ ] Migration, rollout, and rollback documented
- [ ] Contracts, ADRs, and user/engineering docs updated
- [ ] Definition of done satisfied
```
