# ScrapTrace

ScrapTrace is an offline-capable e-waste collection and traceability platform that connects identification, safety guidance, delivery, recycler evidence, and programme reporting.

## Why ScrapTrace exists

E-waste collection records are often fragmented or missing. Collectors, households, recyclers, and programme teams may lack a shared record of where an item was found, who collected it, where it was delivered, what it weighed, and what happened during processing. People may also struggle to find suitable collection locations or reliable safety information before handling an item.

ScrapTrace connects those steps in one mobile-friendly application. It helps a user capture an e-waste item, review an AI-assisted category suggestion, access approved safety guidance, view an indicative price range, find a participating location, create a QR-linked recovery record, and follow the record through handover and processing evidence.

## Core journey

1. Capture an e-waste image in the application.
2. Review the suggested category and confidence, then correct it when needed.
3. Read safety guidance grounded in approved content.
4. View a clearly labelled indicative price range.
5. Find a participating scrapyard, collection centre, or recycler.
6. Create an item or batch record with a QR reference.
7. Record recycler receipt, measured weight, final price, and processing evidence.
8. Review the complete journey and programme-authorised results.

ScrapTrace is more than an image classifier: its primary value is the linked evidence trail from collection to recycler processing.

## Get started

Clone the repository:

```bash
git clone https://github.com/Abdul-Gafur/giz-ewaste.git
cd giz-ewaste
```

There are no dependencies to install or services to start yet. For a documentation-first orientation, read:

1. [Concept Note](concept_note.md) — authoritative problem, users, solution, workflow, and limitations.
2. [Documentation index](docs/README.md) — entry point for all product and technical documentation.
3. [Hackathon scope](docs/product/prototype-scope.md) — the initial delivery boundary.
4. [System overview](docs/architecture/system-overview.md) — platform components and responsibilities.
5. [Implementation plan](docs/prototype/implementation-plan.md) — recommended delivery sequence.
6. [Contribution guide](CONTRIBUTING.md) — workflow and review expectations.

## Repository map

- `apps/`: web application and application API
- `services/`: computer-vision and controlled safety-assistant services
- `packages/`: shared contracts, UI, safety content, utilities, and configuration
- `data/`: governed sample-data area; no datasets are included
- `infrastructure/`: local-service and deployment definitions
- `docs/`: product, architecture, engineering, AI, data, security, operations, and [hackathon delivery](docs/prototype/README.md) documentation
- `tests/`: cross-component and end-to-end testing
- `scripts/`: repository maintenance and validation tooling

Each implementation directory currently contains a short ownership README describing what belongs there and who reviews it.

## Important boundaries

- AI category output is a suggestion and must expose uncertainty and correction.
- Safety explanations must remain grounded in reviewed safety content.
- Image analysis cannot determine exact weight, value, ownership, or processing outcome.
- Price ranges are indicative and are not offers or guaranteed income.
- A directory listing does not automatically make a location an approved recycler.
- Official EPR credits, recycler certification, real mobile-money payments, and government integrations remain outside the hackathon scope unless separately implemented and authorised.

## Project governance

See the [contribution guide](CONTRIBUTING.md), [security policy](SECURITY.md), [Code of Conduct](CODE_OF_CONDUCT.md), and [architecture decisions](docs/decisions/README.md).

