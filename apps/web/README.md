# ScrapTrace web application

`apps/web` is the role-aware, multilingual ScrapTrace frontend. All six contract roles have working screens: a collector captures and submits a recovery record, a recycler resolves its QR code and records the handoff and processing, a programme reviewer decides flagged records, a programme manager reports and exports, a safety-content administrator authors and publishes approved guidance, and a data and model reviewer inspects model metadata and stored corrections. Every screen calls a typed service; no screen carries fixed sample data.

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

Set `PLAYWRIGHT_BASE_URL` (for example `http://localhost:3000`) to run `npm run test:e2e` against an already running dev server instead of starting one; Next.js allows only one dev server per checkout.

### Shells, navigation and the component showcase

- `src/navigation/navigation-config.ts` is the single source for role-aware navigation (labels, routes, icons, contract role and permission, active-route behaviour, mobile and desktop visibility). Components render what it returns and never check roles themselves. Hiding an item is not access control: backend authorization is mandatory (ADR-006).
- `src/components/layout` holds the public, authentication, collector, operational and administration shells. The last three share `AppShell`.
- `/[locale]/dev/components` is a development-only component showcase. `src/proxy.ts` returns 404 for `/dev` paths in production.
- `/[locale]/sign-in` submits credentials to the authentication service in HTTP mode. In explicitly enabled non-production mock mode it also offers development-only role accounts.

The production build uses Next.js with webpack because the managed development environment blocks the internal process/port used by Turbopack's CSS worker.

## Environment variables

Copy `.env.example` to `.env.local` only when an override is needed.

| Variable                            | Exposure     | Purpose                                             |
| ----------------------------------- | ------------ | --------------------------------------------------- |
| `NEXT_PUBLIC_API_MODE`              | Browser-safe | `mock` in development or `http` for the API adapter |
| `NEXT_PUBLIC_API_BASE_URL`          | Browser-safe | Public API base URL; never include credentials      |
| `NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS` | Browser-safe | Enables query inspection in development only        |

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
├── hooks/               Query and mutation hooks over the service ports
├── services/
│   ├── domain/          Pure rules: identifiers, digests, QR payload, flags, CSV, derivations
│   ├── local/           Browser-backed repository, seed and service implementations
│   ├── ports/           Typed application-facing service interfaces
│   ├── mocks/           Deterministic fixtures for tests
│   └── http/            Transport adapters for a real API
└── test/                Test setup, unit, integration and screen tests
```

Routes own composition and metadata, not mock data or domain rules. Features must not import another feature's private implementation. `components/ui` remains domain-neutral. Services are selected at the composition boundary so pages do not import mocks.

## Routes and role shells

| Route prefix                      | Shell                  | Contract role                  | Destinations                                                                           |
| --------------------------------- | ---------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| `/[locale]`                       | Public                 | Anonymous                      | Landing page                                                                           |
| `/[locale]/sign-in`               | Public/auth            | Anonymous development fixture  | Role preview                                                                           |
| `/[locale]/collector`             | Mobile-first collector | `collector`                    | Home, capture, records, record detail, nearby locations, account, clear device records |
| `/[locale]/recycler`              | Operational            | `recycler`                     | Dashboard, intake, records, record detail, processing form, processing queue, account  |
| `/[locale]/review`                | Operational            | `programme_reviewer`           | Queue, review detail, assigned records, decisions audit, system history                |
| `/[locale]/management`            | Operational            | `programme_manager`            | Dashboard, ledger, locations, price references, reports and CSV export, settings       |
| `/[locale]/administration/safety` | Administration         | `safety_content_administrator` | Card list, card editor, translations coverage, approval queue, published content       |
| `/[locale]/administration/ml`     | Administration         | `data_ml_reviewer`             | Correction queue, approved labels, model information, configuration, data exports      |

`src/auth/route-policy.ts` is the single frontend policy map. It uses contract roles, permissions, and contextual permission evaluation. These checks improve interface behavior only. The API must independently authenticate and authorize role, programme, facility, resource, operation, and returned fields. HTTP mode restores a secure-cookie session; mock mode uses an explicitly non-production development session.

## Design tokens and responsive behavior

Semantic tokens live in `src/app/globals.css`. Components consume background, surface, text, border, primary, status, focus, radius, shadow, touch-target, and container tokens. Tokens are extracted from the approved Figma file (`ScrapTrace-UI`); see `docs/frontend/figma-implementation-map.md` for the frame inventory, token table and documented deviations.

The collector shell keeps capture, records, locations, profile, and home navigation persistent on small screens, then moves navigation to the side on larger screens. Operational roles receive a sidebar on desktop and a scrollable mobile alternative. Logical CSS properties preserve directionality.

## Internationalization

Message bundles cover English (`en`), French (`fr`), Arabic (`ar`), and Portuguese (`pt`). Locale routing always uses a visible prefix, with English as the default. Contract language metadata controls document direction: Arabic renders `dir="rtl"`; other supported languages render `dir="ltr"`.

Visible route text comes from message bundles. Tests compare their complete key shape so required translations cannot silently disappear. Formatting helpers use `Intl` for dates, numbers, and currency.

## Contracts and services

The frontend imports only the public `@scraptrace/contracts` entry point. Service parameters and results are inferred from exported schemas. Mocks parse incoming requests and outgoing fixtures; an invalid fixture fails immediately.

Composition exposes authentication, recovery records, vision appraisal, safety guidance, nearby locations, handoff, processing, review, reporting, data exports, safety content, model administration, programme settings, synchronization and device-data controls. Offline storage, connectivity, cached guidance, mutation queue, and synchronization-status ports remain separate from business state.

### The browser-backed repository

In development mode the services are implemented by `services/local`, not by fixed fixtures. One `ScrapTraceRepository` holds every recovery record, every piece of evidence, the append-only event log, the idempotency ledger, safety cards, model configuration, stored prediction feedback and programme settings, persisted through `localStorage` so a refresh keeps the state. All six roles share that store, which is why a record a collector submits is the same record a recycler scans and a reviewer decides.

Each service is bound to one acting actor, so every call evaluates the contract permission rules for that actor through `isPermissionAllowed`. A call a role may not make is refused with the standard error envelope; hiding a control is a usability aid, never the check. `src/test/authorization.integration.test.ts` asserts the refusals at the service level for all six roles.

Initial demonstration data is produced by replaying the real journeys through the real services: the seed calls `createDraft`, `submit`, `confirmReceipt`, `submitProcessing` and `submitDecision`, so every seeded record carries the same evidence, audit events, flags and integrity digest that the same action by a user produces.

To replace a mock service:

1. Implement the matching port under `services/http`.
2. Validate each untrusted response with the exported contract schema.
3. Map safe error envelopes at the HTTP boundary.
4. Select the HTTP implementation in `ServiceProvider`.
5. Keep pages and feature components unchanged.

The Phase 1 HTTP adapter now covers authentication, collector records, evidence, history, QR lookup, handoff, processing and review decisions. See [`docs/frontend/screen-endpoint-matrix.md`](../../docs/frontend/screen-endpoint-matrix.md) for the route matrix and the backend/shared-contract gaps that still block real-API end-to-end verification.

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
- React renders untrusted text as escaped content. The sole HTML injection renders SVG produced by the pinned QR library from a contract-validated payload; no server HTML is inserted.
- Client policy is not treated as an authorization boundary.

## QR generation and intake

`src/features/shared/qr-code.tsx` renders the symbol as inline SVG with `qrcode-generator`, and `src/features/shared/qr-scanner.tsx` decodes it with `jsqr` from either a camera frame or a photograph the user chooses. The symbol encodes exactly the three fields of `QrPayloadSchema`: the contract version, the recovery-record identifier and an opaque lookup token. It never encodes a name, a telephone number or a location. Typing the human transfer code always works, so a declined camera permission or a browser without camera support never blocks intake.

## Intentionally out of scope

This frontend does not implement IndexedDB, a service worker, background synchronization, payments, EPR credits, database access or deployment infrastructure. The typed HTTP integration boundary and secure-cookie session experience are implemented, but most corresponding backend routes are not yet present; the endpoint matrix records that dependency precisely. Model training, retraining and deployment are outside it by design: a stored correction is labelled feedback for a future, separately released dataset.

In development mode the vision appraisal is derived deterministically from the image digest rather than run through the trained classifier, which lives in the Python service. It matches the contract exactly — seven scores, one highest-scoring category, a confidence equal to that score, and the registered model's real name and version — so correction, low-confidence routing and stored feedback behave as they will against the real service. It is not a second model and makes no claim about the image.
