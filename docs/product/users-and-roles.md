# Users and roles

Roles define proposed access boundaries, not implemented permissions. A person may hold more than one role only when programme policy permits it. Least-privilege and separation-of-duty rules remain to be decided.

## Collector

- **Goal:** Identify, handle, record, and deliver e-waste safely while retaining evidence of work.
- **Main actions:** Capture an in-app image; confirm or correct category; view safety guidance and indicative price; choose a participating location; create an item or batch record; present its QR code; track status.
- **Visible information:** Own records, relevant safety content, confidence, price assumptions, participating-location details, and own handover results.
- **Restrictions:** Cannot verify their own handover or processing, approve corrections, certify a destination, or treat an estimate as an offer.
- **Verification responsibility:** Attest that capture and record details are accurate; provide corrections for later review.

## Household user

- **Goal:** Understand an unwanted item's risks and find a suitable next step.
- **Main actions:** Capture or classify an item, read approved guidance, find participating locations, and optionally create a collection record.
- **Visible information:** Safety guidance, category/confidence, indicative price where relevant, and location-directory details.
- **Restrictions:** Must not receive hazardous dismantling instructions; cannot verify recycling or location approval.
- **Verification responsibility:** Confirm user-provided item and condition information when creating a record.

## Scrapyard operator

- **Goal:** Publish accurate participation details and receive planned deliveries within an authorised programme.
- **Main actions:** Maintain permitted profile information, accepted waste types, hours, contacts, and current rates if enabled; inspect incoming records.
- **Visible information:** Information needed for intended deliveries and the operator's own profile and receipts.
- **Restrictions:** A directory listing does not make the scrapyard an approved recycler; access to personal and programme-wide data is limited.
- **Verification responsibility:** Keep profile and acceptance information current; perform only handover actions assigned by programme policy.

## Recycler

- **Goal:** Confirm physical receipt and document measured weight, final buying price, and processing evidence.
- **Main actions:** Scan a record, compare delivery with the record, weigh it, photograph delivery on the scale, record discrepancies, and add processing outcome/evidence.
- **Visible information:** Delivery and collector information necessary for receipt, plus records received by that facility.
- **Restrictions:** Cannot silently overwrite collector evidence, approve its own disputed record unless policy permits, or claim official certification through ScrapTrace.
- **Verification responsibility:** Independently confirm receipt, category, weight, price, and processing evidence.

## Programme reviewer

- **Goal:** Resolve records flagged by uncertainty, duplicates, mismatches, unusual weight, or missing evidence.
- **Main actions:** Inspect evidence and history; request information; approve, reject, or retain a record for review with reasons.
- **Visible information:** Evidence necessary for assigned cases and an audit history.
- **Restrictions:** Cannot change original evidence without trace, define incentive rules, or access unrelated personal data.
- **Verification responsibility:** Apply documented checks consistently and record the basis for decisions.

## Programme manager

- **Goal:** Operate an authorised collection programme and understand verified results and access gaps.
- **Main actions:** Manage participation and review policies; view aggregates and authorised records; monitor status, categories, locations, and verified weight.
- **Visible information:** Programme-scoped dashboards and records, with personal data limited to operational need.
- **Restrictions:** Cannot describe incomplete records as verified, infer environmental or income impact without evidence, or unilaterally confer regulatory approval.
- **Verification responsibility:** Ensure profile checks, review rules, reporting definitions, and any incentive policy are authorised.

## Data or model reviewer

- **Goal:** Assess user corrections and curate authorised examples for later model evaluation or training.
- **Main actions:** Compare image, proposed label, delivered item evidence, consent, provenance, and quality; accept or reject a correction for a governed dataset.
- **Visible information:** Minimum necessary image, labels, evidence, model version, and consent/provenance metadata.
- **Restrictions:** Cannot train directly on every correction, repurpose images without permission, or access unrelated identity data.
- **Verification responsibility:** Approve only permitted, correctly labelled examples and preserve review history.

## System administrator

- **Goal:** Maintain availability, access configuration, and operational integrity.
- **Main actions:** Administer accounts and roles, support recovery, monitor services, and investigate authorised operational events.
- **Visible information:** Operational metadata and exceptional data access only where approved and audited.
- **Restrictions:** Does not automatically decide safety content, recycling validity, model labels, programme policy, or regulatory status.
- **Verification responsibility:** Preserve access controls, audit privileged actions, and follow approved operational procedures.

## Location-status rule

A listing may represent a participating scrapyard, collection centre, or recycler. Listing alone never means the location is an approved recycler. The interface must display the location type and separately governed verification status; programme managers must check profiles before any verified marking.
