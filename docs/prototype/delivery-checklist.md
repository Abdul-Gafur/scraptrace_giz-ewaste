# Hackathon delivery checklist

## How to use this checklist

This is the SRS release gate for the hackathon application. It does not indicate that any item currently passes. Record an owner, dated evidence link, and result for each applicable item; “not applicable” requires approval and a rationale. Any unsafe guidance, exposed secret or personal data, broken access boundary, lost/duplicated evidence, or misleading verification claim blocks delivery.

## Release identity and scope

- [ ] Release identifier, commit, build time, environment, component versions, model/dataset versions, prompt/policy version, and safety-card version are recorded.
- [ ] Required, optional, deferred, simulated, and excluded capabilities match the [hackathon scope](../product/prototype-scope.md).
- [ ] Known limitations and accepted residual risks have owners and are visible in the product and demonstration.
- [ ] No release wording implies production readiness, official EPR credits, recycler certification, guaranteed income, exact image-derived value/weight, real mobile-money payment, or government integration.

## Complete product journey

- [ ] The rehearsed journey covers image capture, category suggestion, confidence, correction, approved safety information, controlled LLM explanation, indicative price range, participating location, record/QR, delivery/measured weight, processing evidence, and complete journey display.
- [ ] Household guidance, collector delivery selection, recycler handover, programme review, and programme results have tested authorised paths.
- [ ] Loading, empty, low-confidence, unsupported, denied, stale, retry, conflict, and failure states are understandable and recoverable where applicable.
- [ ] Programme totals distinguish pending, flagged, rejected, unsynchronised, recycler-confirmed, programme-approved, and verified records.

## Computer vision and responsible AI

- [ ] Dataset rights, manifest, split integrity, labels, exclusions, and known representativeness gaps are documented.
- [ ] The released model is evaluated on an immutable held-out set with per-category metrics, confusion, calibration/confidence behaviour, failure slices, latency, and version/checksum.
- [ ] The candidate achieves macro-F1 of at least 0.70 and no category recall below 0.50, or is blocked and clearly not represented as accepted.
- [ ] Classification versus detection claims match the implemented model and available annotations.
- [ ] Low-confidence, unsupported, and correction paths are tested; corrections do not trigger immediate unreviewed learning.
- [ ] No image output is presented as exact weight, value, composition, ownership, hazard status, or processing proof.

## Safety content and LLM controls

- [ ] Every available category-language safety card has a named accountable approver, authoritative source metadata, version, review date, and review status.
- [ ] Retrieval is category/language constrained and the LLM is tested for grounding, omissions, additions, injection, hazardous requests, medical advice, invented locations/status, and malformed provider output.
- [ ] Rendered output is structurally validated and safely encoded; sources and version remain visible.
- [ ] Provider timeout, refusal, invalid output, absent network, and absent approved content follow the defined safe fallback without invented safety facts.
- [ ] All required safety and language reviewers approve the exact released content and policy versions.
- [ ] Every prohibited-output test falls back safely; no unapproved safety claim is displayed.

## Offline and data integrity

- [ ] Capture and local draft/queue behaviour work on agreed devices with weak or unavailable internet.
- [ ] Cache presence, age, and limitations are visible for safety cards, guides, and directory information.
- [ ] Restart, storage pressure, interruption at each sync/upload stage, timeout, retry, reordered operations, authentication expiry, rejection, and recovery are tested.
- [ ] Idempotency and local-to-canonical mapping prevent duplicate effects; conflicts do not silently overwrite evidence.
- [ ] Locally saved, server received, recycler confirmed, programme approved, and verified states remain distinct.

## Security and privacy

- [ ] Threat-model controls applicable to the release are implemented and reviewed.
- [ ] Authentication and role/programme/resource authorisation are tested through public interfaces, including object-reference guessing and QR replay/disclosure.
- [ ] Upload type, size, malware/content, metadata, access, retention, and deletion controls are tested as applicable.
- [ ] Images, locations, personal data, provider prompts, logs, caches, exports, and backups follow approved minimisation and retention decisions.
- [ ] Logs, traces, errors, screenshots, fixtures, build artefacts, and repository history contain no secrets, tokens, personal data, restricted images, or production exports.
- [ ] Secret scanning and dependency/security review have current evidence; exposed credentials are revoked rather than merely removed.
- [ ] Private vulnerability and operational incident routes are tested, and named responders can access required systems.

## Accessibility, language, and mobile use

- [ ] Critical flows pass automated checks and manual keyboard, focus, screen-reader, zoom/reflow, non-colour, touch-target, and status-announcement review.
- [ ] Agreed phones, browsers, viewport sizes, camera flows, and constrained network conditions are exercised.
- [ ] Released languages are reviewed for meaning, completeness, layout, truncation, and right-to-left behaviour where applicable.
- [ ] English, French, Arabic, and Portuguese interface and safety-content bundles are present, reviewed, and selectable.
- [ ] Confidence, price, safety, participation, verification, simulation, and offline status use clear language understandable without colour alone.

## Tests and evidence

- [ ] Required static, unit, component, integration, contract, end-to-end, security, accessibility, offline, performance, and AI evaluation checks pass or have explicitly accepted exceptions.
- [ ] The exact release completes the critical end-to-end journey in the target environment.
- [ ] Contract compatibility and data migrations, if any, are verified with rollback or forward-recovery evidence.
- [ ] Open defects are triaged; no release-blocking defect remains; results and exceptions are retained with the release.
- [ ] Local save completes within 2 seconds for at least 95 of 100 attempts without accepted-data loss.
- [ ] Prediction completes within 5 seconds for at least 95 of 100 valid compressed-image attempts on the documented host/network.
- [ ] Non-AI API p95 is at most 2 seconds with 20 concurrent demonstration users and an error rate below 1%.
- [ ] Seeded dashboard first-useful render completes within 5 seconds and record lists are paginated.
- [ ] Ten defined interruption scenarios recover without losing acknowledged work; repeated/reordered requests create one canonical effect.
- [ ] The controlled judging-window availability result meets the 99% objective and is not presented as a production SLA.

## Demonstration data and external services

- [ ] Every demo account, image, location, price reference, record, review example, and evidence artefact is fictional, synthetic, challenge-provided with permitted use, or expressly authorised and documented.
- [ ] Fictional/simulated content is visibly labelled and cannot be mistaken for a real business, certification, payment, processing event, or person.
- [ ] Provider terms, quotas, regional/privacy constraints, API keys, and fallback behaviour are reviewed.
- [ ] Licence and attribution obligations for source, datasets, images, maps, models, fonts, content, and dependencies are satisfied; unresolved repository licence status is disclosed.

## Deployment and operational readiness

- [ ] Target environment, region, domain, access policy, data classification, secret store, owner, cost guardrails, and expiry/teardown plan are approved.
- [ ] Build artefacts are traceable and promoted without rebuilding; configuration and secrets are externalised.
- [ ] Health/readiness checks, privacy-safe logs/metrics/traces, critical alerts, time synchronisation, and audit-event capture are verified.
- [ ] Backup/restore needs, rollback or forward-fix procedure, feature/provider disable controls, and data-compatibility constraints are rehearsed.
- [ ] Post-deployment smoke checks cover access control, capture, guidance fallback, record/QR, handover, evidence, review, reporting, and observability.

## Demonstration and submission readiness

- [ ] The [demo journey](demo-journey.md) is rehearsed within the allotted time on the presentation device and network.
- [ ] A privacy-safe backup recording or screenshots, cached approved guidance, controlled model output, manual location fallback, and pre-created journey are available and accurately labelled.
- [ ] Presenter roles, transitions, narration, reset procedure, failure decisions, and audience questions are rehearsed.
- [ ] Submission links, repository visibility, branch/tag, credentials, organiser accounts, judging permissions, time-zone deadlines, file limits, and required forms are verified.
- [ ] Public-repository review confirms no internal notes, personal data, secrets, restricted assets, unsupported claims, or unintended licences are exposed.
- [ ] Root and documentation indexes, setup/run instructions once applicable, architecture, requirements, API/contracts, model/data cards, safety provenance, security, operations, limitations, and demo materials match the release.

## Sign-off

| Review area | Named owner | Result and date | Evidence or accepted exception |
|---|---|---|---|
| Product and claims | To be assigned | Pending | To be added |
| Engineering and tests | To be assigned | Pending | To be added |
| AI/model | To be assigned | Pending | To be added |
| Safety content and language | To be assigned | Pending | To be added |
| Security and privacy | To be assigned | Pending | To be added |
| Accessibility | To be assigned | Pending | To be added |
| Operations and deployment | To be assigned | Pending | To be added |
| Delivery/submission | To be assigned | Pending | To be added |

Final named go/no-go authority, organiser requirements, and exception approval process remain to be assigned. No unchecked checklist should be represented as a completed release review.
