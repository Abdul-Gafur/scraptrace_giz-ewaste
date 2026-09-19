# Known application limitations

## Purpose and status

This register describes the limitations the hackathon application release must disclose. It is not evidence that the application has been implemented or tested. Owners must update it from measured results before any demonstration or pilot.

## Capability limitations

| Area | Current hackathon boundary | Required communication or mitigation |
|---|---|---|
| E-waste categories | The hackathon scope covers seven broad categories from the Concept Note, not every product, component, brand, condition, or local trade name. | Show the suggested category, confidence, supported set, and a correction or unsupported-item path. |
| Dataset | Dataset provenance, licence, annotations, representativeness, balance, and field quality remain to be inspected. Challenge data may not represent real collection conditions. | Do not claim field accuracy; publish evaluation scope, versions, known gaps, and per-category results once measured. |
| Classification | A model suggestion can be wrong or uncertain. Thresholds and acceptance criteria are to be decided through evaluation. | Keep human confirmation/correction and route low-confidence or unsupported cases without presenting a prediction as fact. |
| Object location | Bounding boxes are possible only if suitable annotations and a detection approach are validated; a classification-only baseline may provide no box. | Do not imply that the application locates individual objects within an image unless that capability is implemented and evaluated. |
| Image-only inference | An image cannot reliably establish composition, condition, ownership, exact weight, value, hazard state, processing outcome, or recycler status. | Collect or verify those facts separately and retain their provenance. |
| Weight | The vision service does not determine exact weight. Recycler-measured weight is a separate handover fact and may need evidence or review. | Never label visual or user-entered estimates as measured weight. |
| Price | Price ranges are indicative, dated, and dependent on category, condition, quantity, location, and source quality. They are not offers or guaranteed income. | Display input/source date, currency, range, limitations, and keep the final agreed buying price separate. |
| Location directory | Hackathon locations form a limited, controlled participating directory and may be fictional for demonstration. Coverage, freshness, hours, services, and directions can be incomplete. | Label location type, participation/verification status, data freshness, and fictional or simulated entries. |
| Safety assistant | New cloud-based LLM responses may require internet and an available provider. Model output can omit or distort content if controls fail. | Use only reviewed safety cards as the source of safety facts, validate output, show provenance, and fail back to the approved card. |
| Offline guidance | Approved safety cards and previously generated guides may be cached; new cloud-generated explanations cannot be assumed offline. Cache availability and freshness depend on prior download and device storage. | Show cached/stale/absent status and never invent guidance when governed content is unavailable. |
| Payments | Any payment step or status in the demonstration is simulated. No real mobile-money transfer, settlement, refund, or financial reconciliation is in the hackathon scope. | Label simulation at every relevant screen, record, script, and result. |
| EPR and certification | ScrapTrace does not issue official EPR credits, certify recyclers, or make a listed scrapyard or collection point an approved recycler. | Use status-specific language and keep these as future capabilities unless separately authorised and implemented. |
| Fraud and evidence | Initial checks can expose missing, duplicate, inconsistent, or suspicious evidence but cannot prove authenticity or eliminate collusion, replay, manipulated images, or false measurements. | Preserve provenance and review states; avoid describing automated checks as fraud prevention or verified truth. |
| Impact evidence | A demonstration does not prove safer handling, diversion from informal disposal, income improvement, recycling outcomes, environmental benefit, or programme impact. | Reserve outcome claims for ethically governed field measurement with an accepted methodology. |

## Security, privacy, and operational limitations

The platform architecture defines security and privacy controls, but production readiness cannot be inferred from documentation. Identity assurance, authorisation enforcement, encryption and key management, retention/deletion, backup and restore, monitoring, incident response, dependency assurance, penetration testing, capacity, availability, disaster recovery, accessibility, and regulatory compliance require implementation and evidence.

Controlled demonstrations must use fictional or expressly authorised data, least-privilege accounts, approved providers, and no live payment, government, producer-responsibility, or certification integrations. Any public endpoint remains subject to a specific security and privacy review before use.

## Reassessment before a pilot

Before a field pilot, owners must replace assumptions with evidence from representative users, devices, connectivity, languages, locations, datasets, content reviewers, recycler workflows, security testing, and legal/privacy review. Pilot scope, consent, support, incident ownership, success measures, and stop criteria require explicit approval.

## Related documents

- [Hackathon scope](../product/prototype-scope.md)
- [Assumptions and constraints](../product/assumptions-and-constraints.md)
- [Responsible AI](../ai/responsible-ai.md)
- [Security and privacy](../security/security-and-privacy.md)
- [Demonstration data](prototype-data.md)
