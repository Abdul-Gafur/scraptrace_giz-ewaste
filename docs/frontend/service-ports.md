# Service ports: what the backend has to provide

The frontend reaches every piece of programme data through a typed port in
`apps/web/src/services/ports/service-ports.ts`. Two implementations satisfy it:

- `createLocalServices` (`src/services/local/`) — a complete, stateful implementation that runs
  in the browser. Records, events, the outbound queue, safety content and settings live in
  `localStorage`; photographs live in IndexedDB. Nothing leaves the device.
- `createHttpServices` (`src/services/http/`) — the seam. Every function throws today, and the
  set of functions in that file is exactly the set of endpoints the API has to expose.

Screens never touch storage. They use the hooks in `src/services/queries.ts`, so replacing the
in-browser implementation with HTTP calls is a change in one directory.

## Ports

| Port              | Operations                                                                         | Contract schemas                                    | Notes for the backend                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authentication`  | `getSession`, `signIn`, `signOut`                                                  | —                                                   | `signIn` is a development role preview. Real authentication replaces it; the rest of the app only needs `getSession` to return an actor id and role.                    |
| `recoveryRecords` | `list`, `listOwn`, `getById`, `lookup`, `create`, `submit`, `saveDraft`, `events`  | `RecoveryRecordSchema`, `RecoveryRecordEventSchema` | `lookup` resolves a human reference **or** an opaque QR token. `create` must work offline, so the client mints the record id, human reference and lookup token.         |
| `evidence`        | `store`, `read`                                                                    | `EvidenceIdSchema`                                  | The client downscales to 720px JPEG before storing. A real service needs upload, retention and access control per role.                                                 |
| `vision`          | `appraise`                                                                         | `VisionAppraisalRequest/ResponseSchema`             | Today a deterministic demonstration classifier, labelled as such in the UI. Both outcomes (`classified`, `unable_to_classify`) are handled.                             |
| `prices`          | `estimate`                                                                         | `PriceEstimateSchema`                               | Indicative range with a disclaimer that travels with the number. Never an offer.                                                                                        |
| `safetyGuidance`  | `getGuidance`                                                                      | `SafetyGuidanceRequest/ResponseSchema`              | Serves an approved card only when it is approved **in the requested language**; otherwise the safe fallback. The fallback path is reachable in the running app.         |
| `locations`       | `search`                                                                           | `LocationSearchRequest/ResponseSchema`              | Filters by category, radius and facility type. Returns `results` or `no_results` with the safe-holding message.                                                         |
| `handoffs`        | `record`                                                                           | `HandoffRequest/ResponseSchema`                     | Implemented outcomes: accepted, rejected on token mismatch, duplicate scan, and discrepancy when the measured weight differs from the reported weight by more than 25%. |
| `processing`      | `record`                                                                           | `ProcessingRequest/ResponseSchema`                  | Requires completion evidence. Returns `review_required` when the record already carries flags.                                                                          |
| `reviews`         | `decide`                                                                           | `ProgrammeReviewRequest/ResponseSchema`             | Applies approve / reject / request_correction to both the review state and the record state.                                                                            |
| `reporting`       | `summarize`                                                                        | `ReportingFilters/SummarySchema`                    | Verified weight counts `approved_and_completed` only.                                                                                                                   |
| `synchronization` | `synchronize`                                                                      | `SyncBatchRequest/ResponseSchema`                   | Returns `accepted` when online and `retryable` when not, so the queue drains truthfully.                                                                                |
| `outbox`          | `pending`, `flush`                                                                 | `QueuedMutationSchema`                              | Client-side queue. A backend needs idempotency keys honoured on replay.                                                                                                 |
| `safetyContent`   | `listCards`, `createCard`, `approve`, `requestChanges`, `requestTranslationReview` | — (no contract yet)                                 | `approve` refuses when the approver authored the card. This separation of duties belongs in the backend too.                                                            |
| `modelLabels`     | `list`, `commit`                                                                   | — (no contract yet)                                 | A committed label joins a reviewed dataset. It must never trigger retraining on its own.                                                                                |
| `dataExports`     | `list`, `request`, `build`                                                         | — (no contract yet)                                 | `build` returns CSV. Exports must honour the training-reuse consent flag.                                                                                               |
| `settings`        | `getProgramme`, `saveProgramme`, `getFacility`, `saveFacility`                     | — (no contract yet)                                 | Programme-wide defaults and per-facility notification settings.                                                                                                         |
| `consent`         | `get`, `set`                                                                       | — (no contract yet)                                 | The optional training-reuse choice from the privacy step.                                                                                                               |
| `device`          | `summary`, `clearLocalData`                                                        | —                                                   | Device-local only. There is no server side to this port.                                                                                                                |

## Contract gaps a backend milestone has to close

1. **Safety content authoring** has a read contract (`safety.contract.ts`) but no authoring,
   approval or translation contract. The port above is the shape the frontend needs.
2. **Model labels and data exports** have no contract. Both touch governed data and deserve one
   before an API is written.
3. **Programme settings and consent** have no contract, and consent in particular is a privacy
   commitment that should be stored server-side with an audit trail, not only on a device.
4. **Evidence** has a schema for the object but no transfer contract (upload, retention, access).

## What the in-browser implementation deliberately does not do

- It does not authenticate. `signIn` chooses a role to preview and grants nothing.
- It does not verify GPS. Coordinates are attached when the browser supplies them; the record
  carries `capture_location` and the UI marks the difference, but nothing validates the reading.
- It does not render a QR symbol. The transfer code shows the opaque lookup token, which the
  receiving facility enters by hand; a printed symbol needs a barcode dependency that has not
  been chosen.
- It does not reconcile conflicts. `SyncConflictSchema` exists in the contracts and the queue
  carries `base_server_revision`, but with a single device there is nothing to conflict with.
