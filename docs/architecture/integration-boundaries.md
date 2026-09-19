# Integration boundaries

Provider integrations are adapters behind ScrapTrace-owned contracts. No listed integration is currently implemented. Hackathon use must be labelled and must not imply production, regulatory, or commercial authorisation.

## Boundary rules

- Core records use ScrapTrace identifiers and provider-neutral states.
- Adapters validate requests/responses, use timeouts and idempotency where relevant, and expose controlled errors.
- Credentials stay server-side and outside source control.
- Data shared with a provider is minimised, purpose-limited, and documented.
- Provider terms, data location, retention, availability, accessibility, cost, and exit strategy require review.
- External success does not by itself change a recovery record to verified; programme rules control state.

## LLM providers

**Hackathon boundary:** A provider-independent adapter may receive the selected language and only the approved safety-card content needed to explain or translate it. It should not receive collector identity, precise location, or unrelated images. Responses carry card, prompt/policy, model/provider, and validation metadata.

**Fallback:** Cached approved cards and prior generated guides; if no approved source exists, the service refuses to guess.

**Future/decision needs:** Provider selection, hosted versus local model, data-use terms, retention, supported languages, evaluation gates, cost, residency, and failover are to be decided.

## Map providers

**Hackathon boundary:** OpenStreetMap-compatible map display/geocoding/directions is proposed. The ScrapTrace directory remains authoritative for programme participation, accepted waste, and verification status; the map provider supplies geographic capability, not approval.

**Fallback:** Manual area search and a cached list. Live tiles/directions may be unavailable offline.

**Future/decision needs:** Tile/geocoding provider, usage policy, attribution, rate limits, offline rights, location precision, and privacy.

## Object storage

**Hackathon boundary:** An S3-compatible adapter may store protected captured and evidence images. The API controls object references and authorised temporary access; buckets are not public.

**Future/decision needs:** Provider, region, encryption/key control, malware/content checks, lifecycle and deletion, integrity verification, backup, cost, and training-data separation.

## Mobile money

**Hackathon scope:** No real mobile-money integration. At most, a clearly labelled example may simulate a bonus calculation from verified weight and an approved example rate. It creates no entitlement or payment instruction.

**Future boundary:** An authorised programme could submit an idempotent payment instruction through an adapter only after eligibility and review. Scrap price and programme bonus remain separate. Webhooks must be authenticated and reconciled; provider acceptance is not final settlement.

**Authorisation required:** Programme owner, funding, rate rules, worker/recycler consultation, financial/legal compliance, identity, consent, dispute/refund process, and provider contract.

## Government reporting

**Hackathon scope:** Dashboard concepts and demonstration exports are not government submissions or accepted reports.

**Future boundary:** A versioned reporting adapter may transmit only regulator-defined, authorised data and retain acknowledgement/rejection references. ScrapTrace must not label a report official without authority acceptance.

**Authorisation required:** Competent authority, legal basis, schema, signing, submission channel, correction process, retention, and audit requirements.

## Producer Responsibility Organisations

**Hackathon scope:** No PRO integration and no official EPR credit creation. Programme concepts may use demonstration records only.

**Future boundary:** Versioned programme/reporting contracts could provide authorised verified records or aggregate results. External organisations decide whether evidence meets their rules; ScrapTrace does not make that decision itself.

**Authorisation required:** Organisation identity, programme rules, evidence standard, data-sharing terms, verification governance, claims language, and dispute handling.

## Recycler directories

**Hackathon boundary:** A checked local directory contains participating locations, type, accepted waste, hours, contact, coordinates, verification status/evidence, and freshness. Programme managers review profiles before marking them verified.

**Future boundary:** Import or federation adapters may ingest external registries while preserving source, status vocabulary, last check, and conflict history. An imported listing never automatically becomes an approved recycler.

**Decision needs:** Authoritative sources, status criteria, reviewer, renewal frequency, takedown/correction, deduplication, and liability wording.

## Integration classification

| Integration | Hackathon scope | Future only unless separately authorised |
|---|---|---|
| LLM | Controlled explanation/translation of approved cards | Additional providers, local models, production failover |
| Maps | Directory display, proximity, optional directions | Wider coverage and advanced routing |
| Object storage | Protected demonstration evidence storage | Production lifecycle and scale |
| Mobile money | Labelled calculation simulation only | Real instructions and settlement |
| Government | Demonstration dashboard/export only | Official submission/acceptance |
| PROs | No live integration | Reporting, programme or EPR workflows |
| Recycler directories | Checked hackathon entries | Registry federation and broader verification |
