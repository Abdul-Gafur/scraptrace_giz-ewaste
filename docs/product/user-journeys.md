# User journeys

These are required or proposed prototype journeys, not implemented behaviour. Each journey uses defined roles from [Users and roles](users-and-roles.md).

## Collector creates a record

### Success path

1. The collector selects a supported language and starts an in-app capture.
2. The app captures the image, date, and approximate location with permission.
3. The vision service suggests a category and confidence; the collector confirms count, condition, and category.
4. The app retrieves approved safety guidance and displays an indicative price range with its assumptions and date.
5. The collector chooses item or batch handling and saves the record.
6. The system assigns a unique identifier and QR code; offline records show a pending-sync state.

### Alternative path

The collector corrects a wrong category. The original suggestion and correction are retained for authorised review and do not update the model immediately. Mixed scrap requires an approximate-weight entry because an image cannot estimate it reliably.

### Failure path

If capture, local storage, or required fields fail, the app explains what was not saved and does not claim the record exists. If classification fails, manual category selection and generic approved fallback guidance are offered where available.

## Household user seeks safe guidance

### Success path

1. The household user captures an item and receives a category suggestion with confidence.
2. The system retrieves the approved card for that category.
3. The LLM explains or translates only the card content in the selected language.
4. The user sees hazards, prohibited actions, safe immediate actions, and suitable destination types.

### Alternative path

The user chooses a card directly when classification is uncertain or corrected. A cached approved card or previously generated guide can be shown offline.

### Failure path

If no approved card is available, the assistant does not guess. It tells the user to avoid opening or burning the item and to contact an approved handler or trained technician, using only an approved fallback message. Urgent conditions such as heat, smoke, or leakage invoke reviewed emergency guidance.

## Collector selects a delivery location

### Success path

1. With permission, the app uses approximate phone location and a directory of participating locations.
2. It filters locations by accepted waste type and presents distance, type, verification status, hours, contact details, and latest-data date.
3. The collector selects a location and may call it or open directions.
4. The chosen location is attached to the recovery record.

### Alternative path

The user searches an area manually or uses a recently cached list offline. A participating scrapyard or collection point remains clearly distinct from an approved recycler.

### Failure path

If location permission is refused, the user can enter a place manually. If no suitable listing exists, the app says so and must not invent or mislabel a destination. Live directions may remain unavailable offline.

## Recycler confirms handover

### Success path

1. The recycler scans the QR code and retrieves the item or batch record.
2. The recycler checks the delivery against category, count, condition, and visible evidence.
3. The recycler records measured weight and final buying price, separately from any estimate or future incentive.
4. The recycler captures the full delivery on the scale with the reading visible.
5. The system records who confirmed the handover, when, and at which participating facility.
6. The recycler later adds processing outcome and supporting evidence.

### Alternative path

A mismatch is recorded without overwriting collector data and routes the record to review. If the network fails, an authorised offline confirmation may be queued with a locally unique operation identifier; exact offline permissions are **to be decided**.

### Failure path

An unknown, already-completed, invalid, or duplicated code is not silently accepted. Missing weight or required evidence keeps the record incomplete or flagged.

## Programme reviewer checks a flagged record

### Success path

1. The reviewer opens an assigned record and sees its flag reasons, evidence, relevant model/version data, and change history.
2. The reviewer compares collector data, recycler confirmation, image similarity results, weight, and processing evidence.
3. The reviewer approves, rejects, or requests more information and records a reason.
4. The decision and actor are added to the audit history; downstream status and reports update accordingly.

### Alternative path

The reviewer escalates an uncertain safety, fraud, data-rights, or recycler-status case to the appropriate owner. A corrected image is considered for model data only through a separate consented data-review decision.

### Failure path

The reviewer cannot decide without sufficient evidence. The record stays pending and is excluded from completed verified totals and incentive eligibility.

## Programme manager views verified results

### Success path

1. The manager selects an authorised programme, period, status, category, or geography.
2. The dashboard shows definitions, freshness, record counts, verified measured weight, destinations, and processing states.
3. The manager drills into permitted supporting records and exports only authorised data if that capability is later approved.

### Alternative path

The manager compares searches or collection origins with directory coverage to identify possible access gaps. This is a planning signal, not proof that a facility is required or viable.

### Failure path

Incomplete, rejected, or unsynchronised records are visibly separated. If data is stale or unavailable, the dashboard does not present it as current or complete.

## User works with weak or unavailable internet

### Success path

1. The app reports that it is offline and shows the freshness of cached content.
2. The user captures an image, enters required metadata, reads a cached approved safety card, and saves a local draft or queued record.
3. The user receives a local identifier and visible pending-sync status.
4. When connectivity returns, the app retries using an idempotency key.
5. The server acknowledges one canonical record, maps it to the local record, and the app shows the sync result.

### Alternative path

The user uses a cached participating-location list or a previously generated guide. Cloud classification and new LLM wording may remain pending; manual category selection and approved cached wording provide a controlled fallback.

### Failure path

Failed synchronisation remains visible with a reason and retry action. Conflicting edits are not silently overwritten, duplicate submissions do not create duplicate canonical records, and permanently rejected data remains available for user correction according to a retention policy **to be decided**.
