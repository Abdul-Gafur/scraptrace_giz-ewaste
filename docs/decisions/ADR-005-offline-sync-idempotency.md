# ADR-005: Offline synchronization and idempotency

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** Platform architecture; web and backend owners

## Context

Weak connectivity must not lose accepted local work or create duplicate canonical records. Evidence, handoff, processing and review facts cannot use hidden last-write-wins resolution.

## Decision

Queue each mutation with client mutation UUIDv7, record and device-instance IDs, local sequence, contract version, base server revision, mutation type and payload, creation time, scoped idempotency metadata, request digest and attempt state. Batch responses report each mutation independently as accepted, rejected, conflicting or retryable.

Scope idempotency by actor, operation and resource where applicable. Repeating the same key, scope and request digest returns the original logical result marked replayed. Reusing the same scoped key with a different digest returns `IDEMPOTENCY_CONFLICT`. Optimistic revisions detect stale writes. Conflicts preserve safe local/server metadata and require explicit refresh, review, merge, correction or retry; evidence and decisions never silently overwrite.

## Alternatives considered

### Last write wins

Rejected because ordering and network timing cannot safely decide evidence truth.

### Atomic whole-batch success

Rejected because one invalid mutation would make other results unclear and impede recovery.

### Idempotency by record ID alone

Rejected because one record has several distinct retryable operations.

## Consequences

Retries become deterministic and partial progress is visible. Servers must retain idempotency outcomes for a documented window; exact duration remains deferred pending offline-duration evidence and storage design.

## Security and privacy impact

Keys are opaque and contain no personal data. Request digests support equality checks but are not authentication. Conflict details are allow-listed to avoid leaking server records.

## Follow-up actions

- [ ] Set idempotency retention after field/offline testing.
- [ ] Define server persistence and cleanup when the API/database are implemented.

## Related documents

- [Offline-first design](../architecture/offline-first-design.md)
- [API design standards](../engineering/api-design-standards.md)

