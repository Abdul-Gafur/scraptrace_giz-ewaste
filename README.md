# ScrapTrace

ScrapTrace is a proposed offline-capable platform for identifying e-waste, providing controlled safety guidance, and tracing collection through verified recycler processing.

Many e-waste collections lack linked records showing origin, collector, handover, measured weight, and processing outcome. ScrapTrace proposes a mobile-friendly journey that captures an image, suggests and allows correction of a category, explains approved safety information, estimates a non-binding price range, locates a participating destination, creates a QR-linked record, and records handover and processing evidence.

## Status

Phase 1 establishes the monorepo structure and initial product and architecture documentation. No application, model, integration, or deployment implementation exists yet. See the [prototype scope](docs/product/prototype-scope.md) for required, optional, future, and excluded capabilities.

## Repository map

- `apps/`: proposed user-facing web application and application API
- `services/`: proposed computer-vision and controlled safety-assistant services
- `packages/`: proposed shared contracts, UI, content, utilities, and configuration
- `data/`: governed sample-data area; no datasets are included
- `infrastructure/`: reserved future local and deployment infrastructure
- `docs/`: [product](docs/product/product-vision.md), [architecture](docs/architecture/system-overview.md), and decision records
- `tests/` and `scripts/`: reserved cross-component testing and repository tooling

Start with the [documentation index](docs/README.md), the authoritative [Concept Note](concept_note.md), and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Current limitations

All technical choices and integrations are proposed unless an ADR says otherwise. The prototype must not be treated as proof of safe recycling, guaranteed income, an exact price, or automatic recycler approval. Official EPR credits, recycler certification, real mobile-money payments, and government integrations are future capabilities unless separately implemented and authorised.

Licence status: **To be decided**. No licence is granted by this repository at present.
