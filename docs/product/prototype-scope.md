# Prototype scope

This scope translates the [Concept Note](../../concept_note.md) into demonstration boundaries. “Required” means required for the hackathon demonstration, not currently implemented.

## Required hackathon capabilities

The demonstration must support one understandable end-to-end journey:

1. Capture an e-waste image inside the mobile-friendly application, including offline capture.
2. Suggest one of the seven challenge categories: refrigerators; laptops and desktop computers; televisions; microwaves; air conditioners; compressors; or mixed scrap.
3. Display model confidence and communicate uncertainty.
4. Allow the user to correct a suggestion and place that correction in a review list rather than immediately retraining the model.
5. Retrieve category-matched, approved safety information with provenance and review metadata.
6. Use an LLM to explain, simplify, or translate only the retrieved approved information; refuse to guess when it is unavailable.
7. Display an indicative price range using category, count, user-selected condition, a sample dated local reference list, and approximate weight where appropriate.
8. Find nearby participating scrapyards, collection centres, or recyclers from a checked directory, clearly distinguishing location type and status.
9. Create an item or batch recovery record and unique QR code, saving it locally when offline.
10. Let a recycler confirm delivery, record measured weight and final buying price, and add a confirmation image showing the full delivery and scale reading.
11. Add a processing outcome and supporting evidence; flag missing or inconsistent records for review.
12. Display the complete journey and a dashboard of categories, locations, verified weight, and record status.

The prototype must also show basic duplicate-image and missing-information checks and English, French, Arabic, and Portuguese presentation as specified in the Concept Note. Translation quality and exact language coverage require validation.

## Optional capabilities

- A clearly labelled simulation of how an authorised future bonus could be calculated from verified weight and a programme rate.
- Saved location-directory data for offline use beyond the minimum demonstration area.
- Audio and illustrative safety presentation if content is reviewed and time permits.
- Known-weight input to refine an estimate for suitable categories.
- Search-demand aggregation without exposing searcher identities.

Optional capabilities must not displace the required journey or appear to be live financial or regulatory services.

## Future capabilities

- Real mobile-money payment instructions under an authorised and funded programme.
- Connections to Producer Responsibility Organisations and approved take-back schemes.
- Government reporting integrations and acceptance workflows.
- Official EPR reporting or a separately governed credit marketplace.
- More languages, richer audio/visual accessibility, broader categories, and field-validated location coverage.
- Scheduled model retraining from consented, reviewed field corrections.
- Edge inference after device, model, safety, and performance validation.
- Pickup coordination and expanded collection networks.

## Explicit non-goals

- Issuing official EPR credits or certificates.
- Certifying recyclers or treating every listing as approved.
- Executing real payments or promising a collector bonus.
- Guaranteeing income, a sale, an exact price, model accuracy, or safe processing.
- Deriving exact weight, hidden material, or working condition from a photograph.
- Teaching home dismantling, metal extraction, burning, cutting, or hazardous-part handling.
- Allowing an LLM to invent safety instructions.
- Learning immediately from unreviewed user corrections.
- Claiming that one image, QR code, or location proves recycling.
- Building recycling plants or replacing regulatory and programme authorities.
