# Engineering documentation

These documents define the engineering and collaboration baseline for ScrapTrace. They govern repository work; unresolved tools and numeric thresholds remain subject to team decisions. Product intent remains governed by the [Concept Note](../../concept_note.md) and [product documentation](../product/product-vision.md).

## Standards and workflow

- [Coding standards](coding-standards.md): repository-wide implementation rules
- [Collaboration guide](collaboration-guide.md): ownership, coordination, and escalation
- [Git workflow](git-workflow.md): branches, commits, and merge approach
- [Pull-request guide](pull-request-guide.md): author and reviewer requirements
- [Testing strategy](testing-strategy.md): test layers, critical journeys, and release evidence
- [Definition of done](definition-of-done.md): completion gate
- [Dependency management](dependency-management.md): dependency evaluation and lifecycle
- [Error handling and logging](error-handling-and-logging.md): failures, telemetry, and audit separation
- [API design standards](api-design-standards.md): public HTTP contract conventions
- [Documentation standards](documentation-standards.md): documentation ownership and maintenance

Repository contributors should begin with [CONTRIBUTING.md](../../CONTRIBUTING.md). Architecture boundaries are defined in [Monorepo architecture](../architecture/monorepo-architecture.md), and significant changes require an [ADR](../decisions/README.md).

## Authority and exceptions

Where two documents overlap, the topic-specific document is authoritative and `coding-standards.md` provides the repository-wide summary. An exception must be explicit in a pull request, explain risk and duration, name an owner, link an issue, and obtain review from the relevant owner. Convenience alone is not sufficient.
