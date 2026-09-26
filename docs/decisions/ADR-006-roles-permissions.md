# ADR-006: Role and permission boundaries

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** Security architecture; programme and component owners

## Context

The SRS defines six application roles and requires server-side role and object authorisation. Role names alone are insufficient because collector ownership, recycler facility assignment and programme/review scope affect access.

## Decision

Define six user roles: collector, recycler, programme reviewer, programme manager, safety-content administrator and data/ML reviewer. Define stable, action-oriented permissions and a deny-by-default matrix. A pure helper also requires resource context: ownership, assigned facility, programme and review. The internal `system` actor may execute server-controlled lifecycle checks but is not a user role and receives no permission-matrix entry.

Services must authenticate actors and re-evaluate role, scope, resource, state and requested fields. Hiding interface controls is never authorisation. Programme managers do not automatically receive reviewer decisions; content administrators and data reviewers remain separated.

## Alternatives considered

### Role-only boolean checks

Rejected because they cannot enforce object, facility or programme boundaries.

### Attribute-based policy engine now

Deferred because no identity or deployment architecture exists; the typed matrix establishes semantics without choosing infrastructure.

### System administrator as a seventh business role

Rejected because the SRS defines it as operational privilege outside the seeded application roles.

## Consequences

Consumers share permission names and safe defaults. Services still own authoritative enforcement and may add stricter context. Future multi-role and delegated-access policy requires security review.

## Security and privacy impact

Least privilege, separation of duties and contextual scope reduce horizontal and vertical access risk. The helper is not a substitute for authentication, database filtering or field-level response shaping.

## Follow-up actions

- [ ] Map permissions to endpoint/resource policies when the API is designed.
- [ ] Decide multi-role, delegation and privileged-support policy before pilot use.

## Related documents

- [Access control](../security/access-control.md)
- [Component boundaries](../architecture/component-boundaries.md)

