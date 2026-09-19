# Technology decisions

Every technology in this document is **Proposed, not implemented**. No dependency, framework configuration, container, workflow, database, or provider is currently present. Selection should be recorded in separate ADRs after validation.

## Next.js, React, and TypeScript

- **Intended purpose:** Mobile-friendly web application, role-specific interfaces, client-side offline experience, and shared typed UI development.
- **Why it may fit:** React supports reusable interfaces; TypeScript can align client models with contracts; Next.js can combine routing and web delivery while supporting progressive-web patterns.
- **Alternatives:** React with Vite, Remix, SvelteKit, Vue/Nuxt, or a native/cross-platform mobile application.
- **Decision status:** Proposed.
- **Validation required:** Offline/service-worker behaviour, camera and storage support on target phones, right-to-left Arabic, accessibility, bundle/performance budgets, deployment model, and team familiarity.

## FastAPI and Python

- **Intended purpose:** Application API and/or Python-native service interfaces, particularly coordination with ML tooling.
- **Why it may fit:** Typed request validation, OpenAPI generation, asynchronous API support, and close fit with the proposed vision ecosystem.
- **Alternatives:** Node.js/TypeScript frameworks, Django, Flask, Go, Java/Spring, or .NET.
- **Decision status:** Proposed; whether both the application API and ML services use FastAPI is to be decided.
- **Validation required:** Authentication/authorisation design, background work, transaction patterns, operational skills, performance baseline, and contract governance.

## PostgreSQL with PostGIS

- **Intended purpose:** Transactional records, integrity, audit metadata, programme data, and geospatial participating-location queries.
- **Why it may fit:** Relational constraints and transactions suit linked evidence; PostGIS supports distance and geographic queries in the same governed store.
- **Alternatives:** PostgreSQL without PostGIS plus application/provider distance calculations, managed spatial databases, or other relational systems.
- **Decision status:** Proposed.
- **Validation required:** Exact spatial queries, hosting/region, migration ownership, backup/recovery, row/programme isolation, expected scale, and team operations.

## S3-compatible object storage

- **Intended purpose:** Captured images, scale/handover photographs, and processing evidence.
- **Why it may fit:** Separates large objects from transactions, supports checksums/lifecycle rules, and preserves provider choice through a common interface.
- **Alternatives:** Cloud-specific blob storage, self-hosted object storage, or database binary storage for the narrowly constrained hackathon scope.
- **Decision status:** Proposed.
- **Validation required:** Access controls, signed-operation design, encryption, region, retention/deletion, integrity, malware/content controls, cost, and offline-upload recovery.

## PyTorch or Ultralytics

- **Intended purpose:** Computer-vision experimentation, training, evaluation, and possible server inference for seven categories.
- **Why it may fit:** Python ecosystem, transfer-learning support, experiment flexibility, and export paths. Ultralytics may accelerate common classification/detection workflows but introduces framework and licensing considerations.
- **Alternatives:** TensorFlow/Keras, scikit-learn feature baselines, torchvision-only pipelines, managed training services, or classical computer vision where useful.
- **Decision status:** Proposed; task formulation and framework are not selected.
- **Validation required:** Dataset rights and form, classification versus detection need, baselines, per-category evaluation, calibration, reproducibility, compute, licence, maintainability, and deployment target.

## ONNX Runtime or TensorFlow Lite

- **Intended purpose:** Possible edge/browser/device inference to reduce connectivity dependence.
- **Why it may fit:** Portable optimised inference may support smaller models on constrained devices and reduce image transfer.
- **Alternatives:** Server inference, WebGPU/WebAssembly runtimes, native platform inference, or no edge inference for the hackathon release.
- **Decision status:** Deferred/proposed; not required until a validated model and device need exist.
- **Validation required:** Target browser/device support, model conversion parity, size, speed, memory, battery, privacy, update/version controls, and fallback.

## Provider-independent LLM integration

- **Intended purpose:** Explain, simplify, or translate approved safety-card content without coupling core logic to one provider.
- **Why it may fit:** Supports provider evaluation and replacement while centralising grounding, provenance, refusal, privacy, and fallback controls.
- **Alternatives:** Fixed reviewed translations only, template-based generation, a single provider SDK behind an internal adapter, or a locally hosted model.
- **Decision status:** Proposed.
- **Validation required:** Multilingual groundedness, harmful additions, latency, availability, data terms, residency, cost, provider/model versioning, caching, and approved-content-only enforcement.

## OpenAPI contracts

- **Intended purpose:** Versioned HTTP interface definitions among the web app, API, services, and tests.
- **Why it may fit:** Machine-readable schemas can support review, client generation, validation, compatibility testing, and documentation.
- **Alternatives:** GraphQL schemas, gRPC/Protocol Buffers, JSON Schema with handwritten HTTP definitions, or language-specific shared types.
- **Decision status:** Proposed.
- **Validation required:** Source-of-truth workflow, versioning/compatibility policy, code generation, error format, file/upload patterns, and Python/TypeScript tooling.

## OpenStreetMap-compatible mapping

- **Intended purpose:** Display participating locations, calculate proximity, and open directions while keeping programme directory status separate.
- **Why it may fit:** Open geographic standards and broad ecosystem can reduce proprietary coupling.
- **Alternatives:** Google Maps Platform, Mapbox, HERE, local GIS data, a list-only initial release, or hybrid providers.
- **Decision status:** Proposed.
- **Validation required:** Ghana coverage, geocoding and routing quality, attribution, tile/provider usage policy, offline/cache rights, rate limits, cost, accessibility, and location privacy.

## Docker

- **Intended purpose:** Future reproducible local services and packaging of independently deployable components.
- **Why it may fit:** Consistent runtime packaging can help coordinate Python, web, database, and service dependencies.
- **Alternatives:** Native local toolchains, dev containers, Nix, platform buildpacks, or provider-managed builds.
- **Decision status:** Proposed for a later phase; no Docker files exist.
- **Validation required:** Developer environments, image ownership, security scanning, architecture support, build times, secrets, and chosen hosting platform.

## GitHub Actions

- **Intended purpose:** Future automated documentation checks, tests, contract compatibility, security checks, model evaluation gates, and build validation.
- **Why it may fit:** Repository-native review automation and a broad action ecosystem.
- **Alternatives:** GitLab CI, CircleCI, Buildkite, Jenkins, other provider pipelines, or platform-native automation.
- **Decision status:** Proposed for a later phase; no workflow exists.
- **Validation required:** Repository host, permissions, protected environments, secret handling, runner/compute needs, untrusted contributions, model artefacts, cost, and supply-chain controls.

## Decision sequence

Suggested ADR order is: user/device and offline constraints; data/privacy model; API contract approach; web and API frameworks; database/spatial design; object storage; vision baseline/deployment; safety-assistant provider controls; mapping provider; then packaging and automation. This sequence is guidance, not an accepted implementation plan.
