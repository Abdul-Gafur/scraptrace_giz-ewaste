# Success and acceptance measures

The [approved SRS](<ScrapTrace_Software_Requirements_Specification (2).docx>) defines application acceptance, not field impact. A passing hackathon release demonstrates a safe, coherent implementation under documented conditions; it does not prove production readiness or social/environmental outcomes.

## End-to-end acceptance

All eight steps in the [application acceptance journey](user-journeys.md#application-acceptance-journey) must be observable: offline capture, category/confidence and correction, approved guidance/estimate/cached locations, idempotent synchronization and QR, recycler measurement/evidence, deliberate flag, reasoned approval, updated verified weight and visibly simulated bonus.

All Must functional requirements pass or receive an owner-approved waiver that preserves this journey and every safety/privacy control. Should/Could work follows the [scope priority rules](prototype-scope.md).

## Performance and reliability targets

| Measure | Acceptance target | Test conditions |
|---|---|---|
| Local draft save | ≤ 2 seconds for at least 95 of 100 attempts; zero accepted-data loss | Agreed demonstration phone |
| Category prediction | ≤ 5 seconds for at least 95 of 100 valid compressed images | Documented demonstration network/hosting profile |
| Non-AI API | p95 ≤ 2 seconds; error rate < 1% | 20 concurrent demonstration users |
| Dashboard | First useful seeded summary ≤ 5 seconds; paginated lists | 10,000 synthetic metadata records |
| Evidence image | Target ≤ 2 MB after compression | Supported image fixtures |
| Draft recovery | All committed fields recovered | Ten close/reopen/network-interruption scenarios |
| Synchronization | One logical server result | Repeated and reordered retries |
| Judging-window availability | 99%, excluding documented organiser-network failure | Agreed judging window; not a production SLA |

## Vision-model release measures

- Dataset manifest and duplicate report prove identical/near-duplicate separation across train/test.
- Model card reports version, class counts, split, per-class precision/recall/F1, confusion matrix, threshold and limitations.
- Product-approved threshold governs release. Until approved, the candidate target is macro-F1 ≥ 0.70 on the held-out challenge split with no class recall below 0.50.
- Low-confidence cases never auto-advance without manual confirmation.
- Correction paths never train/deploy automatically and prior model versions remain available.

These measures apply only to the documented evaluation set and do not establish field generalisation.

## Grounded-safety release measures

- Seven current approved cards contain all five required fields and approval/source/review metadata.
- Reviewed interface and safety bundles cover English, French, Arabic and Portuguese and remain available offline.
- Grounded-response evaluation covers every category/language plus missing-card, provider-failure and injection cases.
- 100% of prohibited-safety cases refuse or fall back.
- Every factual point displayed from LLM wording traces to the selected approved card.
- Fixed emergency wording works without an external call.

## Security, privacy, accessibility and compliance gates

- Role/object access matrix has no unauthorised success.
- No unresolved critical/high security finding exists without explicit time-bound acceptance.
- Repository secret scan has no unresolved high finding.
- Captured LLM requests contain no name, phone, account ID, precise coordinate or image.
- Consent denial prevents training-data export.
- Core pages have no critical automated accessibility finding; keyboard and screen-reader smoke tests pass.
- Primary mobile targets are at least 44 × 44 CSS pixels.
- Legal/content review confirms no certification, official EPR, payment or statutory-report claim.

## Data and reporting integrity

- Seeded dashboard totals reconcile to source records.
- Verified-weight totals include only `Approved and completed` records and always show unit.
- Draft, unsynchronized, under-review and rejected records are excluded.
- Estimate and final buying price remain separate.
- Every material transition creates an attributable audit event.
- Duplicate, mismatch, unusual-weight, missing-evidence and invalid-state fixtures produce named, explained flags rather than automatic fraud claims.

## Later pilot measurements

Subject to consent, privacy review and an approved study design, a later pilot may measure completion time, handoffs, approved weight, directory usefulness, travel burden, no-result areas, comprehension, collector/recycler satisfaction, review workload, field model performance and operational reliability.

## Claims unavailable before field evidence

ScrapTrace cannot yet claim increased income or collection volume; reduced unsafe handling, exposure, dumping or burning; guaranteed safe recycling; universal classification accuracy; comprehensive fraud detection; recycler certification; regulator-accepted reports; official EPR credits; or environmental outcomes.
