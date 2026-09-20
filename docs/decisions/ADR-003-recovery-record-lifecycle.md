# ADR-003: Recovery-record lifecycle and event model

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** Platform architecture; product and backend owners

## Context

The SRS mixes `Saved offline` and `Pending synchronization` into one lifecycle diagram even though FR-OFF-003 defines synchronization separately. It also depicts `Completed` as terminal while FR-REV-007, FR-DSH-004 and BR-010 allow only `Approved and completed` in verified totals.

## Decision

Model business, handoff, processing, review and synchronization states as separate discriminated types. Business states are `draft`, `submitted`, `awaiting_handoff`, `received`, `processing_recorded`, `completed`, `under_review`, `approved_and_completed` and `rejected`. `Completed` means evidence-complete but not programme-approved; an unflagged record advances through a server/system check to `Approved and completed`. Flagged records advance through reviewer approval or rejection. Only `approved_and_completed` and `rejected` are terminal. Post-terminal corrections require a future reviewed-amendment event and never silently reopen or overwrite a record.

Every state-changing rule declares event, source state, required actor role, required evidence, target state, offline allowance and retry safety. A pure function evaluates the matrix without I/O.

## Alternatives considered

### Copy the SRS diagram literally

Rejected because network state would be confused with business truth and unflagged completion could never meet the verified-total rule coherently.

### Remove `Completed`

Rejected because it is an explicit SRS state and remains useful to express evidence completion before final server checks.

### Treat `Completed` as verified

Rejected because it conflicts with FR-DSH-004 and BR-010.

## Consequences

Clients can display network status without overstating recovery status. The extra system finalisation step makes the SRS ambiguity explicit. Services must append events and enforce the same matrix server-side.

## Security and privacy impact

Role and evidence checks prevent unauthorised transitions. The state machine does not itself authenticate actors or prove evidence truthfulness.

## Follow-up actions

- [ ] Seek an SRS editorial decision on whether `Completed` should remain a named state.
- [ ] Define the reviewed-amendment workflow before post-terminal changes are supported.

## Related documents

- [Recovery record](../data/recovery-record.md)
- [SRS parity notes](../product/srs-traceability.md#srs-interpretation-notes)

