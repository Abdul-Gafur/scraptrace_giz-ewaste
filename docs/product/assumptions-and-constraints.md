# Assumptions and constraints

The [Concept Note](../../concept_note.md) is authoritative. This register prevents provisional beliefs from appearing as implemented or externally guaranteed facts.

## Confirmed constraints

- The prototype centres on one end-to-end journey from in-app image capture through processing evidence.
- The challenge dataset contains 5,000 real images from Ghanaian scrapyards across seven stated categories; access rights, split quality, and detailed metadata are not documented in this repository.
- Safety instructions must come from approved, sourced, reviewed cards. The LLM may explain, simplify, translate, or read that material but must not invent missing guidance.
- User corrections require review and must not update the model immediately.
- A photograph cannot establish exact weight, hidden material, or working condition; price output is an indicative range.
- Measured weight and final buying price are confirmed at physical delivery.
- No single image, QR code, or location proves recycling; linked evidence and review are required.
- Listing a location does not establish approved-recycler status.
- Personal collector details must not appear on a public dashboard.
- Training-data use requires explanation and agreement from affected people and organisations.

## Current assumptions

- **Proposed:** A browser-based progressive/offline-capable experience can support the target demonstration devices.
- **Proposed:** Participating organisations can supply accurate directory records, accepted categories, hours, and dated rates.
- **Proposed:** Domain reviewers can approve safety cards for all seven categories and review critical translations.
- **Proposed:** Recycler staff can capture scale evidence and enter measured weight at handover.
- **Proposed:** Approximate location provides sufficient prototype discovery without storing unnecessary precise location in all views.
- **Proposed:** An authorised demonstration environment can represent role-separated collector, recycler, reviewer, and manager actions.

## External dependencies

- Rights-controlled access to the challenge image dataset and its documentation.
- E-waste health and recycling experts for safety-card approval.
- Language reviewers for English, French, Arabic, and Portuguese.
- Participating locations and current, checked directory information.
- Map/geocoding data and a location provider or self-hosted equivalent.
- An LLM provider for newly generated explanations; cached approved content remains the fallback.
- Storage, database, and object-storage services once implementation begins.
- Programme or regulatory authorities for verified status, reporting acceptance, incentives, EPR use, and future payments.

## Decisions still required

- Identity, authentication, role assignment, and separation-of-duty policy.
- Record state model, completion criteria, review thresholds, and appeal/correction process.
- Exact offline data retention, encryption, device-loss, conflict, and recycler-offline policies.
- Location verification evidence, renewal frequency, and responsible authority.
- Safety content owners, sources, approval workflow, expiry, and emergency wording.
- Dataset licence, permitted model uses, consent wording, retention, and deletion handling.
- Model evaluation metrics, thresholds, supported devices, hosting mode, and release authority.
- Price-reference governance, currency/locale handling, staleness threshold, and disclaimer wording.
- Hosting region, vendors, service levels, backup/recovery, telemetry, and retention.
- Licence, external-contribution process, and Code of Conduct reporting contact.

## Hackathon limitations

- The prototype demonstrates feasibility and an understandable workflow; it is not production assurance.
- Sample local price information cannot establish a real offer or guaranteed income.
- Duplicate-image and unusual-weight checks are indicators for review, not proof of fraud.
- A dashboard demonstrates reporting concepts but not official acceptance.
- Scale and processing evidence may be demonstration evidence and must be labelled accordingly.
- Field usability, sustained offline operation, model generalisation, translation quality, and operational support remain unproven.

## Regulatory limitations

- This documentation is not legal, occupational-health, environmental, or financial advice.
- Ghanaian regulatory and programme requirements need review by competent authorities.
- ScrapTrace does not certify recyclers or issue official EPR credits.
- Mobile-money instructions, bonuses, certificates, government reporting, and Producer Responsibility Organisation connections require separate implementation and authorisation.
- Data protection roles, lawful bases, consent, subject rights, cross-border transfer, and retention must be determined before a pilot.

## Dataset limitations

- The repository does not include the 5,000-image dataset or its licence and datasheet.
- Category balance, label quality, duplicates, capture-device distribution, geography, demographics, hazardous conditions, and train/test leakage are unknown here.
- Seven categories do not cover all e-waste, and “mixed scrap” is inherently broad.
- Field corrections are candidate labels only until authorised human review.
- Performance on the challenge data cannot be assumed to generalise to new locations, devices, lighting, damage, or future categories.

## Connectivity limitations

- New cloud inference, live directions, current directory/rates, server verification, and new LLM responses may require internet.
- Cached safety cards, prior generated guides, recent directory data, and local record creation may work offline if previously provisioned.
- Device storage, browser support, cache eviction, and long offline periods may limit availability.
- Offline state never means server receipt or programme verification; users must see synchronisation status.
