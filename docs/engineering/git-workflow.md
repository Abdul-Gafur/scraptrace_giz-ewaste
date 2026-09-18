# Git workflow

## Status

This workflow is proposed for team approval. It creates no repository protection or automation in Phase 2.

## Main branch

- The team must treat `main` as protected and keep it releasable or clearly marked documentation-only during foundation phases. Repository-level enforcement is still to be configured.
- Direct pushes, force pushes, and history rewrites to `main` are prohibited.
- Changes reach `main` through reviewed pull requests that satisfy the [pull-request guide](pull-request-guide.md).
- Required checks and approval counts are to be configured later; safety, security, privacy, data, contract, or architecture changes require the relevant owner.

## Branches

Use short-lived branches from an up-to-date `main`. One branch should address one coherent issue. Delete it after merge.

```text
feat/<issue-number>-<description>
fix/<issue-number>-<description>
docs/<issue-number>-<description>
refactor/<issue-number>-<description>
test/<issue-number>-<description>
chore/<issue-number>-<description>
```

Examples:

```text
feat/42-offline-record-queue
fix/87-duplicate-handover-confirmation
docs/18-safety-content-review
test/63-llm-grounding-evaluation
```

Descriptions use lower-case kebab-case and explain intent. Do not use personal names or vague branches such as `updates`.

## Commits

Use Conventional Commits:

```text
<type>(optional-scope): <imperative summary>
```

Allowed common types are `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, and `ci`. `build` or `ci` does not authorise adding configuration outside the phase scope.

ScrapTrace examples:

```text
docs(engineering): define offline testing standards
feat(records): preserve local id during synchronisation
fix(safety): reject responses without approved source metadata
test(vision): add low-confidence category cases
refactor(api): isolate location-provider adapter
```

- Keep commits logically coherent and reviewable.
- Use an imperative, lower-case summary without a trailing period.
- Explain motivation, consequences, or migration in the body when the summary is insufficient.
- Use `BREAKING CHANGE:` only with an approved compatibility plan.
- Do not include credentials, personal data, production exports, restricted images, generated model binaries, or unsupported mock business data.
- Temporary “work in progress” commits may exist on a branch but should be cleaned by squash before merge.

## Keeping a branch current

- Fetch and incorporate `main` before requesting final review when the branch is stale or conflicts are likely.
- Prefer rebasing a private branch; do not rewrite a branch others consume without coordination.
- Resolve conflicts by understanding both changes. Never discard another contributor's work merely to make the merge clean.
- Rerun relevant checks after resolving conflicts.

## Merge strategy

Squash merging is the **proposed default**. The squash commit follows Conventional Commits and references the issue through the pull request. This keeps `main` readable while allowing iterative branch commits.

A non-squash strategy requires an explicit repository decision—for example, preserving a meaningful release history. Merge commits created only to update a feature branch are discouraged.

## Reverts and urgent fixes

- Prefer a revert PR for a harmful merged change so history remains traceable.
- An urgent fix still needs issue/incident context, focused review, tests proportionate to risk, and follow-up for any temporarily deferred evidence.
- Never weaken branch protection or bypass a required safety/security reviewer solely for speed. The emergency approval process is **to be decided** before production operation.
