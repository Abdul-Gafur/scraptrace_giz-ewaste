# User journeys

These journeys turn the [approved SRS](<ScrapTrace_Software_Requirements_Specification (2).docx>) into role-specific flows. They are requirements, not implemented behaviour. Exact acceptance criteria remain in the [functional requirements](functional-requirements.md).

## Collector creates and synchronizes a record

### Success path

1. The collector signs in with the seeded collector role and selects English, French, Arabic or Portuguese.
2. The application explains camera, location, image, record and optional training uses; permissions are requested only when used.
3. The collector captures, previews and accepts a current image.
4. The vision service returns seven scores, highest category and model version; the application explains confidence.
5. The collector confirms or corrects the category. Original output and correction remain separate.
6. The application saves a validated local draft before network submission.
7. The collector reads reviewed guidance, enters price inputs, reviews compatible locations and selects a destination.
8. The collector creates an item or batch record; mixed scrap defaults to batch. The application shows a short code, opaque QR and current lifecycle/sync state.
9. If connectivity exists, the client submits with client ID, version and idempotency key; the server returns one canonical record.

### Alternative paths

- Low confidence or inference failure exposes manual category selection and retake.
- Location permission denial exposes manual approximate-area selection.
- No current price reference shows “unavailable,” not an invented amount.
- No compatible location shows approved safe-holding guidance and programme contact.
- No approved card results in no LLM call and a reviewed referral.

### Failure paths

- Image type/size failure explains the constraint before upload.
- Storage/quota failure never claims the draft was saved and offers reduction or retry.
- Local/server conflict preserves both versions, stops overwrite and shows `Action required`.
- Authentication expiry preserves recoverable local work while requiring sign-in before protected synchronization.

## Household user seeks safe guidance

1. The household user follows the collector access path and selects a language.
2. The application explains camera/location purposes; non-essential training consent may be declined.
3. The user captures an item or manually chooses a supported category after a low-confidence result.
4. ScrapTrace retrieves only a current `Approved` safety card.
5. If online and configured, the LLM receives only card facts and the constrained language task; output is schema/prohibited-content validated.
6. The user sees the reviewed or validated guide, category, sources, version, approval date and review date.
7. The user may continue to estimate/location/record creation but is not forced to submit a recovery record merely to read guidance.

If the provider fails, the reviewed static card is displayed. If no approved card exists, ScrapTrace gives no generated advice and shows a fixed referral. Heat, smoke, fire, swelling and leakage always use fixed reviewed emergency wording available offline.

## Collector selects a receiving location

1. ScrapTrace filters published directory entries by confirmed category.
2. With permission, it ranks by straight-line distance; otherwise the user supplies an approximate area.
3. Results show location type, verification state/date, accepted categories, hours, contact, distance and directory freshness.
4. The collector switches between list and map, calls or opens external directions when online, and saves a destination.

A participating listing is not automatically an approved recycler. Only manager-reviewed profiles show the programme verified-location badge, which is not universal legal certification.

## Recycler confirms handoff and processing

1. The recycler signs in for an authorised receiving location and scans the opaque QR or enters the short code.
2. ScrapTrace returns expected category, item/batch type and only non-sensitive comparison evidence.
3. The recycler independently confirms category and condition.
4. The recycler records positive measured weight/unit, non-negative final price/currency, receiving location and capture context.
5. The recycler uploads a handoff photo and readable scale evidence, or records an authorised exception.
6. ScrapTrace appends receipt facts without overwriting collector assertions or the earlier estimate.
7. The recycler selects a controlled processing result, date and notes and attaches required evidence.
8. The rules engine evaluates evidence, exact duplicates, category disagreement, weight threshold and state validity.

An invalid or already-used code discloses no owner data. A material mismatch creates a named flag; it never silently approves the record and is not itself proof of fraud.

## Programme reviewer resolves a flagged record

1. The reviewer opens an assigned `Under review` record and sees named reasons and the approved “not proof of fraud” statement.
2. The comparison view shows original/user/recycler categories, estimate, measured weight, evidence, locations, history and relevant model/reference versions.
3. The reviewer approves, requests information or rejects and supplies a reason.
4. ScrapTrace records reviewer, decision, reason and time as an append-only audit event.
5. Approval moves an evidence-complete record to `Approved and completed`; rejection moves it to `Rejected`.
6. An information request returns only allowed fields to the responsible collector or recycler and preserves prior evidence/history.

Until a decision, the record contributes neither approved totals nor simulated-incentive eligibility.

## Programme manager views results

1. The manager signs in within assigned programme scope.
2. The dashboard shows active filters and data freshness.
3. The manager filters by date, category, coarse collection area, receiving location and status.
4. Counts reconcile to source records; verified-weight totals include only `Approved and completed` records and identify the unit.
5. The manager opens an authorised journey to inspect capture, category, safety-card version, estimate, destination, handoff, weight, final price, processing and review events in order.
6. If enabled, anonymous no-result searches indicate network gaps without identity or precise search coordinates.
7. If demonstrated, a sample incentive view shows inputs, formula and `simulation—no payment sent`.

## User works with weak or unavailable internet

1. A previously loaded PWA exposes cached interface translations, reviewed safety bundles and compact directory data.
2. The application saves a validated draft locally with client ID, idempotency key, creation time, local version and sync state.
3. It shows `Offline` and `Pending synchronization`; local save is never described as server receipt.
4. When connectivity returns, bounded retry begins and state changes to `Synchronizing`.
5. The server treats a repeated idempotency key as the same mutation.
6. Success returns the canonical ID and changes state to `Synchronized`.
7. Conflict preserves local and server values and changes state to `Action required`.

Fresh cloud LLM responses and live directions require connectivity. Cached reviewed cards and previously validated guides remain available with version/freshness.

## Application acceptance journey

| Step | Demonstration action | Required observable result |
|---|---|---|
| 1 | Collector selects language and captures a television with connectivity disabled. | Translated UI, local save and offline state are visible. |
| 2 | Model suggests a category; collector confirms or corrects it. | Confidence and original/confirmed values are retained. |
| 3 | Collector opens guidance, price and nearby places. | Approved offline guide with provenance, honest estimate and cached compatible locations appear. |
| 4 | Connectivity returns and synchronization runs. | One server record and one QR exist; no duplicate is created. |
| 5 | Recycler scans, confirms, weighs and uploads handoff/processing evidence. | Measured weight/final price remain distinct from estimate; audit events are appended. |
| 6 | A deliberate mismatch creates a flag. | The record is excluded from approved totals and the flag is explained. |
| 7 | Reviewer approves with a reason. | Journey becomes `Approved and completed`; verified weight updates. |
| 8 | Manager opens the simulated bonus view. | Calculation is traceable and states that no payment was sent. |
