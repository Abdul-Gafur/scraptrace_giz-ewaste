# SRS traceability and parity

## Authority and scope

The [ScrapTrace Software Requirements Specification v1.1](<ScrapTrace_Software_Requirements_Specification (2).docx>) is the implementation and acceptance baseline. The [Concept Note](../../concept_note.md) remains the source for problem context and original product intent. Architecture Decision Records govern accepted technical choices when they do not conflict with an SRS requirement.

This page records how the repository documentation maps to the SRS. It is a documentation parity statement, not implementation or test evidence.

## Coverage summary

| SRS area | Repository authority | Parity status |
|---|---|---|
| Sections 1–2: purpose, scope, stakeholders, operating modes | [Product vision](product-vision.md), [hackathon scope](prototype-scope.md), [users and roles](users-and-roles.md), [assumptions and constraints](assumptions-and-constraints.md) | Aligned |
| Section 3: external interfaces | [Component boundaries](../architecture/component-boundaries.md), [integration boundaries](../architecture/integration-boundaries.md), [API standards](../engineering/api-design-standards.md) | Aligned at requirements/design level |
| Section 4: data | [Data-model overview](../data/data-model-overview.md), [recovery record](../data/recovery-record.md), [classification](../data/data-classification.md), [retention](../data/data-retention.md), [dataset management](../data/dataset-management.md) | Aligned at logical-design level |
| Section 5: 82 functional requirements | [Functional requirements](functional-requirements.md) | All IDs represented |
| Section 6: 54 non-functional requirements | [Non-functional requirements](non-functional-requirements.md) plus AI/security/engineering topic documents | All IDs represented |
| Section 6.10: 12 business rules | [Functional requirements](functional-requirements.md#business-rules) | All IDs represented |
| Section 7: environment, acceptance, release and risks | [Environments](../operations/environments.md), [demo journey](../prototype/demo-journey.md), [delivery checklist](../prototype/delivery-checklist.md), [known limitations](../prototype/known-limitations.md) | Aligned |
| Appendix A: glossary | [Product glossary](glossary.md) | Aligned |
| Appendix B: needs traceability | This page and requirement catalogues | Aligned |
| Appendix C: 14 analysis figures | [Analysis models](../architecture/analysis-models.md), [system overview](../architecture/system-overview.md), [data flow](../architecture/data-flow.md) | Represented as maintainable Mermaid models |
| Appendix D: priority rules | [Hackathon scope](prototype-scope.md) and requirement catalogues | Aligned |

## Stakeholder-need traceability

| Need | Outcome | SRS requirements | Repository evidence definition |
|---|---|---|---|
| NEED-01 | Identify an item and correct uncertainty | FR-VIS-001–009; NFR-AI-001–005 | Model evaluation and capture/correction tests |
| NEED-02 | Safe multilingual guidance | FR-ACC-005–007; FR-SAF-001–012; NFR-SAFE; NFR-I18N; NFR-LLM | Content audit, localization, offline and adversarial tests |
| NEED-03 | Honest indicative estimate | FR-PRI-001–007; BR-005 | Estimator unit and interface tests |
| NEED-04 | Suitable participating location | FR-LOC-001–008; NFR-PRV-002 | Distance, filter, offline and privacy tests |
| NEED-05 | Continuity under weak connectivity | FR-OFF-001–008; NFR-REL-001–003 | Interruption, retry, conflict and recovery tests |
| NEED-06 | Traceable item or batch | FR-REC-001–007; NFR-SEC-003–006 | Lifecycle, QR, duplicate and access tests |
| NEED-07 | Independent handoff and processing evidence | FR-HND-001–007; FR-REV-001 | Recycler journey and integrity tests |
| NEED-08 | Explain and resolve inconsistent records | FR-REV-002–009; BR-008–010 | Rule fixtures, review states and audit tests |
| NEED-09 | Understand journeys and totals | FR-DSH-001–007; NFR-PERF-004 | Reconciliation, role and performance tests |
| NEED-10 | Protect personal data and evidence | FR-ACC; NFR-SEC; NFR-PRV | Threat model, access matrix, DAST/SAST and privacy tests |
| NEED-11 | Preserve legal/commercial limits | Scope exclusions; BR-011; NFR-CMP | Content and legal review |
| NEED-12 | Improve future data without live learning | FR-VIS-006, FR-VIS-008–009; NFR-AI-005; BR-012 | Consent, pipeline and dataset-export review |

## SRS interpretation notes

The SRS contains a small number of internal editorial conflicts. Repository documentation applies the interpretation that best matches the explicit `shall` requirement, product scope and Concept Note:

1. **Language count:** FR-ACC-005, FR-SAF-009 and NFR-I18N-002 require English, French, Arabic and Portuguese. Some acceptance text says “both languages,” Section 4.2 says “two application languages,” and the release criteria say “two language bundles.” The repository treats all four named languages as the baseline and requires four reviewed interface/safety bundles.
2. **Record completion:** the diagrams include both `Completed` and `Approved and completed`. FR-REV-007, FR-DSH-004, BR-008 and BR-010 make `Approved and completed` the only state eligible for verified totals. `Completed` represents an unflagged evidence-complete path awaiting or receiving the system's approval outcome; it is not a statutory certification.
3. **Approval metadata:** the cover says version 1.1 is approved while the approval-signature table says pending. The repository treats v1.1 as the user-designated final requirements baseline, while formal named sign-off remains pending.
4. **Appendix E:** the table of contents lists an implementation-readiness appendix, but the supplied body ends after Appendix D. Repository readiness is therefore governed by the [delivery checklist](../prototype/delivery-checklist.md), not by a missing appendix.
5. **Language wording in tests:** acceptance statements have been normalized to “each supported language” where the source incorrectly says “both,” without reducing the four-language requirement.

## Parity verification rule

Before implementation and before each release, verify that:

- every SRS `FR-*`, `NFR-*` and `BR-*` identifier is present in the Markdown catalogues;
- no repository requirement weakens a `shall` statement;
- diagrams use the normative actors, state names, data stores and trust boundaries;
- Must/Should/Could priorities and acceptance evidence remain unchanged;
- source inconsistencies above are either corrected in a later SRS or retain their documented interpretation; and
- implementation evidence is linked separately and is never inferred from documentation parity.

