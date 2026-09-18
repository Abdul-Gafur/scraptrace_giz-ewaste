# Collaboration guide

## Status

This is the proposed team collaboration baseline. Repository permissions, named maintainers, and board automation remain to be approved.

## Issue ownership and assignment

- Work begins from an issue with a problem statement, scope, acceptance criteria, dependencies, and relevant product/architecture links.
- One directly responsible owner coordinates an issue. Contributors may share tasks, but ownership of completion and communication is explicit.
- Before assignment, confirm that the issue is ready: unresolved product, safety, data, or architecture decisions are either answered or recorded as blockers.
- Assign yourself only when you can make timely progress. If work stalls, update the issue and release or share ownership rather than leaving it silent.
- Sensitive areas—safety content, access control, privacy, verification, model release, and external integrations—also name required specialist reviewers.

## Coordinating overlapping work

Before changing a shared contract, schema, safety card, state model, common package, or high-traffic file:

1. Identify linked issues and active branches.
2. Comment on the issue with intended files/interfaces and expected timing.
3. Agree which change lands first and who updates dependent work.
4. Prefer one contract change with coordinated consumers over competing definitions.
5. Rebase or refresh frequently enough to discover conflicts early; never overwrite another contributor's work to resolve them.

## Blockers and escalation

- Record a blocker as soon as it prevents the next meaningful step. State the decision or access needed, impact, owner, and latest useful date.
- Raise product-scope questions to product ownership; architecture/boundary questions to architecture owners; safety claims to the safety-content owner; data rights to data/privacy owners; security risks to the security owner.
- A blocker affecting the critical demonstration journey or another contributor should also be posted in the team's agreed communication channel.
- Do not bypass review, invent policy, or weaken safety/privacy controls to maintain velocity.

## Architectural disagreement

1. Restate the requirement and constraints, separating facts from preferences.
2. Compare the smallest viable alternatives using correctness, boundary fit, security/privacy, offline behaviour, operational cost, and reversibility.
3. Test a narrow assumption when evidence can resolve the disagreement.
4. Ask the accountable architecture owner to decide if consensus is not timely.
5. Record a significant or durable decision in an [ADR](../decisions/README.md); record dissent and consequences without personal attribution or blame.

## Review etiquette

- Review the change, not the author. Ask questions when intent is unclear and explain the risk behind blocking comments.
- Prefix optional preferences with `non-blocking:`. Do not make personal style a merge condition.
- Authors respond to every unresolved thread with a change, evidence, or reasoned disagreement; reviewers close threads they own.
- Keep scope focused. Create follow-up issues for worthwhile unrelated improvements unless the current change is unsafe without them.
- Never approve code you do not understand in a risk-critical area. Ask for a smaller change or specialist review.

## Handover of unfinished work

An unfinished-work handover includes:

- issue and branch/PR links;
- completed, remaining, and deliberately excluded scope;
- current behaviour and known broken states;
- decisions made and unresolved questions;
- tests run and failures;
- local setup or non-secret state needed to continue;
- risks, temporary code, and files likely to conflict; and
- the safest next action.

Do not pass credentials, personal data, or uncommitted private datasets in a handover.

## GitHub board status

The proposed workflow is `Backlog` → `Ready` → `In progress` → `In review` → `Done`, with `Blocked` as an explicit state rather than a label hidden in comments.

- The issue owner updates status when reality changes.
- `Ready` means acceptance criteria and dependencies are actionable.
- `In review` means the PR is ready, self-reviewed, and includes required evidence.
- `Done` requires the [definition of done](definition-of-done.md), not merely merged code.
- Board choice, field names, and automation are **to be decided**; until configured, use equivalent issue labels/comments.

## Scope changes

If implementation reveals a scope change, stop that portion and document the reason, user impact, alternatives, and effect on acceptance criteria. Product ownership approves product-scope changes; architecture owners approve boundary changes; regulated or safety claims require specialist approval. Update the issue and related documentation before treating changed scope as accepted.

## Respectful feedback

Follow the [Code of Conduct](../../CODE_OF_CONDUCT.md). Be specific, timely, evidence-based, and generous about intent. Make space for contributors to ask basic questions, acknowledge uncertainty, and correct decisions without blame.
