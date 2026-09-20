# ADR-002: Contract source of truth and schema generation

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** Platform architecture; affected component owners

## Context

Web, API, workers, vision and safety services need one runtime-validatable contract without duplicating TypeScript types or provider-specific models. The SRS requires versioned shared schemas and OpenAPI-compatible output. No TypeScript or workspace tooling was previously selected.

## Decision

`packages/contracts` owns strict Zod 4 runtime schemas. Public TypeScript types are inferred from those schemas. Zod's native Draft 2020-12 JSON Schema generation produces committed artifacts in `schemas/`; a drift check compares regenerated output byte-for-byte. Public exports pass only through `src/index.ts`. Wire fields use `snake_case`, consistent with the API design standard. The package uses strict TypeScript, ESM and package-local npm tooling until repository-wide workspace tooling is selected.

## Alternatives considered

### TypeScript interfaces as canonical

Rejected because interfaces do not validate untrusted runtime input and require a second schema source.

### JSON Schema or OpenAPI authored first

Viable for language-neutral governance, but rejected for this first TypeScript package because inference and refinements would require additional generation or duplicated domain code.

### Zod plus a third-party schema converter

Rejected because Zod 4 provides maintained native JSON Schema generation, avoiding another dependency.

## Consequences

Consumers get runtime validation and inferred types from one definition. Generated artifacts can support Python/OpenAPI consumers. Zod becomes a runtime dependency, and unsupported schema constructs must be avoided or explicitly adapted. Package-level npm is not yet a repository-wide workspace decision.

## Security and privacy impact

Strict objects reject unexpected fields at trust boundaries. Generated schemas contain structure, not secrets or personal data. Schemas do not replace server-side authorisation or semantic validation.

## Follow-up actions

- [ ] Select repository-wide workspace, formatting and linting tooling before additional TypeScript packages are added.
- [ ] Compose generated schemas into an OpenAPI document when API routes are designed.

## Related documents

- [API design standards](../engineering/api-design-standards.md)
- [Monorepo architecture](../architecture/monorepo-architecture.md)

