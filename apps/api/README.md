# ScrapTrace API

The ScrapTrace application API (FastAPI). It persists recovery records and their evidence and carries them from collector capture through secure QR handoff, recycler processing and programme review. It also serves the released seven-category vision classifier. Every request and response is validated against the committed schemas in `packages/contracts`, and every lifecycle change goes through the contract state machine.

| Document | Contents |
|---|---|
| [Requirement-to-endpoint matrix](docs/requirements-matrix.md) | FR/BR/ADR traceability to routes and contracts |
| [Database and migrations](docs/database.md) | Schema, integrity rules, transactions, seeding, test databases |
| [Security controls](docs/security.md) | Authentication, authorisation, QR tokens, evidence, headers, audit |
| [Frontend integration](docs/frontend-integration.md) | Web service-port → HTTP mapping and transport rules |
| [Contract gaps](docs/contract-gaps.md) | Closed and deferred contract dispositions |
| [Known limitations](docs/limitations.md) | What Phase 1 does not do yet |

## Setup

The repository convention is `uv`. The API declares Python 3.10–3.12 support; the integration suite here was verified with Python 3.11. From the repository root:

```bash
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -e 'apps/api[dev]'
npm ci && npm run contracts:check   # builds packages/contracts for the parity tests
```

Place the approved model release at `services/vision/checkpoints/best_model.pth`. Then calculate its digest and set `checkpoint_sha256` in `services/vision/checkpoints/model_manifest.json`:

```bash
shasum -a 256 services/vision/checkpoints/best_model.pth
```

The current manifest selects the EfficientNet-B0 v0.2.0 release and records its approved SHA-256. A release is ready only after the checkpoint architecture matches the manifest and its exact digest verifies. Missing, incompatible, or checksum-mismatched files keep readiness unavailable. Model files matching `services/vision/checkpoints/*.pth` are configured for Git LFS for future versions; no existing history is rewritten.

## Database, secrets and seed data

```bash
export SCRAPTRACE_LOCAL_POSTGRES_PASSWORD='<local-only value>'
npm run api:db:up                        # PostgreSQL 16 on 127.0.0.1:55432
export SCRAPTRACE_DATABASE_URL="postgresql+asyncpg://scraptrace:${SCRAPTRACE_LOCAL_POSTGRES_PASSWORD}@127.0.0.1:55432/scraptrace"
export SCRAPTRACE_AUTH_TOKEN_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
export SCRAPTRACE_QR_TOKEN_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
npm run api:db:migrate
SCRAPTRACE_SEED_DEMO_PASSWORD='<at least 12 characters>' npm run api:db:seed
```

Seeding is explicit, repeatable and refused in production. It creates one programme, two facilities with receiving locations, one account for each of the six roles (`collector.demo`, `recycler.demo`, `reviewer.demo`, `manager.demo`, `safety-admin.demo`, `ml-reviewer.demo`), two scope-demonstration accounts (`collector-two.demo`, `recycler-ashanti.demo`), and seven records replayed through the real services (draft, awaiting handoff, received, under review, auto-approved, reviewer-approved, rejected). All seeded accounts share `SCRAPTRACE_SEED_DEMO_PASSWORD`.

`apps/api/.env.example` lists every variable. The required ones are `SCRAPTRACE_DATABASE_URL`, `SCRAPTRACE_AUTH_TOKEN_SECRET` and `SCRAPTRACE_QR_TOKEN_SECRET` (two different random values of 32 or more characters). Startup stops with a message naming any missing variable. See [database and migrations](docs/database.md) for the schema and migration workflow.

## Run

### Run the full application

From the repository root, after `npm ci`, the Python setup above, Docker Desktop startup, and placement of the verified checkpoint, export four distinct local-only values. Keep them in your shell or an untracked local secret store; do not commit them.

```bash
export SCRAPTRACE_LOCAL_POSTGRES_PASSWORD="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export SCRAPTRACE_AUTH_TOKEN_SECRET="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export SCRAPTRACE_QR_TOKEN_SECRET="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export SCRAPTRACE_SEED_DEMO_PASSWORD="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(18))')"
npm run app:dev
```

`app:dev` starts PostgreSQL 16 on `127.0.0.1:55432`, applies Alembic migrations, runs the explicit idempotent seed command, and starts FastAPI at `http://127.0.0.1:8000` and Next.js at `http://127.0.0.1:3000/en`. The script sets `SCRAPTRACE_DATABASE_URL`, `SCRAPTRACE_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_MODE=http`, and `NEXT_PUBLIC_API_BASE_URL` for the two servers. Press Ctrl-C to stop the servers; the development database volume remains. Reuse the same database password on subsequent runs, or deliberately recreate that volume with a new password.

The seeded users are `collector.demo`, `recycler.demo`, `reviewer.demo`, `manager.demo`, `safety-admin.demo`, `ml-reviewer.demo`, `collector-two.demo`, and `recycler-ashanti.demo`. All use `SCRAPTRACE_SEED_DEMO_PASSWORD`. The first three roles cover the real HTTP workflow. Demo account discovery returns usernames only. See [security controls](docs/security.md) for origin protection, cookie policy, evidence scope and rate limiting.

The equivalent manual sequence is `npm run api:db:up`, `npm run api:db:migrate`, `npm run api:db:seed`, `npm run api:dev`, then `NEXT_PUBLIC_API_MODE=http NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev --workspace @scraptrace/web -- --webpack --hostname 127.0.0.1 --port 3000`, with the database URL, secrets and allowed origin exported first.

### API only

```bash
npm run api:dev
curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready        # vision model
curl http://127.0.0.1:8000/health/database     # reachable and migrated

cookie_jar="$(mktemp)"
chmod 600 "$cookie_jar"
python3 -c 'import json,os; print(json.dumps({"username":"collector.demo","password":os.environ["SCRAPTRACE_SEED_DEMO_PASSWORD"]}))' \
  | curl -sS -c "$cookie_jar" -X POST http://127.0.0.1:8000/v1/auth/sessions \
      -H 'Content-Type: application/json' --data-binary @- >/dev/null

curl -b "$cookie_jar" http://127.0.0.1:8000/v1/recovery-records
curl -b "$cookie_jar" -X POST http://127.0.0.1:8000/v1/vision/appraise \
  -H 'Origin: http://127.0.0.1:3000' -H 'X-Request-ID: demo-request-0001' \
  -F 'image=@sample.jpg' -F 'evidence_id=0199a111-1111-7111-8111-111111111111'
rm "$cookie_jar"
```

OpenAPI 3.1 is served at `/openapi.json` (and `/docs`). It publishes the contract JSON Schemas as components and documents every body, error and security scheme.

## Endpoints

All application routes are under `/v1`. Successful responses use the contract success envelope, and failures use `ErrorEnvelope` with the correct HTTP status. The vision endpoint keeps its bare `VisionAppraisalResponse`.

| Area | Routes |
|---|---|
| Authentication | `POST /auth/sessions`, `GET /auth/me`, `DELETE /auth/sessions/current`, `GET /auth/demo-accounts` (development only) |
| Reference | `GET /programmes/{programme_id}`, `GET /programmes/{programme_id}/receiving-locations`, `GET /facilities/{facility_id}/receiving-locations` |
| Recovery records | `POST /recovery-records` (multipart draft + photograph), `GET /recovery-records`, `GET/PATCH /recovery-records/{id}`, `POST /recovery-records/{id}/category-confirmations`, `POST /recovery-records/{id}/submissions`, `GET /recovery-records/{id}/events`, `GET /recovery-records/{id}/qr-credentials`, `POST /recovery-records/{id}/qr-token-rotations` |
| Evidence | `POST/GET /recovery-records/{id}/evidence`, `GET /evidence/{id}`, `GET /evidence/{id}/content` |
| Handoff | `POST /handoff-lookups`, `POST /handoffs` |
| Processing | `GET /processing-queue`, `GET/PUT /recovery-records/{id}/processing`, `POST/PATCH/DELETE /recovery-records/{id}/processing/material-entries[/{entry_id}]`, `POST /processing-submissions` |
| Review | `GET /review-cases`, `GET /review-cases/{case_id}`, `POST /review-decisions` |
| Vision | `POST /vision/appraise` |

## Authentication and authorisation

`POST /v1/auth/sessions` verifies an Argon2id password hash and issues a 30-minute access token. It is returned in the body for API clients and set as an HttpOnly cookie for browsers; cookie-authenticated writes must come from an allowed origin. `DELETE /v1/auth/sessions/current` revokes every earlier token. Every route enforces the contract permission matrix, which is parity-tested against the TypeScript `isPermissionAllowed`, together with programme, facility, ownership and review scope, all in the service layer. Vision appraisal requires authentication by default and always in production; health routes stay public. See [security controls](docs/security.md).

## Vision appraisal

`evidence_id` and form-level `request_id` are optional transport metadata. The shared `VisionAppraisalRequest` is a JSON domain contract and does not represent a multipart body; the frontend adapter combines its required evidence ID with an image upload. A successful response is the exact `VisionAppraisalResponse`, and the correlation ID is returned in the `X-Request-ID` header because the success contract has no request-ID field. The model classifies one photograph as a whole; it does not detect, count or localise multiple objects and never returns bounding boxes.

Responses are validated at runtime and in tests against `vision_appraisal_response.schema.json`. `SCRAPTRACE_CONFIDENCE_THRESHOLD` controls the minimum accepted top score. `SCRAPTRACE_AMBIGUITY_MARGIN` rejects predictions whose two leading scores are too close. Either condition returns `unable_to_classify` with `reason: low_confidence` and all seven scores, so the UI can require manual confirmation. Thresholds must be reviewed against validation data before field use.

The endpoint limits upload bytes, accepts only JPEG/PNG/WebP, verifies the decoded format rather than trusting the MIME type or filename, rejects empty, truncated, unreadable and decompression-bomb images, caps dimensions and pixels, applies EXIF orientation, converts to RGB and discards metadata. Uploads are read only for the request and are never stored; recovery-record evidence is a separate, authorised endpoint. Synchronous PyTorch inference runs outside the event loop with a timeout and bounded concurrency. `/health/ready` performs no repeated inference.

## Checks

```bash
npm run api:format:check
npm run api:lint
npm run api:typecheck
npm run api:test                         # SQLite test databases built by the migrations
SCRAPTRACE_TEST_DATABASE_URL='postgresql+asyncpg://…/scraptrace_test' npm run api:test   # PostgreSQL
npm run api:db:check                     # models and migrations agree
npm run api:audit                        # Python dependency advisories
npm run vision:predict -- sample.jpg
npm run test:e2e:http                  # disposable PostgreSQL + real API/web/checkpoint/browser suite
SCRAPTRACE_E2E_RUN_API_SUITE=true npm run test:e2e:http  # also PostgreSQL API suite and Alembic cycle
```

The real E2E runner requires the released checkpoint and verifies `/health/ready` before it starts the browser. It creates a uniquely named disposable PostgreSQL Compose project (default port `55434`), generates local-only secrets, applies migrations, seeds nine deterministic records including two isolated review cases, starts FastAPI and Next.js in HTTP mode on `127.0.0.1:8001` and `127.0.0.1:3101`, and removes only that run's containers, volume and evidence directory on exit. Change these ports with `SCRAPTRACE_E2E_POSTGRES_PORT`, `SCRAPTRACE_E2E_API_PORT`, and `SCRAPTRACE_E2E_WEB_PORT`. It never touches an existing development volume. The mock UI suite remains `npm run test:e2e`; the HTTP suite is `npm run test:e2e:http`.

The real-checkpoint smoke test skips when the release file or digest is absent. All other API tests use an in-memory predictor.

## Frontend connection

Set the browser-safe values in `apps/web/.env.local`:

```text
NEXT_PUBLIC_API_MODE=http
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

No backend secret belongs in a `NEXT_PUBLIC_*` variable. The mock service remains the development default. [Frontend integration](docs/frontend-integration.md) maps each service-port method to its route.

## Scope

In scope and implemented: persistence, authentication, authorisation, recovery records, evidence, QR lookup, handoff, processing and review. Not implemented: price estimation, safety guidance, location search, reporting and exports, offline sync batches, amendments, object detection and browser (ONNX) inference. See [known limitations](docs/limitations.md). Before production or new model deployment, pin the dataset/framework lineage in the manifest, complete licensing review, calibrate thresholds on field data, and publish a signed evaluation/model card.
