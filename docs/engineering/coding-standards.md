# Coding standards

## Status and interpretation

These standards are **proposed for team approval** and apply to future ScrapTrace code. `Must` and `must not` are enforceable once approved; `should` requires a documented reason when not followed. Technology-specific rules apply only if that technology is adopted. Topic-specific documents linked from the [engineering index](README.md) are authoritative where they provide more detail.

## 1. Engineering principles

- **Correctness:** Implement accepted requirements and preserve domain invariants. A recovery record, prediction, estimate, measurement, and review decision are different facts and must never be conflated.
- **Clarity:** Prefer business terms and explicit control flow. A reviewer should not need to reconstruct hidden conventions.
- **Simplicity:** Choose the smallest design that satisfies current requirements and known risks. Do not add services or abstractions for hypothetical reuse.
- **Maintainability:** Keep ownership, dependencies, contracts, decisions, and failure modes visible. Optimise for safe change rather than fewest lines.
- **Security by design:** Validate boundaries, deny by default, use least privilege, protect secrets, and model abuse before exposing sensitive operations.
- **Privacy by design:** Minimise identity, location, and image data; document purpose, access, retention, and deletion before collection.
- **Accessibility:** Core experiences must target WCAG 2.1 AA and work with keyboard and assistive technology on the supported device matrix.
- **Testability:** Separate policy from I/O; inject time, randomness, storage, model, and provider dependencies.
- **Observability:** Important operations expose privacy-safe logs, metrics, trace context, health signals, and audit events appropriate to their purpose.
- **Reproducibility:** Builds, tests, model evaluations, content versions, and migrations identify inputs, tool versions, configuration, and artefact checksums.
- **Responsible AI:** Expose uncertainty, preserve corrections, ground safety explanations, evaluate category/language behaviour, and require human review where defined.
- **Separation of concerns:** Presentation, domain rules, persistence, provider adapters, and model concerns remain in their owned boundaries.
- **Avoid premature abstraction:** Accept small, temporary duplication before creating a shared abstraction whose variations are not understood.
- **Avoid duplicated business rules:** One authoritative domain policy decides state eligibility, verification, estimate semantics, and safety-card selection. Client validation may mirror rules only for usability.
- **Make uncertainty visible:** Low confidence, stale data, pending sync, estimated prices, incomplete evidence, and proposed status must be explicit.

DRY, SOLID, and design patterns are tools, not absolute rules. Apply them when they make responsibility, change, or testing clearer; reject them when they create indirection, false generality, or coupling.

## 2. Repository and module boundaries

Follow [Monorepo architecture](../architecture/monorepo-architecture.md):

```text
apps/web  -> packages/ui, packages/contracts, packages/shared, packages/configuration
apps/api  -> packages/contracts, packages/shared, packages/configuration
services/* -> packages/contracts, packages/shared, packages/configuration
services/safety-assistant -> packages/safety-content
tests -> public interfaces of apps/services and shared contracts
```

- A module's public interface is its documented exports or network contract. Everything else is private even when the language permits importing it.
- Applications and services must not import private files from another application or service. Cross-service calls use versioned contracts.
- `apps/web` owns presentation and client offline behaviour, not model training or server authority.
- `apps/api` owns application orchestration and persistence boundaries, not interface components or specialist model internals.
- `services/vision` owns model training, evaluation, versioning, and inference.
- `services/safety-assistant` owns approved-content retrieval, controlled LLM use, validation, and fallback.
- Shared packages must be narrow, stable, documented, and independent of applications/services. They must not contain workflows, private persistence models, or provider secrets.
- Presentation maps user intent to domain operations; domain code owns policy; infrastructure implements storage and providers behind interfaces.
- Dependency cycles are prohibited. Future tooling should enforce cycles and boundary rules, but review remains responsible when checks pass.
- A shared-contract change identifies consumers, compatibility, versioning, migration, tests, and rollout order. Breaking changes require approval and a transition plan.

## 3. Naming conventions

Names describe business meaning and avoid unclear abbreviations. Established domain abbreviations such as `api`, `qr`, `llm`, and `utc` are allowed where unambiguous.

| Item | Convention | Examples |
|---|---|---|
| Directories | lower-case kebab-case | `safety-assistant/`, `recovery-records/` |
| TypeScript files | lower-case kebab-case; component files may use PascalCase if tooling requires | `sync-status.ts`, `RecoveryRecordCard.tsx` |
| React components | PascalCase business nouns | `SafetyGuide`, `RecoveryRecordCard` |
| Hooks | camelCase beginning with `use` | `useOfflineQueue`, `useRecoveryRecord` |
| TypeScript types | PascalCase; no `I` prefix | `RecoveryRecord`, `SyncResult` |
| Python modules/packages | lower-case snake_case | `recovery_records.py`, `safety_content/` |
| Python classes | PascalCase | `RecoveryRecordService` |
| Python functions/variables | snake_case | `confirm_handover`, `model_version` |
| Constants | `UPPER_SNAKE_CASE` for immutable module values | `MAX_UPLOAD_BYTES` |
| Environment variables | `SCRAPTRACE_` plus `UPPER_SNAKE_CASE` | `SCRAPTRACE_DATABASE_URL` |
| API routes | plural lower-case kebab-case resources | `/v1/recovery-records/{record_id}` |
| Database tables/columns | plural snake_case tables; snake_case columns | `recovery_records`, `created_at` |
| Test files | mirror subject with framework suffix | `sync-status.test.ts`, `test_recovery_records.py` |
| Feature flags | lower-case kebab-case with owner/expiry in registry | `offline-recycler-confirmation` |
| Events | past-tense dotted domain name | `recovery-record.created`, `handover.confirmed` |
| Error codes | stable upper snake case, domain qualified | `RECOVERY_RECORD_NOT_FOUND` |

Avoid generic names such as `data`, `helper`, `manager`, or `utils` when a precise responsibility exists. Do not put an implementation name into a domain concept unless distinguishing adapters.

## 4. Code organisation

- Modules have one coherent reason to change and expose the smallest useful interface.
- Decompose when a file becomes difficult to understand, test, own, or review; no arbitrary file-length limit applies.
- Domain services express business operations. API handlers and UI components translate transport/interface concerns and remain thin.
- Inject time, randomness, storage, network, model, and provider dependencies through explicit interfaces.
- Prefer pure functions for calculations, validation, mapping, and state transitions where practical.
- Isolate side effects at boundaries. Do not hide network or persistence work in getters, render paths, imports, or constructors.
- Validate configuration once at process start and pass typed configuration. Do not scatter environment reads through domain code.
- Global mutable state is prohibited except for justified, encapsulated process infrastructure with controlled lifecycle and concurrency.
- Avoid hidden control flow through import side effects, service locators, or decorators that conceal material behaviour.
- Remove dead and commented-out code; version control preserves history.
- Temporary code must be safe, linked to an issue, assigned an owner, and state a removal condition. Technical debt left by a change must be linked to a prioritised issue.

## 5. TypeScript standards

- Enable strict TypeScript if adopted. Disabling a strict check requires an ADR or narrowly scoped, documented exception.
- `any` is prohibited unless an interoperability boundary makes it unavoidable; keep it local, justify it, and test it. Use `unknown` for untrusted values.
- Runtime-validate API responses, local storage, URLs, environment data, provider payloads, and deserialised messages.
- Handle `null` and `undefined` explicitly. A non-null assertion requires a proved invariant and explanation.
- Use discriminated unions for state machines and variant responses, including synchronisation and domain-error states. Handle them exhaustively.
- Avoid broad `as` assertions. Prefer validation, narrowing, `satisfies`, or typed constructors. Double assertions are prohibited outside documented compatibility shims.
- Use named domain types for identifiers, money/currency, weights/units, UTC timestamps, confidence, and record states when primitives could be confused.
- Runtime-validate configuration and export it as typed, immutable values without leaking server secrets into clients.
- Awaited operations require deliberate recovery, translation, or propagation. Floating promises are prohibited.
- Export only intentional public surfaces. Barrel files are limited to stable package APIs and must not conceal heavy dependencies or create cycles.
- Use `packages/contracts` for shared boundary definitions; do not recreate divergent transport types in consumers.

## 6. React and frontend standards

- Use functional components and standard hooks. Components focus on presentation or coordination, not persistence, model, or verification policy.
- Keep state with the narrowest owner. Use URL state for shareable navigation, form state for drafts, and an agreed server-state mechanism for remote cache.
- Do not copy server state into global UI state without a reconciliation rule. Offline records identify whether they are local, queued, or acknowledged.
- If Next.js is adopted, use server components by default where appropriate; add client components only for browser APIs, interaction, or local state. Server-only secrets/code never cross the client boundary.
- Hooks obey framework rules, use correct dependencies, avoid hidden side effects, and expose loading, cancellation, and failure states.
- Forms have accessible labels, field and summary validation, preserve recoverable input, and repeat authoritative validation on the server.
- Every data experience handles relevant loading, empty, error, success, stale, pending-sync, conflict, and offline states.
- Prefer semantic HTML to ARIA. All actions work by keyboard, have visible focus, and manage focus after dialogs, navigation, and validation failures.
- Never communicate confidence, verification, hazard, or status by colour alone. Include text or accessible symbols.
- Design mobile first for touch, camera, orientation, constrained bandwidth, the agreed device matrix, and Arabic right-to-left layout.
- Optimise measured bottlenecks: avoid unnecessary client code, image transfers, rerenders, and unbounded lists. Performance budgets require approval.
- Use error boundaries for unexpected render failures and recovery, not as a substitute for expected-error handling.
- Treat LLM output as untrusted. Render escaped text or sanitised allow-listed markup; never execute or directly inject provider HTML/Markdown.
- Put user-facing strings in the selected internationalisation system. Avoid concatenated translations; support plurals and locale-aware dates, units, and currency.
- Critical journeys require automated accessibility checks plus manual keyboard and screen-reader review.

## 7. Python standards

- Public functions, methods, and meaningful internal boundaries require type hints. Type-checker choice and strictness remain to be approved.
- Ruff formatting and linting are **proposed**, not adopted. Rules and exceptions must be repository-configured.
- Use Pydantic or an accepted equivalent for request, response, configuration, and provider validation if FastAPI/Python is adopted.
- Packages expose intentional public interfaces; applications/services do not import another component's internals.
- Put rules in domain/service layers. API handlers parse, authenticate/authorise, call a use case, and map results.
- Catch exceptions only to add context, translate, compensate, or recover. Empty handlers are prohibited.
- Inject repositories, providers, clocks, random sources, and model gateways at the composition boundary.
- Use context managers for resources and explicit transaction/file lifetimes.
- Use async only for actual non-blocking I/O. Never call blocking CPU/I/O work on an event loop.
- Public APIs and non-obvious modules/classes need concise docstrings for contracts, invariants, units, and raised domain errors.
- Mutable default arguments are prohibited; use `None` plus construction or a default factory.
- `except Exception` is limited to process/request boundaries for controlled logging and safe translation, followed by re-raise or an explicit terminal response.
- ML utilities control seeds where supported, record nondeterminism, sort inputs deterministically, and persist configuration/environment metadata.
- Notebooks and experiments stay outside production import paths. Production training/evaluation logic lives in tested modules.

## 8. API standards

[API design standards](api-design-standards.md) is authoritative.

- Public routes use `/v1`-style versioning and plural resource nouns. Non-resource actions require a justified subresource.
- If OpenAPI is adopted, contract and implementation change together.
- Validate path, query, header, body, upload, provider, and response data.
- Authentication establishes identity; authorisation separately checks role, programme, resource, and operation.
- Use standard HTTP semantics and stable machine-readable error codes. Never return internal stack traces or secret/provider details.
- Lists use bounded pagination and allow-listed filtering/sorting with deterministic tie-breakers.
- Retryable mutations use scoped idempotency keys and return consistent replay outcomes.
- Accept or create a correlation ID and return it; it is not authentication.
- Use RFC 3339 UTC timestamps with `Z`; preserve source timezone separately only where required.
- Uploads validate declared and actual type, size, dimensions/count when relevant, malware/content policy, and authorised paths.
- Apply risk-based rate limits and return safe `429` responses. Numeric limits are to be decided.
- Breaking changes require versioning/deprecation, consumer notice, compatibility tests, and removal criteria.

Proposed request:

```http
POST /v1/recovery-records
Idempotency-Key: 018f-example
X-Correlation-ID: 8a2d-example
Content-Type: application/json

{"client_record_id":"local-01HV...","record_type":"item","category":"television","count":1,"captured_at":"2026-09-18T09:15:00Z"}
```

Proposed success and error shapes:

```json
{"data":{"id":"rr_01K...","status":"submitted","created_at":"2026-09-18T09:15:04Z"},"meta":{"correlation_id":"8a2d-example"}}
```

```json
{"error":{"code":"RECOVERY_RECORD_INVALID_STATE","message":"The record cannot be confirmed in its current state.","details":[{"field":"status","reason":"must_be_submitted"}],"retryable":false},"meta":{"correlation_id":"8a2d-example"}}
```

These examples are documentation only and do not create an implemented API.

## 9. Database standards

- All schema changes use reviewed migrations. Never edit an applied migration; add a forward corrective migration.
- Wrap multi-step invariants in transactions with explicit isolation/concurrency semantics. Keep transactions short and exclude external calls.
- Use foreign keys, unique constraints for identity/idempotency, and check constraints for safe values/states where practical.
- Review indexes against real queries, write cost, storage, selectivity, and privacy; do not add speculative indexes.
- Use plural snake_case table names and snake_case columns.
- Store system timestamps in UTC. Include `created_at`/`updated_at` where meaningful; audit events also record actor and context.
- Status values follow a documented state machine; free-form status strings are prohibited.
- Soft deletion is not the default. Justify it with recovery, legal, audit, or user need and define visibility/retention.
- Define retention and deletion for images, location, audit, provider, and model-candidate data before pilot collection.
- Verification source evidence is append-only or versioned and never silently overwritten; corrections and reviews are new facts.
- Never copy production personal data into local development, fixtures, screenshots, or demonstrations.
- Concurrency-sensitive updates use version checks, locking, constraints, or compare-and-set; no silent last-write-wins for evidence.
- Prevent duplicates with client IDs, idempotency, constraints, canonical mapping, and review signals. Similarity is a flag, not proof of fraud.

## 10. Error handling

[Error handling and logging](error-handling-and-logging.md) is authoritative.

- **Domain errors** represent violated business invariants; **validation errors** represent unsafe/invalid input; **infrastructure errors** represent storage/runtime failure; **external-service errors** represent provider failure or invalid output.
- Classify errors as retryable or non-retryable at the boundary that knows recovery semantics.
- User messages explain what happened and the safe next action without internals. Diagnostics remain protected and correlation-linked.
- Errors must never be silently ignored. Intentional suppression needs rationale, a safe outcome, and a metric when material.
- Offline errors preserve work and distinguish unsent, retrying, conflicting, rejected, and acknowledged states.
- Vision failure permits manual category selection and approved fallback guidance, never fabricated confidence.
- LLM failure returns approved content/fallback; map failure offers cached/manual search; storage failure never marks evidence uploaded or complete.

## 11. Logging and observability

- Emit structured logs with timestamp, severity, service, environment, event name, correlation/request ID, safe entity references, outcome, duration, and stable error code where relevant.
- `DEBUG` is diagnostic and disabled/redacted normally; `INFO` records significant normal operations; `WARN` records degraded/recoverable conditions; `ERROR` records failed operations requiring investigation. Expected validation is not an error log.
- Propagate correlation IDs across API/service calls. Request IDs identify attempts; stable operation IDs identify idempotent intent.
- Audit events are durable, attributable records of business/security-significant actions. Operational logs diagnose systems and may have shorter retention; neither substitutes for the other.
- Define metrics for outcomes/latency, sync states, dependency health, review flow, uploads, model versions, LLM validation/fallback, and integrity failures without personal high-cardinality labels.
- Traces use privacy-safe attributes and explicit sampling/retention. Liveness and readiness checks expose no secrets or sensitive dependency detail.
- Record model version with inference; record prompt/policy, provider/model, and safety-card version with generated guides.
- Redact identity, precise location, tokens, credentials, request bodies, images/URLs, user-bearing prompts, and payment details. Hashing is not automatically anonymisation.

## 12. Security and privacy

- Validate and normalise untrusted input; encode output for its HTML, URL, JSON, SQL, shell, template, or log context.
- Use established authentication/session controls. Every sensitive operation separately enforces role-, programme-, resource-, and action-level authorisation.
- Deny by default and grant minimum data/provider permissions. Privileged access is exceptional and audited.
- Keep secrets outside source, images, fixtures, client bundles, QR payloads, logs, and errors; scope and rotate them.
- Treat uploads as untrusted: validate signature, size, and type; use server-owned names and isolated storage; scan/serve according to approved policy.
- Review dependencies before adoption and for security advisories throughout their lifecycle.
- Use secure defaults for cookies, headers, CORS, transport, cache, redirects, and errors once deployment is designed.
- Apply threat-based abuse and rate controls to authentication, upload, inference, LLM, lookup, and verification endpoints.
- Use parameterised queries and safe APIs; never concatenate untrusted SQL, shell, templates, or tool/model instructions.
- Test broken access control across roles, programmes, records, object references, and guessed identifiers.
- Prevent XSS with framework escaping and allow-listed sanitisation. LLM output is always untrusted.
- Protect state-changing browser requests from CSRF where cookie authentication or ambient authority applies.
- Minimise identity, location, images, and device metadata; document purpose, disclosure, access, and retention.
- Define image retention/deletion, legal/audit holds, and training separation before pilot use.
- Send an LLM only approved card content and minimum language/task context—never identity, precise location, unrelated images, or secrets.
- Training use requires documented rights/consent, provenance, operational-data separation, and authorised review.
- Fixtures contain no personal or production data; use synthetic or explicitly licensed samples with provenance.

## 13. Testing standards

Follow [Testing strategy](testing-strategy.md).

- Unit-test domain rules; integration-test persistence, HTTP, storage, queues, and adapters; contract-test every cross-boundary schema; keep a focused set of end-to-end critical journeys.
- Include accessibility, offline/interruption, authorisation/security, integrity, AI evaluation, and multilingual LLM safety tests.
- Make tests deterministic by controlling time, randomness, locale, network, and identifiers; document tolerated ML nondeterminism.
- Names describe precondition, action, and expected result, such as `rejects_handover_when_processing_evidence_is_missing`.
- Arrange, Act, Assert is the default structure when it improves readability.
- Fixtures are minimal, synthetic/licensed, scenario-specific, and free of personal data, credentials, and unsupported business claims.
- Mock at owned interfaces rather than internals. Prefer real parsers/validators and representative local dependencies in integration tests.
- Defect fixes include a regression test at the lowest effective layer and, where risk warrants, a broader journey test.
- Coverage is a supporting signal, not proof. Critical changed branches and failures need meaningful assertions regardless of numeric coverage; thresholds remain to be approved.

## 14. Computer-vision standards

- Version datasets and immutable manifests with source, rights, category definition, review state, exclusions, and checksums. Restricted images are not committed.
- Freeze and document the seven category definitions; changes require contract, product, safety-content, and evaluation review.
- Separate training, validation, and test data using leakage-resistant groups before experimentation. Near duplicates and related captures must not cross splits.
- Record preprocessing, augmentation, revision, dependencies, hardware, configuration, random seeds, and known nondeterministic operations.
- Track experiments with immutable run IDs, metrics, artefact references, and reviewer conclusions; tool choice remains to be decided.
- Report category-level metrics, confusion, calibration/confidence behaviour, failure slices, and limitations—not aggregate accuracy alone.
- Confidence thresholds are versioned policy backed by evaluation. Low confidence is visible and requires user confirmation/manual selection.
- Released models have unique versions, data/model/config checksums, evaluation, compatibility, approver, and rollback references.
- Measure latency and size on agreed targets. Edge evaluation also covers memory, battery, conversion parity, update integrity, and fallback.
- Preserve original prediction, confidence, model version, and correction. Corrections become training candidates only after permission and review.
- Deployed models never learn immediately from unreviewed corrections. Replacement requires scheduled training, evaluation, approval, and rollback.

## 15. LLM standards

- The approved safety card is the only safety source. Retrieval is constrained by confirmed/manual category, language, approved status, and current version.
- System instructions prohibit new safety facts, hazardous dismantling, medical diagnosis, exact-price promises, and unverified recycler claims.
- Version instructions, templates, retrieval and validation policy, provider/model, and approved-card input.
- Prefer structured output mapped to the five approved card questions plus provenance; validate schema and content before display.
- Return card/source metadata, approval/review date, language, and generated-versus-cached status where relevant.
- For missing content, provider failure, timeout, or failed validation, show approved source content or reviewed fallback; never fill gaps.
- Evaluate unsupported additions, omissions, hazardous instructions, prompt injection, translation meaning, refusal, and fallback across hackathon languages.
- Treat card and user text as data, delimit it, minimise it, disable unneeded tools, and reject attempts to override system policy.
- Language transformation may simplify, translate, or prepare read-aloud text but preserves prohibitions, uncertainty, and referrals.
- No medical diagnosis or personalised exposure treatment; use only reviewed referral/emergency wording.
- Price output may explain a supplied indicative range but never promise a sale, exact price, income, payment, or incentive.
- Location output uses checked directory records and status. The model must not invent, endorse, or certify a recycler.

## 16. Offline-first standards

- Assign a stable local record ID before submission and map it to one canonical server ID after acknowledgement.
- Explicitly represent local draft, queued, syncing, synced, retryable failure, conflict, and rejected states; final names follow the accepted contract.
- Retry only retryable errors with bounded backoff/jitter and user controls. Authentication, validation, and conflicts require deliberate resolution.
- Create a stable, scoped idempotency key before the first mutation and reuse it. The server persists one outcome for the defined lifetime.
- Resolve evidence conflicts through field/state policy and append history; never silently apply last-write-wins to category, weight, destination, confirmation, or evidence.
- Prevent duplicates with local IDs, idempotency, database constraints, canonical mapping, and review signals.
- Use UTC instants for ordering and preserve device timezone or clock uncertainty separately when needed. Device time alone is not verification proof.
- Pending UI states say whether data is local, queued, sent, received, or verified. “Saved” alone is insufficient.
- Interrupted synchronisation preserves acknowledged progress only when integrity can be validated; otherwise restart safely without duplicate canonical effects.
- A locally saved record is not server received, recycler confirmed, programme approved, or verified. Code, APIs, tests, and UI preserve these distinctions.

## 17. Documentation and comments

- Comments explain rationale, invariants, safety constraints, trade-offs, or external limitations—not obvious syntax.
- Public package, API, event, model, content, and configuration interfaces require maintained documentation and examples.
- Significant architecture changes require a new or superseding [ADR](../decisions/README.md).
- API changes update contracts, examples, compatibility notes, consumers, and tests in the same change.
- Model releases update model documentation, lineage, metrics, limitations, checksum, approver, and rollback information.
- Security/privacy decisions record threats, data, controls, residual risk, owner, and review date.
- Temporary work and documentation gaps reference an issue, owner, and completion/removal condition.
- Behaviour and documentation ship together; stale user, operator, contract, or architecture docs block completion.
- Follow [Documentation standards](documentation-standards.md) for headings, links, status language, ownership, and review.

## 18. Dependency standards

Follow [Dependency management](dependency-management.md).

- Every new dependency needs a use case, alternatives assessment, owner, maintenance/health check, advisory check, and licence review.
- Do not add overlapping libraries without a consolidation plan or clear distinct need.
- Commit accepted lockfiles and use reproducible install modes after package managers are selected; never hand-edit lockfiles.
- Separate runtime dependencies from development, test, and optional dependencies.
- Pin direct dependencies per the approved ecosystem policy and constrain transitives with lockfiles; automated update policy is to be decided.
- Remove unused packages, configuration, notices, and adapters promptly.
- Major frameworks, databases, model runtimes, externally hosted core services, and package-management changes require an ADR.

## 19. Code-review expectations

Approval is an engineering responsibility, not a formality. Reviewers assess, where applicable:

- correctness, edge cases, and accepted requirements;
- architecture boundaries, contracts, ownership, and safe rollout;
- authentication, authorisation, secrets, injection, abuse, and supply-chain risk;
- data minimisation, location/image handling, retention, consent, and disclosure;
- semantics, keyboard/focus, language/direction, mobile behaviour, and accessible status;
- error classification, user recovery, telemetry, and absence of silent failure;
- meaningful unit, integration, contract, end-to-end, offline, security, accessibility, and AI tests;
- measured performance and bounded resource use;
- naming, interfaces, dead/temporary code, maintainability, and dependency justification;
- updated contracts, docs, ADRs, model/prompt/content versions, and limitations;
- grounded LLM behaviour, model uncertainty, human review, and prohibited AI claims; and
- interruption, retry, idempotency, conflict, and local-versus-verified behaviour.

Reviewers must block unresolved correctness, security, privacy, evidence-integrity, unsafe-AI, data-loss, or architecture-boundary violations. Preferences not grounded in standards should be labelled non-blocking.
