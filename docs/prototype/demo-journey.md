# Hackathon demonstration journey

## Status and data

This is the final SRS acceptance journey. All people, locations, prices, records, processing events, and evidence used in the demonstration must be fictional, challenge-provided under permitted terms, or expressly authorised and clearly labelled. No real payment, certification, government approval, or EPR credit is created.

## Required eight-stage journey

1. **Collector capture and correction.** A collector captures a new in-app e-waste image. ScrapTrace returns one of seven category suggestions, all category scores, confidence/uncertainty, and model version within the accepted target. The collector confirms or corrects the category; the original result remains recorded.
2. **Grounded safety guidance.** ScrapTrace retrieves the current approved safety card for the confirmed category and selected language, uses the controlled LLM only to explain or translate it, validates the result, and displays source/version information. A missing, invalid, offline, or failed generation displays approved source content or fixed safe fallback without invented advice.
3. **Estimate and destination.** The collector sees a dated, non-binding price range with currency, source, inputs, and disclaimer, then searches by permitted approximate location or manual area and selects a participating destination with type, accepted category, contact/freshness, and explicit verification status.
4. **Record and QR.** The collector creates an item or batch recovery record. ScrapTrace assigns a stable reference and privacy-minimised QR code, preserves provenance and lifecycle/synchronisation states, and does not present the QR as recycling proof.
5. **Offline continuity and synchronization.** The user can save the draft and queued changes with weak or unavailable internet. The interface shows Offline, Pending synchronization, Synchronizing, Synchronized, or Action required. On reconnection, idempotent retries produce one canonical record without losing acknowledged local data.
6. **Recycler handoff.** An authorised recycler retrieves the presented/assigned record, confirms receipt, records measured weight and unit plus final price separately from the estimate, and adds required handoff/scale evidence. Missing or inconsistent evidence is flagged rather than silently accepted.
7. **Processing and review.** The recycler records processing evidence. When a rule or discrepancy requires review, an authorised reviewer sees the reason and evidence, then requests information, approves, or rejects with rationale. Neither AI output nor recycler assertion alone completes programme verification.
8. **Journey and dashboard.** ScrapTrace displays the ordered capture-to-processing journey with actors, timestamps, evidence, and versions. The programme manager sees programme-scoped status totals and verified weight; only **Approved and completed** records enter verified totals.

## Required assertions

- The experience works in English, French, Arabic, and Portuguese with reviewed interface and safety-content bundles.
- Confidence, estimate, location participation, handoff, processing, review, and programme verification are visibly distinct claims.
- Collector, recycler, reviewer, and manager permissions are enforced at public interfaces.
- The record can pass through the SRS lifecycle without invalid transitions or duplicate canonical creation.
- Public or programme reporting reconciles to eligible records and excludes draft, pending, under-review, and rejected records from verified totals.

## Rehearsed fallback paths

| Failure | Behaviour |
|---|---|
| Vision unavailable or slow | Show a controlled error and allow manual category selection; a prerecorded result may be shown only when labelled replay data. |
| LLM unavailable, offline, or invalid | Show the eligible approved card, a previously validated current cached guide, or fixed approved fallback. |
| Map/directions unavailable | Use manual-area search and the controlled location list; do not imply live directions. |
| Network unavailable | Save locally and show the truthful sync state; do not imply server receipt or verification. |
| Evidence upload fails | Keep evidence pending or Action required; do not mark the record complete. |
| Dashboard unavailable | A timestamped recording may support presentation continuity but is labelled as a recording, not a live result. |

## Presentation controls

Rehearse the primary and fallback paths on the target device and network. Record the source revision, data manifest, environment, model, safety-content, prompt/policy, and contract versions. Remove real personal data, credentials, browser autofill, unrelated tabs, and notifications. Reset seeded data between rehearsals and retain a privacy-safe offline backup.
