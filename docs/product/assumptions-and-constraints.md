# Assumptions and constraints

The [approved SRS v1.1](<ScrapTrace_Software_Requirements_Specification (2).docx>) controls this register. Items labelled as assumptions have a defined failure response and must not be presented as established fact.

## Confirmed application constraints

- The hackathon baseline proves one journey from current in-app capture to an `Approved and completed` recovery record.
- The supported taxonomy contains exactly seven top-level groups: refrigerators; laptops/desktops; televisions; microwaves; air conditioners; compressors; mixed scrap.
- ScrapTrace is an installable, phone-friendly, offline-first PWA with a role-based backend.
- Target client is a current Android browser with camera, geolocation and local storage; reviewer/dashboard use also supports a responsive desktop browser.
- Safety facts come only from current human-approved cards. LLM use is constrained transformation with schema/prohibited-content validation and static fallback.
- English, French, Arabic and Portuguese are baseline languages; reviewed interface and safety bundles must work offline.
- Local work is saved before submission and synchronization uses client IDs, versions and idempotency keys.
- A photo cannot establish exact weight, composition, value, condition, ownership, hazard state or processing outcome.
- Estimates, recycler measurements/final price, evidence and reviewer decisions remain separate facts.
- Public/aggregate views exclude identity, precise coordinates and private evidence.
- The hackathon environment uses fictional repeatable seed data and makes no production SLA, payment, certification, EPR or government-integration claim.

## SRS assumptions and failure responses

| ID | Assumption or dependency | Required failure response |
|---|---|---|
| AD-01 | Supplied images may be used for training under challenge terms. | Stop training/export and obtain written clarification. |
| AD-02 | Qualified reviewers can approve seven safety cards and every released translation. | Release only approved English cards; disable unsupported language claims. |
| AD-03 | Seed locations include coordinates, type, accepted waste and contact details. | Use a clearly labelled fictional demonstration directory. |
| AD-04 | The LLM provider supports structured prompts and does not train on submitted content under the configured plan. | Use the approved static card and send no request. |
| AD-05 | Camera and browser local storage work on the demonstration device. | Show compatibility guidance and use an approved fallback test device. |

## External dependencies

- Rights-controlled challenge images plus licence, manifest, labels and permitted-use documentation.
- Qualified e-waste safety reviewers and human reviewers for four language bundles.
- Seeded location profiles, dated price references and programme contact/fallback text.
- HTTPS hosting, PostgreSQL with spatial capability or equivalent, private S3-compatible storage, and a versioned Python inference artifact when implemented.
- Provider-independent LLM and OpenStreetMap-compatible map adapters, each with reviewed terms and privacy controls.
- A supported Android demonstration phone, desktop review browser and documented network profile.
- Programme owners who define verification badge authority, review thresholds, evidence requirements and simulated incentive inputs.

## Decisions still required before implementation

- Concrete framework/runtime, package-manager and workspace ADRs.
- Authentication implementation and seeded credential handling; the six role types and server-enforcement requirement are already fixed.
- Physical schema, transaction strategy and exact API contract; logical entities and state rules are fixed by the SRS.
- Baseline model architecture, approved split process and final product threshold; the interim candidate gate is macro-F1 ≥ 0.70 with no class recall below 0.50.
- LLM/map/object-storage providers and provider privacy/retention settings.
- Exact location-verification evidence, weight anomaly thresholds, configured evidence types and authorised exception policy.
- Price-reference staleness threshold, allowed currencies/units and management workflow.
- Hosting provider/region, secret store, monitoring, alert owners and judging window.
- Named approvers, final sign-off, security contact and repository licence.

## Data and retention baselines

| Data class | Baseline | End action |
|---|---|---|
| Abandoned local draft | 30 days since edit, with warning | Delete from device |
| Submitted recovery/evidence | Demonstration/review period; default 12 months in non-production | Authorised logged archive/delete |
| Rejected record | Same as submitted unless programme policy changes it | Archive/delete with minimum non-personal audit proof |
| LLM request/response | 90 days by default, no personal data | Delete content; retain aggregate quality metrics |
| Approved training correction | Only after consent, human approval and dataset-version inclusion | Withdraw where feasible and record dataset impact |
| Logs | 30–90 days by type; no secrets/raw images | Automatic deletion |

These are application baselines, not statutory retention periods. Legal/programme approval is required before field use.

## Planning volumes and limits

- Approximately 5,000 supplied reference images plus reviewed pilot corrections, subject to rights verification.
- 1,000 fictional demonstration records and at least 10,000 synthetic metadata records for acceptance testing.
- Up to six evidence images per record, targeting no more than 2 MB each after client compression.
- Approximately 8–20 audit events per record.
- Seven categories, four required language bundles and up to 200 seeded locations. The SRS's “two application languages” wording is an acknowledged inconsistency; see [SRS parity notes](srs-traceability.md#srs-interpretation-notes).

## Regulatory and evidence limits

- Ghana Act 917 alignment may be described, but ScrapTrace does not claim regulatory approval or issue statutory certificates/EPR credits.
- Personal-data handling is designed toward Ghana Data Protection Act, 2012 (Act 843), subject to legal review before field use.
- Core accessibility targets WCAG 2.1 AA.
- Flags are indicators for human judgement, never proof of fraud.
- One photo, QR, location badge or processing upload cannot independently prove safe recycling.
- Field impact, classification generalisation, translation comprehension and sustained operations remain unproven until governed field testing.

## Connectivity limitations

- Fresh inference, LLM output, live directions, server status, evidence upload and dashboards require network/provider availability.
- Cached reviewed interface/safety bundles and the compact directory remain available after successful provisioning.
- Local state never means server receipt or programme approval; the application exposes offline, synchronization and action-required states explicitly.
