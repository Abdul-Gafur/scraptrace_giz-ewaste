# Architecture decision records

Architecture Decision Records (ADRs) capture significant, durable choices and their trade-offs. They supplement the [architecture documentation](../architecture/system-overview.md); they do not replace the authoritative [Concept Note](../../concept_note.md).

## Status values

- **Proposed:** Under review and not authoritative.
- **Accepted:** Approved for the stated scope.
- **Deprecated:** No longer recommended, but retained for history.
- **Superseded:** Replaced by a later ADR, which must be linked.

## Process

1. Copy [ADR-template.md](ADR-template.md) and assign the next sequential number.
2. Describe context, decision, alternatives, consequences, security/privacy impact, and follow-up actions.
3. Use an ISO `YYYY-MM-DD` date and name accountable roles or people where known.
4. Link requirements and related ADRs with relative links.
5. Mark the ADR `Proposed` until authorised owners accept it.
6. Do not rewrite an accepted decision to hide history; supersede it with a new ADR when the decision changes. Minor clarification may be appended with a dated note.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-001](ADR-001-monorepo-structure.md) | Monorepo structure | Accepted | 2026-09-18 |
