# ADR-004: Identifier QR payload and integrity semantics

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** Platform architecture; security and data owners

## Context

Offline creation needs collision-resistant identifiers before server contact. QR payloads must not reveal personal data. The Concept Note's changing “special code” must not imply that a changing digest is the stable record identity.

## Decision

Use client-generated RFC 9562 UUIDv7 values for offline-created records, events, evidence and mutations. Human references are separate display values. QR payloads contain contract version, record UUID and an opaque URL-safe lookup token only; possession grants no authority.

Use `sha256:<lowercase-hex>` digests over deterministic canonical JSON. Object keys are sorted recursively; arrays retain order; non-finite numbers and cycles are rejected. The record integrity payload contains initial immutable identity, capture, category and prediction facts. Revisions, synchronization attempts, current state and other operational metadata are excluded. Corrections and amendments retain the previous digest and append attributable events. Evidence content has its own SHA-256 digest.

## Alternatives considered

### Server-generated IDs only

Rejected because offline records need stable identity before connection.

### Sequential IDs in QR codes

Rejected because they increase enumeration and disclosure risk.

### Hash the entire mutable record

Rejected because normal synchronization and lifecycle updates would obscure which original facts changed.

## Consequences

IDs are sortable and available offline; digests are reproducible across browser and Node environments through Web Crypto. A digest detects byte-level/canonical-data change but does not prove that an image, actor claim, time or real-world event is truthful.

## Security and privacy impact

No name, phone number or location appears in a QR payload. Opaque lookup tokens still require authentication, authorisation, replay controls and rotation/revocation policy. UUIDv7 reveals approximate creation time and must not be treated as a secret.

## Follow-up actions

- [ ] Define lookup-token issuance, rotation and expiry in the API design.
- [ ] Decide whether canonical JSON should adopt an external standard before cross-language signing.

## Related documents

- [Threat model](../security/threat-model.md)
- [Recovery record](../data/recovery-record.md)

