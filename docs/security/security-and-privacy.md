# Security and privacy

## Status

The [SRS security and privacy requirements](../product/non-functional-requirements.md#security) are binding acceptance criteria for the hackathon application. This repository currently contains documentation only; the controls below are not yet implemented or tested.

## Security baseline

- Use HTTPS for all non-local traffic and protect credentials, session material, provider keys, and signing secrets outside source and client bundles.
- Enforce role-, programme-, facility-, object-, action-, and state-based access on the server. UI hiding is not authorisation.
- Use secure session handling and protection appropriate to the chosen authentication mechanism, including CSRF controls where cookie authentication is used.
- Validate and safely render all input, uploads, filenames, metadata, provider output, and LLM output.
- Restrict evidence objects to authorised access; public object listing and permanent public URLs are prohibited.
- Apply request-size, rate, and abuse controls to authentication, upload, QR lookup, AI, search, and export boundaries.
- Keep dependencies, images, and providers under review; critical unresolved vulnerabilities block release.
- Record privacy-safe security events and maintain an incident and vulnerability-reporting route before external use.

## Privacy baseline

ScrapTrace collects only what is necessary for a stated workflow. Identity, contact details, precise location, images, recovery evidence, review history, and audit data are not public dashboard data. Location permission must be contextual and optional where a manual area can meet the need. Image metadata that is not required must be removed or ignored.

Public reporting uses aggregates with reviewed geography, time, category, and small-group rules. Participation in recovery-record creation does not automatically consent a user's image or correction to model training. Dataset admission requires a separate consent or lawful-basis record and reviewer decision.

## Local and offline data

The PWA may keep drafts, queue metadata, approved safety cards, directory data, and previously validated guides locally to support weak connectivity. Local data must be user-scoped, minimised, integrity-checked, and cleared on sign-out or expiry according to policy. Shared-device risk, storage quota failure, browser eviction, and cached-content freshness must be visible and tested. The SRS baseline retains an abandoned local draft for no more than 30 days unless a user deletes it sooner.

## Images and evidence

Treat images as restricted untrusted input. Validate format and size, strip unnecessary metadata, isolate private storage, authorise each access, and maintain checksums or equivalent integrity evidence. Operational images do not enter a training dataset automatically. The client target is at most 2 MB per compressed evidence image; server limits remain configurable and visible.

## LLM privacy

Send only the approved safety-card fields, target language, allowed transformation, and non-identifying technical metadata. Never send identity, contact data, images, precise location, recovery evidence, prices, programme decisions, secrets, or unrelated user text. Full prompt and response bodies are not logged by default. Provider training, retention, region, and deletion terms require approval before use.

## Retention baseline

Non-production submitted and rejected records default to 12 months, generated LLM responses to 90 days, and operational logs to 30–90 days. These SRS baselines require a confirmed owner and enforcement design before data is collected. Audit, safety provenance, dataset lineage, and legal preservation may need separate justified schedules; see [data retention](../data/data-retention.md).

## Third parties and transfers

Before using an identity, map, storage, monitoring, LLM, payment, government, or directory provider, review data sent, purpose, terms, provider training, retention, region, subprocessors, security, incident notification, cost, exit, and fallback. Provider schemas remain behind owned interfaces.

## Verification

Release evidence includes threat modelling; authentication and horizontal/vertical authorisation tests; upload and object-access tests; input and output encoding; secret scanning; dependency review; log redaction; retention checks; offline cache review; and LLM data-minimisation tests. Formal production readiness, legal compliance, or certification cannot be claimed from the hackathon controls alone.
