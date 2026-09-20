# ADR-008: Frontend application architecture

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** Web engineering; platform architecture; design-system and accessibility owners

## Context

ScrapTrace needs a phone-first collector experience, desktop operational workspaces, explicit offline and synchronization states, four supported languages including Arabic, and runtime-valid consumption of the shared contracts. The repository accepts a monorepo and `packages/contracts` as the source of cross-boundary schemas, but it did not select frontend tooling or a workspace package manager.

The foundation must preserve replaceable integration boundaries and demonstrate production build, accessibility, and test behavior without presenting development mocks as production authentication or API security.

## Decision

Use npm workspaces with one root lockfile and no build orchestrator. Implement `apps/web` with Next.js App Router, React, strict TypeScript, Tailwind CSS semantic tokens, next-intl, TanStack Query, React Hook Form with Zod, MSW, Vitest and Testing Library, and Playwright with axe-core.

Organize frontend code by responsibility:

- `app` owns routes, metadata, layouts, and server/client boundaries;
- `features` owns feature-specific interface orchestration;
- `components/ui` owns reusable domain-neutral primitives;
- `services/ports` owns typed application-facing interfaces;
- `services/mocks` owns deterministic, contract-parsed development behavior; and
- `services/http` owns future transport adapters.

Server components are the default for route composition. Client components are limited to interaction, form state, browser-backed providers, and browser APIs. Pages depend on composed interfaces, not concrete mocks.

Locale prefixes are mandatory for English, French, Arabic, and Portuguese. Contract language metadata controls document direction. English is the default and explicit fallback. Message bundles retain identical required-key shapes.

Collector routes use mobile bottom navigation with a desktop side adaptation. Operational roles share a responsive shell. A centralized policy map uses contract roles and permissions for interface routing; it is not an authorization boundary.

## Options considered

### npm workspaces and Next.js App Router

| Dimension        | Assessment                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| Complexity       | Medium; one JavaScript workspace and one application framework                |
| Offline fit      | Good boundary support; persistence and service worker remain later milestones |
| Contract fit     | Direct TypeScript and Zod package consumption                                 |
| Accessibility    | Semantic React ecosystem plus automated browser checks                        |
| Replacement cost | Service ports isolate the future HTTP implementation                          |

**Pros:** aligns with the SRS proposal, repository boundaries, locale routing, server/client separation, and shared contracts.

**Cons:** App Router requires care around client bundles; Next's default Turbopack build is incompatible with the managed environment's internal-port restriction, so the production script uses the supported webpack builder.

### React with Vite

| Dimension        | Assessment                                                 |
| ---------------- | ---------------------------------------------------------- |
| Complexity       | Lower framework surface                                    |
| Offline fit      | Good, with routing and rendering decisions required        |
| Contract fit     | Equivalent TypeScript consumption                          |
| Replacement cost | More decisions for routing, metadata, and server rendering |

**Pros:** simpler client-only build and mature tooling.

**Cons:** requires separate locale routing, metadata, server-rendering, and deployment conventions already covered by Next.js.

### Separate frontend repository

| Dimension            | Assessment                                         |
| -------------------- | -------------------------------------------------- |
| Complexity           | High contract publishing and coordination overhead |
| Contract fit         | Requires registry or linking workflow              |
| Change visibility    | Lower for cross-component changes                  |
| Repository alignment | Conflicts with ADR-001                             |

**Pros:** stronger repository-level isolation.

**Cons:** weakens atomic contract/frontend changes and contradicts the accepted monorepo boundary.

## Trade-off analysis

This decision favors explicit framework conventions and cross-workspace verification over a smaller client-only setup. It does not adopt global client state, a service worker, or IndexedDB before a concrete need exists. npm scripts remain direct; Turborepo or Nx would add machinery without a demonstrated need.

The service layer introduces interfaces early because mock-to-HTTP replacement is a current requirement. Feature UI remains minimal so the boundary is proven without prematurely fixing complete workflows.

## Consequences

- Root commands build and verify contracts before the web consumer.
- One root `package-lock.json` governs JavaScript workspaces.
- Contract changes fail frontend compilation or mock validation at clear boundaries.
- Locale, direction, shell, feedback, and accessibility behavior are available to feature milestones.
- Mock session and service providers must never be enabled as production authentication or authority.
- A future offline milestone can implement existing storage and queue ports without moving feature pages.
- HTTP adapters must validate untrusted responses and map the standard safe error envelope.
- Dependency-graph automation should be added when feature growth justifies it.

## Security and privacy impact

Only `NEXT_PUBLIC_*` configuration reaches client code. Security headers restrict framing, remote images, referrers, capabilities, and content sources. Fixtures use fictional labels and opaque identifiers. No tokens, public evidence URLs, precise personal locations, or real personal information are included. Client route policies improve user experience only; future APIs must enforce role, programme, facility, object, and field scope.

## Action items

- [x] Establish npm workspaces and the root lockfile.
- [x] Implement locale routing, tokens, shells, service ports, deterministic mocks, and tests.
- [x] Validate strict types, lint, unit tests, browser accessibility, contracts, and build.
- [ ] Implement the collector journey against the established service ports.
- [ ] Select production authentication and HTTP authorization boundaries.
- [ ] Validate the approved Figma export when available and update semantic tokens.
- [ ] Decide service-worker and local persistence technology in the offline milestone.

## Related documents

- [Monorepo structure](ADR-001-monorepo-structure.md)
- [Contract source of truth](ADR-002-contract-source-of-truth.md)
- [Role and permission boundaries](ADR-006-roles-permissions.md)
- [Standard service responses](ADR-007-service-responses-errors.md)
- [Frontend README](../../apps/web/README.md)
