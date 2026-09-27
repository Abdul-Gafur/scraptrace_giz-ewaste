# Requirement-to-endpoint matrix

Backend Phase 1 traceability from the [functional requirements](../../../docs/product/functional-requirements.md), [ADRs](../../../docs/decisions/README.md) and `packages/contracts` to the API. All routes are under `/v1` unless noted. "M" is the milestone that delivers the row.

| Requirement | Endpoint(s) | Contract | M |
|---|---|---|---|
| Persistence foundation; FR-REV-008 append-only history | Schema, migrations, triggers ([database](database.md)) | All persisted types | 1 |
| Deployment health | `GET /health/live`, `GET /health/ready` (model), `GET /health/database` | — | 1 |
