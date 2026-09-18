# Contributing to ScrapTrace

ScrapTrace is currently establishing its engineering foundation. Contributions must preserve the documented product scope, architecture boundaries, safety controls, privacy, and distinction between proposed and implemented behaviour.

## Contribution flow

1. Select a ready issue with clear scope, acceptance criteria, and dependencies. Comment before starting and assign the work according to the [collaboration guide](docs/engineering/collaboration-guide.md).
2. Create a short-lived branch from current `main` using the [Git workflow](docs/engineering/git-workflow.md), for example `docs/42-offline-review-rules`.
3. Make focused changes that follow the [coding standards](docs/engineering/coding-standards.md). Do not include secrets, personal data, production exports, restricted datasets, or unrelated work.
4. Use Conventional Commits. Keep branch commits coherent; squash merging is the proposed default.
5. Open a pull request using the [pull-request guide](docs/engineering/pull-request-guide.md). Link the issue, map acceptance criteria to evidence, and disclose security, privacy, accessibility, AI, offline, migration, and documentation impacts.
6. Run the relevant checks described by the [testing strategy](docs/engineering/testing-strategy.md). Until automation exists, record reproducible manual/local evidence.
7. Request component and specialist reviewers where needed. Respond to every blocking thread and do not merge your own unreviewed change.
8. Confirm the [definition of done](docs/engineering/definition-of-done.md) before merge.

The `main` branch is intended to be protected; do not push to it directly. Repository protection, CI, code owners, contribution licensing, and exact approval counts are **to be decided**. All participants must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
