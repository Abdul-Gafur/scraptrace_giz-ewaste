# Offline-first design

## Status

Offline capability is required by the Concept Note, but the storage technology, browser/device matrix, retention policy, and detailed reconciliation rules are **proposed** and require validation.

## What should work offline

- Select language and use previously loaded interface resources.
- Capture an image and create, edit, and view a local draft.
- Enter category, correction, count, condition, approximate location, item/batch type, and intended destination from cached data.
- Read cached approved safety cards and previously generated guides with version/freshness labels.
- Browse a recently saved directory of participating locations with last-updated information.
- Generate or display a local provisional reference/QR where safe, clearly marked pending server acknowledgement.
- View queued operations, failures, and last known record states.

## What requires internet

- Initial provisioning or refresh of content and directory data.
- Server-side record acknowledgement and cross-device access.
- Cloud vision inference unless a later validated edge model is used.
- Newly generated cloud-LLM explanations or translations.
- Current rates, live directions, geocoding, and provider-backed maps.
- Duplicate checks against server-held images, reviewer actions, reporting, and final programme verification.
- Future mobile-money, government, PRO, or external directory integrations.

## Local record states

| State | Meaning |
|---|---|
| `local-draft` | Editable data exists only on this device. |
| `queued` | The user requested submission; an operation awaits connectivity. |
| `syncing` | A submission attempt is in progress. |
| `synced` | The server durably acknowledged the operation and returned canonical identity/state. |
| `conflict` | Local intent cannot safely apply to the current server state. |
| `failed-retryable` | Temporary failure; automatic/manual retry is permitted. |
| `rejected` | Validation or authorisation failed; correction or support is required. |

Names may change when contracts are designed, but user-visible distinctions must remain. “Saved” must say whether it means saved locally or received by the server.

## Synchronisation states and retry

The client uses an ordered durable queue for operations whose sequence matters. Retries use bounded backoff, connectivity signals, and a stable operation ID. Temporary network, timeout, and server-availability failures remain retryable. Authentication, validation, record-state, and permission failures stop automatic retry and provide a safe correction or support path. Exact retry budgets are **to be decided** after device and network testing.

## Idempotency and duplicate prevention

- The client assigns a stable operation ID before first submission.
- The API stores the operation outcome within an agreed scope and returns the same outcome for a replay.
- Record creation uses a stable client record ID mapped to one server ID.
- Confirmation and state transitions reject or safely return prior outcomes when repeated.
- Image similarity may flag possible repeated evidence, but does not alone prove duplication or fraud.
- QR codes reference canonical or clearly provisional records and do not create a new record when scanned.

Idempotency-key lifetime and storage are **to be decided** and must cover credible offline retry periods.

## Conflict handling

Evidence is not resolved by silent last-write-wins. Non-sensitive UI preferences may use simple rules, but record fields require explicit policy:

- preserve collector and recycler assertions as separate facts;
- append confirmations and reviews rather than overwrite prior events;
- reject transitions from stale terminal states;
- show conflicting editable drafts and allow an authorised choice or merge;
- route material category, weight, destination, or evidence conflicts to review;
- record actor, time, reason, and prior version for resolution.

## User-visible status

Connectivity, cache freshness, local/server identity, sync state, last attempt, retry action, and conflicts must be understandable and accessible. Closing the app must not imply a queued record was sent. Dashboard users must not see local-only records as programme totals.

## LLM and safety fallback

New cloud-based LLM responses may require internet. Approved safety cards and previously generated guides may be cached, with language, card version, approval/review metadata, and freshness. When offline and no suitable approved content is cached, the app must not generate or improvise safety advice. It shows an approved generic fallback, tells the user to avoid opening or burning the item, and refers them to an approved handler or trained technician according to reviewed content. Emergency wording must be approved and locally available if included.

## Security and privacy considerations

Local images and personal data may persist on shared or lost devices. Before pilot use, the team must decide encryption, authentication, data minimisation, retention/expiry, cache clearing, logout, backup exclusion, device compromise, and consent withdrawal behaviour. Browser storage limits and eviction must be tested; a local success message cannot promise permanence beyond validated platform guarantees.
