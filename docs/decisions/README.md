# Architecture decision records

Architecture Decision Records (ADRs) capture significant, durable choices and their trade-offs. They supplement the [architecture documentation](../architecture/system-overview.md); they cannot override the authoritative [final SRS](<../product/ScrapTrace_Software_Requirements_Specification (2).docx>). The [Concept Note](../../concept_note.md) remains the original context source.

## Decision lifecycle

- **Before acceptance:** Under review and not authoritative.
- **Accepted:** Approved for the stated scope.
- **Deprecated:** No longer recommended, but retained for history.
- **Superseded:** Replaced by a later ADR, which must be linked.

## Process

1. Copy [ADR-template.md](ADR-template.md) and assign the next sequential number.
2. Describe context, decision, alternatives, consequences, security/privacy impact, and follow-up actions.
3. Use an ISO `YYYY-MM-DD` date and name accountable roles or people where known.
4. Link requirements and related ADRs with relative links.
5. Keep the ADR under review until authorised owners accept it.
6. Do not rewrite an accepted decision to hide history; supersede it with a new ADR when the decision changes. Minor clarification may be appended with a dated note.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-001](ADR-001-monorepo-structure.md) | Monorepo structure | Accepted | 2026-09-18 |
| [ADR-002](ADR-002-contract-source-of-truth.md) | Contract source of truth and schema generation | Accepted | 2026-09-20 |
| [ADR-003](ADR-003-recovery-record-lifecycle.md) | Recovery-record lifecycle and event model | Accepted | 2026-09-20 |
| [ADR-004](ADR-004-identifiers-qr-integrity.md) | Identifier, QR payload and integrity semantics | Accepted | 2026-09-20 |
| [ADR-005](ADR-005-offline-sync-idempotency.md) | Offline synchronization and idempotency | Accepted | 2026-09-20 |
| [ADR-006](ADR-006-roles-permissions.md) | Role and permission boundaries | Accepted | 2026-09-20 |
| [ADR-007](ADR-007-service-responses-errors.md) | Standard service response and error contracts | Accepted | 2026-09-20 |
| [ADR-008](ADR-008-frontend-architecture.md) | Frontend application architecture | Accepted | 2026-09-20 |
