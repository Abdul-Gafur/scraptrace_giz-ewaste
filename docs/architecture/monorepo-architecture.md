# Monorepo architecture

## Decision status

The repository organisation is **Accepted** because the project owner explicitly confirmed the target monorepo structure for Phase 1. See [ADR-001](../decisions/ADR-001-monorepo-structure.md). Component implementations and build tooling do not yet exist.

## Why a monorepo fits

The platform's web, API, vision, safety, content, and evidence workflows change together. A monorepo makes contract changes, reviewed safety content, cross-component tests, and documentation visible in one review while retaining clear ownership boundaries. It does not require all components to share a runtime or deployment.

## Top-level ownership

| Directory | Ownership boundary |
|---|---|
| `apps/web` | Web/product engineering; mobile-friendly user experiences and offline client behaviour |
| `apps/api` | Backend/platform engineering; application workflows, persistence boundary, and authorisation |
| `services/vision` | ML engineering; training, evaluation, model release, and inference |
| `services/safety-assistant` | AI/backend plus safety reviewers; retrieval, grounding, LLM adapters, and fallbacks |
| `packages/ui` | Frontend/design system; reusable accessible interface elements |
| `packages/contracts` | Platform architecture; versioned cross-boundary definitions |
| `packages/shared` | Platform engineering; small domain-neutral utilities only |
| `packages/safety-content` | E-waste safety/content owners; reviewed cards, translations, and provenance |
| `packages/configuration` | Platform/operations; non-secret validated configuration conventions |
| `data` | Data stewardship; authorised samples and governance metadata |
| `infrastructure` | Platform/operations; future container and deployment definitions |
| `tests` | Quality engineering with component owners; cross-component and end-to-end checks |
| `docs` | Product, architecture, and relevant specialist owners |

## Allowed dependency directions

```text
apps/web  -> packages/ui, packages/contracts, packages/shared, packages/configuration
apps/api  -> packages/contracts, packages/shared, packages/configuration
services/* -> packages/contracts, packages/shared, packages/configuration
services/safety-assistant -> packages/safety-content
tests -> public interfaces of apps/services and shared contracts
infrastructure -> deployable outputs and documented configuration interfaces
```

Runtime calls from the web application go through the API's defined public contract. The API calls services through defined service contracts. A source-code dependency arrow does not authorise access to private internals or owned data.

## Mandatory boundaries

- `apps/web` must not contain model-training code.
- `apps/api` must not contain interface code.
- `services/vision` owns training, evaluation, and inference concerns.
- `services/safety-assistant` owns safety retrieval and controlled LLM use.
- `packages/contracts` owns shared interface definitions.
- `packages/safety-content` owns reviewed safety information and metadata.
- `packages/ui` owns reusable interface components.
- Applications must not import private files from other applications.
- Cross-service communication must use defined contracts.

## Contract management

Contracts should be provider-neutral, versioned, compatibility-tested, and reviewed by all affected owners. They should distinguish source evidence, user assertions, predictions, estimates, measurements, and review decisions. OpenAPI is proposed for HTTP interfaces; the source format and code-generation approach are **to be decided**.

## Coordinating changes

A change that crosses boundaries should update the contract first, identify compatibility and migration needs, update affected components in one coordinated review where practical, and include contract or journey tests. Safety-content changes additionally require domain approval; model changes require evaluation and release review. Ownership rules should eventually be enforced with repository review configuration, which does not currently exist.

## Independent deployment

The web app, API, vision service, and safety-assistant service may become independently deployable. Independence is a possibility, not a requirement to distribute every component for the hackathon release. The database, location capability, and dashboard may initially remain API/web modules. Deployment topology depends on latency, offline behaviour, cost, security, and team capacity validation.

## Preventing circular dependencies

- Shared packages must not depend on applications or services.
- Services must not import each other's private source; they communicate through contracts.
- Applications must not depend on one another's source.
- `packages/shared` must not become a home for domain workflows.
- Dependency-cycle checks should be added once a build system exists.

## What must not be shared

Do not share private persistence models, framework-specific service internals, authentication secrets, provider credentials, raw personal data, unrestricted image datasets, deployment state, model binaries, or unreviewed safety text through common packages. Reuse is not more important than ownership, least privilege, or an explicit public contract.
