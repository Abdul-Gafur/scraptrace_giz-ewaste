# Responsible AI

## Purpose and status

These are proposed responsible-AI principles and release expectations. They do not claim that a model or safeguard exists. They apply to computer vision, LLM transformation, dataset decisions, and AI-influenced interfaces.

## Human oversight

Humans approve safety content, training data, category definitions, model/prompt releases, disputed labels, flagged recovery records, and programme verification. Automation may suggest, validate, rank, or flag but must expose its basis/version and an escalation route. Workload and reviewer competence are part of system safety.

## Transparency and uncertainty

Users must know when a category or guide wording is AI-assisted, see meaningful uncertainty/status, and distinguish source content from transformation. Records retain model/content/prompt versions and correction history. Confidence is not proof; low confidence must route to confirmation, manual selection, or review.

## User correction and contestability

Users can correct category suggestions and challenge relevant outcomes without losing the original record. Review decisions need reasons and an authorised reconsideration path to be designed. A correction does not become training truth or change a deployed model immediately.

## Bias and Ghanaian scrapyard conditions

Evaluation must investigate category imbalance, source-location and capture-condition concentration, device/lighting/background variation, missing groups, and differential error where lawful metadata supports analysis. The challenge dataset's Ghanaian scrapyard origin does not prove representativeness across Ghana, communities, users, devices, or future settings. Findings and data gaps are reported, not hidden by aggregate accuracy.

## Accessibility and language

AI-assisted experiences must support clear language, keyboard/screen-reader access, non-colour uncertainty, mobile constraints, and Arabic right-to-left presentation. English, French, Arabic, and Portuguese transformations require meaning-preservation evaluation and qualified review; availability does not prove translation quality. Users must retain access to approved source/fallback content when generation fails.

## Limits on authority

- **No automatic recycler approval:** AI cannot approve, certify, or change the governed status of a scrapyard, collection point, or recycler.
- AI output alone cannot create an official programme, regulatory, environmental, EPR, recycling, or payment claim.
- A photograph or prediction cannot prove processing, determine exact weight/value, or replace measured and reviewed evidence.
- An LLM cannot author new safety facts, weaken approved content, or make medical/commercial guarantees.

## Consent and future training

Future training use requires clear notice, an approved rights/consent basis, data minimisation, purpose limitation, provenance, retention/deletion handling, and authorised label review. Operational participation must not silently imply consent to model training. Withdrawal consequences for datasets and derived models require legal/privacy and technical decisions.

## Safe failure

On uncertainty, missing approved content, invalid output, offline limitations, provider failure, or suspected manipulation, the system preserves user work where safe, makes status visible, uses only an approved fallback, and routes decisions to people. It must not invent an answer to maintain apparent availability.

## Image-only decision limits

Image input may support a category suggestion but cannot reliably establish exact weight, hidden contents/materials, internal damage, complete working condition, exact scrap value, ownership, capture authenticity, handoff, or processing outcome. Downstream decisions must use appropriate independent evidence.

## Privacy and security

Minimise images, identity, location, prompts, and telemetry; separate operational and training purposes; restrict provider transfers; protect models, prompts, evaluation sets, and content from unauthorised access or manipulation. Prompt injection, model extraction/abuse, dataset poisoning, adversarial inputs, and sensitive-output leakage belong in security testing and the [threat model](../security/threat-model.md).

## Ongoing monitoring

Before operation, owners should define privacy-safe monitoring for failures, low-confidence rates, reviewed corrections, category/slice performance, LLM validation/fallback, complaints, accessibility/language issues, drift, abuse, and reviewer workload. Monitoring signals are not ground truth without investigation. Establish escalation, suspension, rollback, and reapproval criteria with named owners.

## Governance decisions required

Responsible-AI owner, user notice/appeal design, evaluation slices/thresholds, reviewer qualifications, release authority, monitoring/incident criteria, provider policy, field-study design, and consent/withdrawal treatment require product, programme, subject-matter, legal/privacy, security, accessibility, and community input.
