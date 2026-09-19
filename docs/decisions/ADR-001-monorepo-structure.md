# ADR-001: Monorepo structure

- **Status:** Accepted
- **Date:** 2026-09-18
- **Owners:** Project owner; architecture ownership to be assigned

## Context

ScrapTrace spans a mobile-friendly web experience, an application API, computer vision, controlled safety/LLM behaviour, shared contracts and reviewed content, data governance, evidence workflows, and cross-component documentation. Changes to a category, safety-card schema, recovery record, or review state may affect several of these areas at once.

The project owner explicitly confirmed a target monorepo directory structure for Phase 1. The repository previously contained only the Concept Note and an empty root README. No build tooling, framework, runtime, deployment, or package manager is selected.

## Decision

Use one monorepo with these ownership areas:

- `apps/web` and `apps/api` for proposed application entry points;
- `services/vision` and `services/safety-assistant` for specialist service boundaries;
- `packages/ui`, `contracts`, `shared`, `safety-content`, and `configuration` for narrowly defined shared assets;
- `data`, `infrastructure`, `scripts`, and `tests` for governed repository-wide concerns; and
- `docs` for product, architecture, engineering, AI, data, security, operations, hackathon delivery, and ADR documentation.

Components may remain independently deployable. Applications and services must not import each other's private files; cross-service communication uses defined contracts. This decision accepts organisation and ownership boundaries only. It does not select frameworks, package management, build orchestration, hosting, or service topology.

## Alternatives considered

### Separate repositories per application or service

This could provide stronger repository-level isolation and independent release histories. It was not selected for the initial release because coordinated contract, content, documentation, and journey changes would require more cross-repository version and review overhead.

### One undifferentiated application directory

This would minimise initial folders. It was not selected because vision training, controlled safety content, user interfaces, API workflows, and shared contracts require different ownership and must not silently become one coupled codebase.

### Monorepo organised only by technical layer

A generic `frontend`, `backend`, and `ml` layout was considered less explicit about the safety-assistant boundary, reviewed safety content, contracts, and future independent deployment.

## Consequences

### Positive

- Cross-component changes and documentation can be reviewed together.
- Contracts, safety content, and shared UI have explicit owners.
- Repository-wide journey and compatibility tests have a natural home.
- Specialist runtimes can coexist without requiring a single deployment.

### Negative and trade-offs

- Ownership and dependency rules require active enforcement.
- Repository tooling may become more complex across TypeScript and Python ecosystems.
- A poorly governed shared package could create coupling.
- CI may eventually need change-aware execution to avoid unnecessary work.

### Risks

- Boundary erosion: mitigate with public contracts, ownership review, and future dependency checks.
- Accidental data or secret sharing: keep sensitive data out of shared packages and apply least privilege.
- Tooling selected too early: defer workspace/build decisions until technology validation.

## Security and privacy impact

A monorepo increases the importance of repository access control because documentation, application code, model logic, and infrastructure may coexist. Raw personal data, production exports, secrets, unlicensed images, and unrestricted model artefacts must not be committed. Code proximity does not authorise runtime data access. Security/privacy review remains component-specific, and deployment credentials must remain external.

## Follow-up actions

- [ ] Assign owners and required reviewers for each top-level boundary.
- [ ] Decide package/workspace and build tooling after framework validation.
- [ ] Define versioned contract and compatibility policies.
- [ ] Add dependency-boundary checks after code exists.
- [ ] Define data, safety-content, security, and AI governance before implementation or pilot data use.

## Related documents

- [Monorepo architecture](../architecture/monorepo-architecture.md)
- [Component boundaries](../architecture/component-boundaries.md)
- [Technology decisions](../architecture/technology-decisions.md)
- [Hackathon scope](../product/prototype-scope.md)
