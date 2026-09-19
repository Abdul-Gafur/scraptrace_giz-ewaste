# Component boundaries

These are the SRS-required logical boundaries. “Owned data” means the authoritative logical boundary; physical schemas and final team assignments remain to be decided.

## Mobile-friendly web application

- **Responsibility:** Present all six seeded role experiences; manage the service worker, user-scoped local cache and queued actions; expose permission, connectivity and exact synchronization states.
- **Owned data:** Ephemeral UI state, local drafts, encrypted/controlled offline queue, cached approved content and directory snapshots.
- **Public interface:** Browser user interface and calls conforming to API contracts.
- **Allowed dependencies:** `packages/ui`, `packages/contracts`, `packages/shared`, and `packages/configuration`.
- **Forbidden responsibilities:** Server authority, direct database access, model training, safety-content approval, or hidden verification decisions.
- **Likely owner:** Web/product engineering.

## Application API

- **Responsibility:** Authenticate and enforce object/role scope; coordinate records, server-controlled state transitions, review, reporting, deterministic imports, persistence, workers and provider adapters.
- **Owned data:** Canonical recovery-record metadata, role/programme associations, workflow states, reviews, audit references, and integration identifiers.
- **Public interface:** Versioned application API, proposed as OpenAPI-described HTTP.
- **Allowed dependencies:** Contracts, validated configuration, persistence/object-store adapters, and public vision, safety, and location interfaces.
- **Forbidden responsibilities:** Rendering interface components, training models, generating ungrounded safety advice, or exposing storage directly to clients.
- **Likely owner:** Backend/platform engineering.

## Computer-vision service

- **Responsibility:** Train, evaluate, version, and serve image-category models; return calibrated uncertainty and model identity.
- **Owned data:** Model definitions, evaluation configuration/results, model artefact metadata, dataset manifests, and training lineage. Dataset custody is governed separately.
- **Public interface:** Versioned inference and model-metadata contract; offline/edge artefact interface if later approved.
- **Allowed dependencies:** `packages/contracts`, configuration, authorised data, and governed model storage.
- **Forbidden responsibilities:** Recovery workflow, user authorisation, safety advice, price decisions, or automatic learning from raw corrections.
- **Likely owner:** ML engineering with data and responsible-AI review.

## Safety information and LLM service

- **Responsibility:** Retrieve an approved card, apply controlled explanation/translation, validate grounding, and provide approved fallback behaviour.
- **Owned data:** Prompt/policy versions, provider-neutral request metadata, grounding/evaluation results, and response provenance subject to privacy policy.
- **Public interface:** Category/language guide request and grounded response with card/provider/version metadata.
- **Allowed dependencies:** `packages/safety-content`, contracts, configuration, and approved LLM adapters.
- **Forbidden responsibilities:** Authoring safety truth at request time, vision inference, user records, or dismantling instructions.
- **Likely owner:** AI/backend engineering with mandatory safety-content ownership.

## Safety content package

- **Responsibility:** Canonical reviewed safety cards, translations, provenance, approval date, owner, and review date.
- **Owned data:** Versioned approved content and metadata.
- **Public interface:** Validated content schema and read-only retrieval artefacts.
- **Allowed dependencies:** Schema/validation tools and reviewed source references once selected.
- **Forbidden responsibilities:** LLM provider calls, user data, runtime workflow, or unreviewed generated content.
- **Likely owner:** E-waste safety/content team with localisation review.

## Database

- **Responsibility:** Durable transactional state and integrity for application records.
- **Owned data:** Accounts/roles, programme scope, directory metadata, record facts and states, measurements, review decisions, and audit metadata; exact schema is deferred.
- **Public interface:** Accessible only through owned API persistence interfaces, not directly by clients or other services.
- **Allowed dependencies:** Database engine and controlled migration/backup tooling after selection.
- **Forbidden responsibilities:** Binary image storage, application policy hidden in database triggers, model training, or public querying.
- **Likely owner:** Backend/data platform engineering.

## Object storage

- **Responsibility:** Durable storage for captured images and evidence objects with integrity and access metadata.
- **Owned data:** Image/evidence objects, checksums, storage metadata, and lifecycle state.
- **Public interface:** API-mediated or short-lived authorised object operations.
- **Allowed dependencies:** S3-compatible provider adapter and security/key controls.
- **Forbidden responsibilities:** Public buckets, business status decisions, permanent URLs containing credentials, or ungoverned dataset reuse.
- **Likely owner:** Platform engineering with privacy/security review.

## Location capability

- **Responsibility:** Maintain/search participating-location profiles and dated price references; isolate geocoding, straight-line distance, maps and directions providers.
- **Owned data:** Checked directory records, accepted types, hours, contacts, coordinates, verification state/date, price ranges/source/effective date and freshness.
- **Public interface:** Location search/profile contract through the application API.
- **Allowed dependencies:** PostGIS if selected, map-provider adapters, contracts, and programme-authorised directory sources.
- **Forbidden responsibilities:** Inferring recycler approval from proximity/listing, silently publishing unreviewed profiles, or tracking users beyond stated purposes.
- **Likely owner:** Backend/product operations with programme review.

## Recycler interface

- **Responsibility:** Role-specific receipt, weight, price, discrepancy, and processing-evidence workflows.
- **Owned data:** UI-local state only; canonical data belongs to the API boundary.
- **Public interface:** Web routes/forms using application contracts.
- **Allowed dependencies:** Web application facilities, UI components, and API contracts.
- **Forbidden responsibilities:** Overwriting collector evidence, self-certification, programme-wide reporting, or direct storage/database access.
- **Likely owner:** Web/product engineering with recycler workflow and security review.

## Programme dashboard

- **Responsibility:** Review queues, permitted journey inspection, status-separated aggregation, and programme management views.
- **Owned data:** UI filters/preferences only; reports remain API-owned projections.
- **Public interface:** Web dashboard using authorised reporting and review contracts.
- **Allowed dependencies:** Web/UI packages and API contracts.
- **Forbidden responsibilities:** Calculating unofficial EPR credits, including incomplete records in verified totals, or exposing collector identity publicly.
- **Likely owner:** Web/data-product engineering with programme and privacy review.
