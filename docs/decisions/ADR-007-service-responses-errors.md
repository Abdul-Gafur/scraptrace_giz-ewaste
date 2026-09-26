# ADR-007: Standard service response and error contracts

- **Status:** Accepted
- **Date:** 2026-09-20
- **Owners:** API architecture; security and component owners

## Context

Future components need stable success and failure semantics across HTTP and internal boundaries. Raw exceptions, provider payloads and message-text parsing would couple consumers and risk exposing sensitive data.

## Decision

Use explicit discriminated unions for domain outcomes and a versioned standard error envelope. Errors contain contract version, stable code, safe message or translation key, correlation ID, retryable flag, allow-listed field issues/details and UTC timestamp. Supported codes cover validation, authentication, permission, not found, state/version/duplicate/idempotency/integrity conflicts, unsupported version/language, missing approved safety guidance, rate limiting, dependency failure and internal failure.

Service-specific results distinguish normal non-error outcomes such as unable-to-classify, no location result, safe guidance fallback, duplicate scan and review-required. Provider-native types and errors remain inside adapters.

## Alternatives considered

### Exceptions or HTTP status alone

Rejected because neither provides stable cross-service domain semantics or field-level recovery information.

### Always return one generic result object

Rejected because optional-field combinations are ambiguous and weaken exhaustive handling.

### Provider error passthrough

Rejected because it leaks coupling and may expose infrastructure, prompts or personal data.

## Consequences

Consumers can switch exhaustively on stable discriminators and codes. HTTP adapters must map envelopes to appropriate statuses rather than return `200` for all failures. Message wording can evolve without changing machine logic.

## Security and privacy impact

Envelopes prohibit stack traces, tokens, raw prompts, personal data and topology details. Correlation IDs are validated and grant no access.

## Follow-up actions

- [ ] Define HTTP status mappings and OpenAPI operations with the API implementation.
- [ ] Add localization keys when interface content is created.

## Related documents

- [Error handling and logging](../engineering/error-handling-and-logging.md)
- [API design standards](../engineering/api-design-standards.md)
