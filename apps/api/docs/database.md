# Database and migrations

## Decisions

No database ADR exists, so this implementation follows the proposed stack in [technology decisions](../../../docs/architecture/technology-decisions.md) and the [database standards](../../../docs/engineering/coding-standards.md#9-database-standards):

- **PostgreSQL 16** is the application database, accessed through **SQLAlchemy 2.0** (async ORM) and **asyncpg**.
- **Alembic** owns every schema change. The application never creates or alters tables at startup.
- **SQLite (aiosqlite)** is accepted only when `SCRAPTRACE_ENVIRONMENT=test`, as an isolated test substitute. The same migrations build both schemas, and the full test suite runs on both (see [Testing](#testing)).

## Tables

| Table | Purpose | Contract mapping |
|---|---|---|
| `programmes` | Programme settings: currency, country, weight-discrepancy threshold | Scope for `ActorReference.programme_id` |
| `recycler_facilities` | Programme-affiliated recycling operators | `ActorReference.facility_id` |
| `facility_locations` | Receiving locations operated by a facility | `receiving_location_id`, `DestinationSelection` |
| `users` | Accounts: username, Argon2id hash, session version | `ActorReference.actor_id` |
| `user_roles` | Contract role plus programme/facility scope | `UserRole` |
| `recovery_records` | Aggregate root | `RecoveryRecord` |
| `recovery_record_events` | Append-only lifecycle history | `RecoveryRecordEvent` |
| `evidence` | Evidence metadata; bytes live in evidence storage | `Evidence`, `Provenance` |
| `qr_lookup_tokens` | Token digest and derivation nonce only | `QrPayload.lookup_token` |
| `handoffs` | One append-only recycler receipt per record | `HandoffInformation` |
| `processing_records` | Draft and submitted processing | `ProcessingInformation` |
| `recovered_material_entries` | Material and weight lines | `ProcessingInformation.material_entries` |
| `review_cases` | Flags, scope and current review state for one record | `ReviewInformation` |
| `review_decisions` | Append-only reviewer decisions | `ReviewInformation`, `ProgrammeReviewResponse` |
| `idempotency_records` | Stored logical results of scoped mutations | `IdempotencyMetadata` (ADR-005) |
| `audit_events` | Append-only business and security events | — (internal) |

`facility_locations` is the only table not named in the Phase 1 brief. It exists because the contracts reference receiving locations (`receiving_location_id`, `destination.location_id`) as values distinct from the facility in `ActorReference.facility_id`. Without it, those references could not be validated.

Rows map to the contract types in [`app/contracts/mappers.py`](../app/contracts/mappers.py), the only place a row becomes a wire object. Every mapped object is validated against the committed JSON Schema before it leaves the service. The Python vocabulary in [`app/domain/vocabulary.py`](../app/domain/vocabulary.py) is compared with the generated schemas and the TypeScript source by `tests/test_contract_parity.py`, so no second domain model can drift.

## Integrity rules enforced by the schema

- **Identifiers:** externally visible IDs are UUIDv7 (`app/domain/identifiers.py`). Offline clients may supply their own UUIDv7 record and evidence IDs.
- **Time:** every instant is `timestamp with time zone`, stored in UTC and truncated to milliseconds so it round-trips through the contract format `YYYY-MM-DDTHH:MM:SS.mmmZ`. Naive datetimes are refused at bind time.
- **Created and updated metadata** on every mutable table.
- **Foreign keys** everywhere, all `ON DELETE RESTRICT`. Nothing cascades, so audit and evidence history cannot be deleted as a side effect.
- **Vocabularies** are `VARCHAR` columns with named `CHECK` constraints listing the contract values.
- **Domain checks:** positive weights and counts, a unit whenever there is a weight, mixed scrap as a weighed batch, non-negative prices, three-letter currencies, recycler roles with a facility, and so on.
- **Uniqueness:** usernames, human references, evidence object keys, token digests, one handoff/processing record/review case per record, one active (unrevoked) QR token per record (partial unique index), and idempotency scope.
- **Optimistic concurrency:** `recovery_records.revision`, `processing_records.version` and `review_cases.version` are SQLAlchemy version columns. Every update is conditional on the version that was read; a lost race raises `VERSION_CONFLICT` (409).
- **Append-only history:** database triggers reject `UPDATE`/`DELETE` on `audit_events`, `recovery_record_events`, `review_decisions` and `handoffs`, and `DELETE` on `evidence` and `recovery_records`. The guard is PL/pgSQL on PostgreSQL and `RAISE(ABORT)` on SQLite.
- **No plaintext secrets:** passwords are Argon2id hashes. QR tokens are stored as a SHA-256 digest plus a derivation nonce (see [security](security.md#qr-lookup-tokens)).

## Transactions

Services own transaction boundaries. Each lifecycle-changing command runs inside one `session.begin()` block: the state change, events, evidence rows, review case, idempotency outcome and audit events all commit together or not at all. Lifecycle commands lock the record row (`SELECT … FOR UPDATE` on PostgreSQL) before reading its state. Repositories never commit.

Database failures become standard ScrapTrace errors (`app/core/errors.py`):

| Failure | Code | Status |
|---|---|---|
| Version conflict (`StaleDataError`) | `VERSION_CONFLICT` | 409 |
| Unique violation | `DUPLICATE_RECORD` | 409 |
| Other constraint/trigger violation | `INVALID_STATE_TRANSITION` | 409 |
| Connection, timeout or other database failure | `DEPENDENCY_UNAVAILABLE` (retryable) | 503 |

Logs record only the exception class, never SQL, parameters or connection strings.

## Configuration

`SCRAPTRACE_DATABASE_URL` is required: startup stops with a message naming the variable when it is missing. Settings validation rejects unsupported schemes before connecting, and error messages never echo the URL. An unreachable database does not stop the process. `GET /health/database` reports `503` until the database is reachable and migrated to the expected head revision.

PostgreSQL connections set `statement_timeout`, `timezone=UTC` and an `application_name`, and use a bounded pool with pre-ping.

## Running migrations

From the repository root:

```bash
export SCRAPTRACE_LOCAL_POSTGRES_PASSWORD='<local-only value>'
npm run api:db:up                       # local PostgreSQL on 127.0.0.1:55432
export SCRAPTRACE_DATABASE_URL="postgresql+asyncpg://scraptrace:${SCRAPTRACE_LOCAL_POSTGRES_PASSWORD}@127.0.0.1:55432/scraptrace"

npm run api:db:migrate                  # upgrade to head
npm run api:db:check                    # fail if models and migrations disagree
npm run api:db:downgrade                # step back one revision
npm run api:db:revision -- "describe the change"   # autogenerate a new revision
```

Rules: never edit an applied migration; add a forward corrective revision. Review every autogenerated file. In particular, cyclic foreign keys must be added with `batch_alter_table` after both tables exist, and triggers are hand-written.

## Seeding

Seeding is explicit and never runs at startup:

```bash
export SCRAPTRACE_SEED_DEMO_PASSWORD='<at least 12 characters>'
npm run api:db:seed                     # add --reset-passwords to re-hash demo accounts
```

The command refuses to run in production. It is idempotent: every row has a fixed ID reused from the web application's demonstration actors (`apps/web/src/auth/actors.ts`), and existing rows are left unchanged. It loads:

- one programme (GHS, GH, 15% weight-discrepancy threshold);
- two recycler facilities: one with three receiving locations (collection centre, recycler, unverified scrapyard) and one with a single location;
- one account for each of the six roles, plus a second collector and a recycler at the other facility to demonstrate ownership and facility scope;
- demonstration recovery records (added by later milestones).

## Testing

The suite builds every test database with the real migrations:

- **Default:** SQLite. The schema is migrated once per session and each test receives a copy of the file.
- **PostgreSQL:** set `SCRAPTRACE_TEST_DATABASE_URL` to a disposable database. The session drops and re-migrates its `public` schema, and each test truncates every table first.

```bash
SCRAPTRACE_TEST_DATABASE_URL='postgresql+asyncpg://scraptrace:<password>@127.0.0.1:55432/scraptrace_test' npm run api:test
```

`tests/test_migrations.py` applies migrations to an empty database, reverses them to a clean state, re-applies them, and asserts there is no drift between models and migrations.

## Retention

Idempotency outcomes expire after `SCRAPTRACE_IDEMPOTENCY_RETENTION_DAYS` (default 30, pending the offline-duration evidence ADR-005 requires). Run `npm run api:db:purge-idempotency` to delete expired rows. No other automatic deletion exists. Record, evidence and audit retention remain governed by [data retention](../../../docs/data/data-retention.md) and need an approved policy before pilot use.
