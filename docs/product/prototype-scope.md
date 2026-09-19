# Hackathon application scope

The [approved SRS v1.1](<ScrapTrace_Software_Requirements_Specification (2).docx>) is the implementation baseline. The scope proves one coherent journey from capture to an approved recovery record using seeded or sample programme data. “Application” means a demonstrable and testable system, not a live national service.

## Must-have baseline

The release must:

1. provide seeded role-based access, contextual consent and English, French, Arabic and Portuguese;
2. capture a current image, validate/compress it, return seven category scores and model version, expose confidence, and require confirmation or correction;
3. retrieve a current approved safety card and use an LLM only for constrained explanation/simplification/translation with validation and static fallback;
4. produce a dated indicative price range with source, basis and disclaimer, requiring approximate weight for mixed scrap;
5. rank compatible participating locations, support manual area, distinguish location type/status and retain a reviewed offline directory;
6. save validated drafts locally, expose exact sync states, retry with idempotency and preserve conflicts for action;
7. create item or batch records, opaque QR/short codes, immutable prediction history, image digests and audited server-controlled state transitions;
8. let an authorised recycler retrieve intake data, independently confirm category/condition, record measured weight/final price and upload handoff plus scale evidence;
9. record controlled processing evidence, create transparent flags, support reasoned human decisions and keep append-only audit history;
10. show a role-appropriate journey and dashboard with filters, freshness and verified weight derived only from `Approved and completed` records; and
11. satisfy the performance, reliability, safety, security, privacy, accessibility, localization, AI-quality, compliance and maintainability gates in the [non-functional requirements](non-functional-requirements.md).

The exact acceptance demonstration is documented in [Application acceptance journey](user-journeys.md#application-acceptance-journey).

## Should-have capabilities

- Clear local-cache removal on sign-out.
- Human review of corrected labels for future dataset preparation.
- Optional known-weight input for item-category estimates.
- Anonymous no-result search aggregates by coarse area/category.
- Information-request loop returning allowed work to the responsible collector or recycler.
- Clearly labelled simulated safe-delivery bonus using sample rate and approved weight; no funds move.

These may be deferred only by a recorded decision that preserves every Must acceptance flow and safety/privacy control.

## Could-have capabilities

- Text-to-speech of displayed approved or validated guidance, separate from the LLM.
- Authorised CSV export without private image URLs, phone numbers or precise coordinates.

These begin only after core quality, accessibility and security gates pass.

## Operational modes

| Mode | Available | Limited or unavailable |
|---|---|---|
| Online | Prediction, LLM explanation, live map/directions, synchronization, evidence upload, review and dashboard | Subject to network/provider availability |
| Offline | Capture draft, manual/confirmed category, cached reviewed guide/translations, cached directory, local ID and synchronization queue | No fresh cloud LLM response, live directions or authoritative server status |
| Degraded provider | Approved static/cached text, pending record and plain-language failure status | No invented content, silent provider substitution or false success |
| Demonstration | Fictional seeded users, locations, prices and records; visibly simulated incentive data | No real payment, legal certification or production SLA |

## Outside the baseline

- Production identity verification, national ID or full know-your-customer checks.
- Recognition of every device, exact composition, exact image-derived weight/value or automatic hazard diagnosis.
- Open-ended health advice, home dismantling instructions or unreviewed AI safety facts.
- Binding offers, automated market trading or guaranteed income.
- Full national directory coverage or proof that every business is licensed.
- Official destruction certificates, statutory compliance approval, recycler certification or EPR-credit issuance.
- Live mobile-money transfers, custody of funds, smart-contract settlement, push notifications, SMS or email.
- Government or Producer Responsibility Organisation submission interfaces.
- Automatic online learning or automatic deployment of retrained models.
- Production deployment or national rollout.

These capabilities require a separately approved SRS, legal/operational agreements and field validation.

## Release exit conditions

- Every Must requirement passes or has an owner-approved waiver that does not break the acceptance scenario.
- Critical online/offline, role, safety fallback and review tests pass in the hackathon environment.
- No unresolved critical/high security issue; privacy and safety checklists are signed.
- Model and grounded-response evaluation meet approved thresholds or limitations are displayed.
- Seven category cards and all four named language bundles are reviewed, dated and available offline.
- README, setup instructions, OpenAPI, data dictionary, test evidence and demo script are reachable and legible when implementation exists.
