# Dependency management

## Purpose and authority

This document is authoritative for future third-party packages, frameworks, runtimes, model artefacts, actions, and hosted SDKs. No dependency manager or dependency is installed in Phase 2.

## Before adding a dependency

The pull request must document:

- the specific capability and why it belongs in this component;
- alternatives considered, including standard library, existing dependency, simpler local code, and provider-neutral interface;
- expected runtime or development scope, bundle/image/model impact, transitive footprint, and operational needs;
- maintenance activity, release cadence, project governance, documentation quality, and ecosystem adoption;
- known advisories, vulnerability response history, provenance/signing posture, and abandonment risk;
- licence and notice obligations, including model/dataset terms where applicable;
- privacy/data flow, telemetry, hosted service calls, and data-use terms;
- owner, update plan, exit/replacement plan, and tests at the owned adapter boundary.

Do not introduce two libraries for substantially the same capability without a consolidation plan or demonstrated distinct needs.

## Approval level

- Small, established development tools require component-owner review.
- Runtime dependencies require component-owner and security/licence review proportionate to risk.
- Major frameworks, databases, model runtimes, package managers, hosted core services, or dependencies that shape architecture require an ADR.
- Safety, identity, cryptography, payment, data-transfer, and AI-provider dependencies require specialist review.

## Versions and lockfiles

- Declare direct versions according to an approved ecosystem policy; do not use unconstrained “latest” ranges.
- Commit the canonical lockfile once a package manager is selected and use frozen/reproducible install modes in future CI.
- Never edit generated lockfiles by hand. Review unexpected source, registry, checksum, script, or transitive changes.
- Pin container actions/images and model artefacts by immutable identity/checksum when adopted, not mutable tags alone.
- Keep model weights, datasets, and large artefacts out of normal package registries/repository unless an approved storage and licence policy says otherwise.

Exact pinning and update cadence are **to be decided** per ecosystem after TypeScript/Python tooling is accepted.

## Production and development scope

Classify packages as runtime/production, development/build, test/evaluation, or optional. A tool used only for linting or testing must not enter a runtime image or browser bundle. Browser dependencies receive explicit bundle, permission, network, and client-secret review.

## Security and licence lifecycle

- Review advisories before merge and continuously after adoption through a future approved process.
- Triage by exploitability, reachability, data/safety impact, and available mitigation—not severity score alone.
- Record accepted risk with owner, compensating control, expiry, and upgrade/removal issue.
- Verify licences for direct and relevant transitive packages, datasets, models, fonts, maps, and generated assets.
- Do not upgrade through a breaking release without release notes, compatibility tests, migration, and rollback.
- Automated update tooling may propose changes but cannot replace review and tests.

## Provider SDKs and adapters

Keep LLM, map, object-storage, and future integration SDKs behind ScrapTrace-owned interfaces. Provider-specific types must not leak into domain contracts. Test timeout, rate-limit, malformed output, privacy, and fallback behaviour so the dependency can be replaced.

## Removal

Remove an unused dependency promptly with its imports, configuration, adapter, transitive-only overrides, notices if no longer needed, and documentation. Confirm the lockfile no longer includes it and that the replacement does not retain unused permissions or data flows.

## Periodic review

Once implementation begins, assign owners to review dependencies for maintenance, advisories, licence changes, deprecations, end-of-life, usage, and replaceability. Review cadence and tooling remain to be approved.
