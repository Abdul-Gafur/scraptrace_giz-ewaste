# ScrapTrace web application

`apps/web` is the role-aware, multilingual frontend foundation for ScrapTrace. It provides routing, reusable application shells, contract-backed service boundaries, deterministic development mocks, design tokens, accessibility support, and test tooling. Complete collection, handoff, review, and reporting workflows are intentionally outside this milestone.

## Technology stack

- Next.js App Router and React
- Strict TypeScript and Tailwind CSS with semantic CSS custom properties
- next-intl, TanStack Query, React Hook Form, and Zod
- MSW, Vitest, Testing Library, jest-axe, Playwright, and axe-core
- `@scraptrace/contracts` for shared domain and service contracts

## Prerequisites and setup

Use Node.js `20.19` or newer in the supported engine ranges and npm `10` or newer. From the repository root:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/en`. The root URL redirects to the explicit default locale.
Playwright uses its installed Chromium build when available (`npx playwright install chromium`) and otherwise falls back to an installed stable Chrome browser.

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run format
npm run format:check
npm run test
npm run test:e2e
npm run contracts:generate
npm run contracts:check
```

The production build uses Next.js with webpack because the managed development environment blocks the internal process/port used by Turbopack's CSS worker.

## Environment variables

Copy `.env.example` to `.env.local` only when an override is needed.

| Variable                            | Exposure     | Purpose                                                    |
| ----------------------------------- | ------------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_MODE`              | Browser-safe | `mock` in development or `http` for the future API adapter |
| `NEXT_PUBLIC_API_BASE_URL`          | Browser-safe | Future public API base URL; never include credentials      |
| `NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS` | Browser-safe | Enables query inspection in development only               |

Mock service composition is disabled in production. Secrets must never use a `NEXT_PUBLIC_` prefix or be read from client components.

## Structure

```text
src/
├── app/[locale]/        Locale routes, layouts, loading and error boundaries
├── auth/                Development session and centralized route policy
├── components/          UI primitives, shells, navigation and feedback states
├── config/              Validated environment configuration
├── features/            Feature-owned interface orchestration
├── i18n/                Routing, navigation and formatting helpers
├── lib/                 Small frontend utilities and query keys
├── providers/           Query and application composition providers
├── services/            Ports, deterministic mocks and future HTTP adapters
└── test/                Test setup and foundation tests
```

Routes own composition and metadata, not mock data or domain rules. Features must not import another feature's private implementation. `components/ui` remains domain-neutral. Services are selected at the composition boundary so pages do not import mocks.

## Routes and role shells

| Route                             | Shell                  | Contract role                  |
| --------------------------------- | ---------------------- | ------------------------------ |
| `/[locale]`                       | Public                 | Anonymous                      |
| `/[locale]/sign-in`               | Public/auth            | Anonymous development fixture  |
| `/[locale]/collector`             | Mobile-first collector | `collector`                    |
| `/[locale]/recycler`              | Operational            | `recycler`                     |
| `/[locale]/review`                | Operational            | `programme_reviewer`           |
| `/[locale]/management`            | Operational            | `programme_manager`            |
| `/[locale]/administration/safety` | Operational            | `safety_content_administrator` |
| `/[locale]/administration/ml`     | Operational            | `data_ml_reviewer`             |

`src/auth/route-policy.ts` is the single frontend policy map. It uses contract roles, permissions, and contextual permission evaluation. These checks improve interface behavior only. Every future API must independently authenticate and authorize role, programme, facility, resource, operation, and returned fields. The current session provider is explicitly development-only.

## Design tokens and responsive behavior

Semantic tokens live in `src/app/globals.css`. Components consume background, surface, text, border, primary, status, focus, radius, shadow, touch-target, and container tokens. No repository Figma export was available, so the SRS-approved fallback palette is used.

The collector shell keeps capture, records, locations, profile, and home navigation persistent on small screens, then moves navigation to the side on larger screens. Operational roles receive a sidebar on desktop and a scrollable mobile alternative. Logical CSS properties preserve directionality.

## Internationalization

Message bundles cover English (`en`), French (`fr`), Arabic (`ar`), and Portuguese (`pt`). Locale routing always uses a visible prefix, with English as the default. Contract language metadata controls document direction: Arabic renders `dir="rtl"`; other supported languages render `dir="ltr"`.

Visible route text comes from message bundles. Tests compare their complete key shape so required translations cannot silently disappear. Formatting helpers use `Intl` for dates, numbers, and currency.

## Contracts and services

The frontend imports only the public `@scraptrace/contracts` entry point. Service parameters and results are inferred from exported schemas. Mocks parse incoming requests and outgoing fixtures; an invalid fixture fails immediately.

Composition exposes authentication, recovery records, vision appraisal, safety guidance, nearby locations, handoff, processing, review, reporting, and synchronization. Offline storage, connectivity, cached guidance, mutation queue, and synchronization-status ports remain separate from business state.

To replace a mock service:

1. Implement the matching port under `services/http`.
2. Validate each untrusted response with the exported contract schema.
3. Map safe error envelopes at the HTTP boundary.
4. Select the HTTP implementation in `ServiceProvider`.
5. Keep pages and feature components unchanged.

## Server state and errors

TanStack Query uses stable key factories, a 30-second mock-data stale time, bounded retry, no mutation retry, and development-only tools. Contract error envelopes drive retry decisions; non-retryable validation, permission, state, integrity, and idempotency failures are not globally retried.

Reusable feedback components cover loading, empty, recoverable error, permission denied, offline, pending synchronization, action required, not found, and unexpected failures without exposing internal details.

## Testing and accessibility

Unit/component tests validate contract imports, valid and invalid fixtures, locale key parity, direction, route policy, feedback states, and accessible forms. MSW supplies deterministic HTTP handlers. Playwright runs desktop and mobile smoke tests for both shells, keyboard navigation, locales, RTL, and axe-core checks. Contract tests continue to run from the root and package directory.

The foundation includes semantic landmarks, a skip link, visible focus, keyboard-operable navigation, 44-pixel touch targets, labelled form controls, live error/status regions, text plus icons for status, reduced-motion handling, and localized language, direction, and titles. Automated checks complement manual keyboard and screen-reader review.

## Security and privacy

- Environment input is runtime-validated and public variables are separated by naming and usage.
- Headers restrict framing, object sources, referrers, browser capabilities, remote images, and content sources.
- Production selects the HTTP boundary, never development mocks.
- Fixtures contain no token, secret, real identity, precise personal location, or public evidence URL.
- React renders escaped text; the app does not use `dangerouslySetInnerHTML`.
- Client policy is not treated as an authorization boundary.

## Intentionally out of scope

This foundation does not implement real authentication or API calls, camera capture, uploads, inference, LLM calls, IndexedDB, service workers, actual synchronization, complete feature workflows, payments, EPR credits, database access, or deployment infrastructure.
